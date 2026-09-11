import { Router } from "express";
import multer from "multer";
import { updateTaskSchema, createCommentSchema, createDependencySchema } from "@team-tracker/shared";
import { requireAuth, requireAdmin } from "../middleware/auth";
import * as taskService from "../services/task.service";
import * as commentService from "../services/comment.service";
import * as attachmentService from "../services/attachment.service";
import * as dependencyService from "../services/dependency.service";
import { AuthError } from "../services/auth.service";
import { broadcastToTeam } from "../socket";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function handleError(err: unknown, res: import("express").Response) {
  if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

tasksRouter.patch("/:taskId", async (req, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const task = await taskService.updateTask(
      req.params.taskId,
      req.auth!.teamId,
      req.auth!.userId,
      req.auth!.role,
      parsed.data
    );
    const publicTask = taskService.toPublicTask(task);
    broadcastToTeam(req.auth!.teamId, "task:updated", publicTask);
    res.json({ task: publicTask });
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.delete("/:taskId", requireAdmin, async (req, res) => {
  try {
    await taskService.deleteTask(req.params.taskId, req.auth!.teamId);
    broadcastToTeam(req.auth!.teamId, "task:deleted", { id: req.params.taskId });
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.get("/:taskId/activity", async (req, res) => {
  try {
    await taskService.getTaskInTeam(req.params.taskId, req.auth!.teamId);
    const activity = await taskService.listTaskActivity(req.params.taskId);
    res.json({ activity: activity.map(taskService.toPublicTaskActivity) });
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.get("/:taskId/comments", async (req, res) => {
  try {
    await taskService.getTaskInTeam(req.params.taskId, req.auth!.teamId);
    const comments = await commentService.listComments(req.params.taskId);
    res.json({ comments: comments.map(commentService.toPublicComment) });
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.post("/:taskId/comments", async (req, res) => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await taskService.getTaskInTeam(req.params.taskId, req.auth!.teamId);
    const comment = await commentService.createComment(
      req.params.taskId,
      req.auth!.userId,
      parsed.data.body
    );
    const publicComment = commentService.toPublicComment(comment);
    broadcastToTeam(req.auth!.teamId, "comment:created", publicComment);
    res.status(201).json({ comment: publicComment });
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.get("/:taskId/attachments", async (req, res) => {
  try {
    await taskService.getTaskInTeam(req.params.taskId, req.auth!.teamId);
    const attachments = await attachmentService.listAttachments(req.params.taskId);
    res.json({ attachments: attachments.map(attachmentService.toPublicAttachment) });
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.post("/:taskId/attachments", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const kind = req.body?.kind === "ARCHIVE" ? "ARCHIVE" : "FILE";

  try {
    await taskService.getTaskInTeam(req.params.taskId, req.auth!.teamId);

    const attachment =
      kind === "ARCHIVE"
        ? await attachmentService.createArchiveAttachment(req.params.taskId, req.auth!.userId, req.file)
        : await attachmentService.createFileAttachment(req.params.taskId, req.auth!.userId, req.file);

    const publicAttachment = attachmentService.toPublicAttachment(attachment);
    broadcastToTeam(req.auth!.teamId, "attachment:created", publicAttachment);
    res.status(201).json({ attachment: publicAttachment });
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.get("/:taskId/dependencies", async (req, res) => {
  try {
    await taskService.getTaskInTeam(req.params.taskId, req.auth!.teamId);
    const deps = await dependencyService.listTaskDependencies(req.params.taskId);
    res.json({ dependencies: deps.map(dependencyService.toPublicDependency) });
  } catch (err) {
    handleError(err, res);
  }
});

tasksRouter.post("/:taskId/dependencies", async (req, res) => {
  const parsed = createDependencySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await taskService.getTaskInTeam(req.params.taskId, req.auth!.teamId);
    const dep = await dependencyService.createDependency(
      req.auth!.teamId,
      req.params.taskId,
      parsed.data.blockedTaskId
    );
    const publicDep = dependencyService.toPublicDependency(dep);
    broadcastToTeam(req.auth!.teamId, "dependency:created", publicDep);
    res.status(201).json({ dependency: publicDep });
  } catch (err) {
    handleError(err, res);
  }
});
