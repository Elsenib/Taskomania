import { Router } from "express";
import fs from "fs";
import { requireAuth } from "../middleware/auth";
import * as attachmentService from "../services/attachment.service";
import { AuthError } from "../services/auth.service";
import { broadcastToTeam } from "../socket";

export const attachmentsRouter = Router();

function handleError(err: unknown, res: import("express").Response) {
  if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

attachmentsRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const attachment = await attachmentService.getAttachmentInTeam(req.params.id, req.auth!.teamId);
    if (attachment.uploadedById !== req.auth!.userId && req.auth!.role !== "ADMIN") {
      return res.status(403).json({ error: "Only the uploader or an admin can delete this" });
    }
    await attachmentService.deleteAttachment(attachment);
    broadcastToTeam(req.auth!.teamId, "attachment:deleted", { id: req.params.id, taskId: attachment.taskId });
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});

// These two routes are the deliberate exception to header-based JWT auth in
// this API: they're loaded via <iframe src>/<img src>, which can't attach an
// Authorization header, and relative asset references *inside* previewed
// HTML (e.g. <link href="style.css">) need to resolve against this same URL
// without any extra wiring on the client's part. The random accessToken in
// the path plays that role instead — see docs/ARCHITECTURE.md.
attachmentsRouter.get("/:id/:token/tree", async (req, res) => {
  try {
    const attachment = await attachmentService.getAttachmentByToken(req.params.id, req.params.token);
    res.json({ tree: attachmentService.getFileTree(attachment) });
  } catch (err) {
    handleError(err, res);
  }
});

attachmentsRouter.get("/:id/:token/content/*", async (req, res) => {
  try {
    const attachment = await attachmentService.getAttachmentByToken(req.params.id, req.params.token);
    const subPath = (req.params as Record<string, string>)["0"] ?? "";
    const filePath = attachmentService.resolveAttachmentFilePath(attachment, subPath);
    res.setHeader("Content-Type", attachmentService.guessMimeType(filePath));
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    handleError(err, res);
  }
});

// FILE-kind attachments have no sub-path — this lets the client build one
// content URL shape for both kinds.
attachmentsRouter.get("/:id/:token/content", async (req, res) => {
  try {
    const attachment = await attachmentService.getAttachmentByToken(req.params.id, req.params.token);
    const filePath = attachmentService.resolveAttachmentFilePath(attachment, "");
    res.setHeader("Content-Type", attachmentService.guessMimeType(filePath));
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    handleError(err, res);
  }
});
