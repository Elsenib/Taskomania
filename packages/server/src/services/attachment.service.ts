import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import mime from "mime-types";
import { prisma } from "../db";
import { AuthError } from "./auth.service";
import type { Attachment } from "@prisma/client";

const UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads");

function attachmentDir(id: string): string {
  return path.join(UPLOADS_ROOT, id);
}

export function toPublicAttachment(a: Attachment) {
  return {
    id: a.id,
    taskId: a.taskId,
    kind: a.kind,
    originalName: a.originalName,
    accessToken: a.accessToken,
    sizeBytes: a.sizeBytes,
    uploadedById: a.uploadedById,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAttachments(taskId: string) {
  return prisma.attachment.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } });
}

export async function listTeamAttachments(teamId: string) {
  return prisma.attachment.findMany({ where: { task: { teamId } } });
}

export async function getAttachmentInTeam(attachmentId: string, teamId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: true },
  });
  if (!attachment || attachment.task.teamId !== teamId) {
    throw new AuthError("Attachment not found", 404);
  }
  return attachment;
}

export async function getAttachmentByToken(attachmentId: string, token: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.accessToken !== token) {
    throw new AuthError("Attachment not found", 404);
  }
  return attachment;
}

export async function createFileAttachment(
  taskId: string,
  uploadedById: string,
  file: Express.Multer.File
) {
  const id = crypto.randomUUID();
  const safeName = path.basename(file.originalname);
  const dir = attachmentDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safeName), file.buffer);

  return prisma.attachment.create({
    data: {
      id,
      taskId,
      uploadedById,
      kind: "FILE",
      originalName: safeName,
      accessToken: crypto.randomBytes(20).toString("hex"),
      sizeBytes: file.size,
    },
  });
}

export async function createArchiveAttachment(
  taskId: string,
  uploadedById: string,
  file: Express.Multer.File
) {
  const id = crypto.randomUUID();
  const dir = attachmentDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const zip = new AdmZip(file.buffer);
  assertSafeZip(zip, dir);
  zip.extractAllTo(dir, true);

  return prisma.attachment.create({
    data: {
      id,
      taskId,
      uploadedById,
      kind: "ARCHIVE",
      originalName: path.basename(file.originalname),
      accessToken: crypto.randomBytes(20).toString("hex"),
      sizeBytes: file.size,
    },
  });
}

// Defends against zip-slip: reject any entry whose extracted path would land
// outside the attachment's own directory.
function assertSafeZip(zip: AdmZip, targetDir: string) {
  for (const entry of zip.getEntries()) {
    const resolved = path.resolve(targetDir, entry.entryName);
    if (resolved !== targetDir && !resolved.startsWith(targetDir + path.sep)) {
      throw new AuthError(`Unsafe archive entry: ${entry.entryName}`, 400);
    }
  }
}

export async function deleteAttachment(attachment: Attachment) {
  await prisma.attachment.delete({ where: { id: attachment.id } });
  fs.rmSync(attachmentDir(attachment.id), { recursive: true, force: true });
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileTreeNode[];
}

function walk(dir: string, relBase: string): FileTreeNode[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const nodes = entries.map((entry): FileTreeNode => {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return { name: entry.name, path: relPath, type: "dir", children: walk(abs, relPath) };
    }
    return { name: entry.name, path: relPath, type: "file", size: fs.statSync(abs).size };
  });
  return nodes.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
  );
}

export function getFileTree(attachment: Attachment): FileTreeNode[] {
  if (attachment.kind !== "ARCHIVE") throw new AuthError("Not an archive attachment", 400);
  return walk(attachmentDir(attachment.id), "");
}

// Resolves the on-disk path for a content request, guarding against path
// traversal via a crafted `subPath` (e.g. "../../etc/passwd").
export function resolveAttachmentFilePath(attachment: Attachment, subPath: string): string {
  const dir = attachmentDir(attachment.id);

  if (attachment.kind === "FILE") {
    return path.join(dir, attachment.originalName);
  }

  const requested = subPath && subPath.length > 0 ? subPath : "index.html";
  const resolved = path.resolve(dir, requested);
  if (resolved !== dir && !resolved.startsWith(dir + path.sep)) {
    throw new AuthError("Invalid path", 400);
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    throw new AuthError("File not found", 404);
  }
  return resolved;
}

export function guessMimeType(filePath: string): string {
  return mime.lookup(filePath) || "application/octet-stream";
}
