import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";

// Mirrors the same exclusion set as dependencyScanner.ts/fsHandlers.ts's
// node_modules/.git filtering — without this, a zip of a real JS project
// would be huge (and blow past the server's 25MB attachment limit) since
// node_modules is never something the task's reviewer needs to see.
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "bin",
  "obj",
  "dist",
  "dist-electron",
  "release",
  ".vs",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".next",
  ".vite",
]);

async function copyFiltered(sourceDir: string, destDir: string): Promise<void> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await fs.mkdir(destDir, { recursive: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyFiltered(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Zips via native tools (no npm dependency) — PowerShell's Compress-Archive
// on Windows (verified to round-trip correctly; `tar -a` does NOT produce a
// valid zip despite accepting the flag), `zip` CLI elsewhere.
function zipDirectory(stagingDir: string, destZipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const [command, args] =
      process.platform === "win32"
        ? ([
            "powershell.exe",
            [
              "-NoProfile",
              "-Command",
              `Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${destZipPath}' -Force`,
            ],
          ] as const)
        : (["zip", ["-r", destZipPath, "."]] as const);

    const proc = spawn(command, args, { cwd: process.platform === "win32" ? undefined : stagingDir, windowsHide: true });
    proc.on("error", reject);
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))));
  });
}

// Stages a filtered copy first (rather than trying to pass exclusion
// patterns to Compress-Archive/zip directly) — simpler and more robust
// than fighting each tool's own include/exclude syntax and quoting rules,
// especially with a project path that can contain spaces/unicode.
export async function zipProject(projectRoot: string): Promise<string> {
  const tempBase = path.join(app.getPath("temp"), `taskomania-upload-${Date.now()}`);
  const stagingDir = path.join(tempBase, "staging");
  const zipPath = path.join(tempBase, "project.zip");
  await copyFiltered(projectRoot, stagingDir);
  await zipDirectory(stagingDir, zipPath);
  await fs.rm(stagingDir, { recursive: true, force: true });
  return zipPath;
}

// Mirrors the existing upload the Board's renderer already does via
// useAttachments.ts's useUploadAttachment (same endpoint/field names/
// "kind=ARCHIVE" convention) — this is the same request, just issued from
// the main process instead of a renderer, since the IDE window's renderer
// never holds the JWT (see ideWindow.ts's task-context comment).
export async function uploadZipAsAttachment(
  apiUrl: string,
  token: string,
  taskId: string,
  zipPath: string
): Promise<void> {
  try {
    const buffer = await fs.readFile(zipPath);
    const blob = new Blob([new Uint8Array(buffer)], { type: "application/zip" });
    const form = new FormData();
    form.append("kind", "ARCHIVE");
    form.append("file", blob, "project.zip");
    const res = await fetch(`${apiUrl}/api/v1/tasks/${taskId}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
    }
  } finally {
    await fs.rm(path.dirname(zipPath), { recursive: true, force: true }).catch(() => {});
  }
}

export interface CodeOriginStats {
  typedChars: number;
  pastedChars: number;
  typedPercent: number;
  pastedPercent: number;
}

// Posts as a regular task comment — reuses the existing comment thread the
// admin already reads, rather than adding a new UI surface just for this.
// Deliberately phrased as "typed vs pasted", never "AI vs human": no tool
// can honestly claim the latter, and saying so plainly avoids the false
// impression that this is some kind of AI-detector.
export async function postCodeOriginComment(
  apiUrl: string,
  token: string,
  taskId: string,
  stats: CodeOriginStats
): Promise<void> {
  if (stats.typedChars + stats.pastedChars === 0) return;
  const body =
    `Layihə tapşırığa saxlanıldı. Kod mənşəyi (bu IDE sessiyası üzrə, təxmini): ` +
    `əl ilə yazılıb ~${stats.typedPercent}%, yapışdırılıb (paste) ~${stats.pastedPercent}%.`;
  const res = await fetch(`${apiUrl}/api/v1/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
}
