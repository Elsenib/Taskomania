import { Router } from "express";
import { createInviteSchema, createTaskSchema, createColumnSchema, reorderColumnSchema } from "@team-tracker/shared";
import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { toPublicUser, createInvite } from "../services/auth.service";
import * as taskService from "../services/task.service";
import * as attachmentService from "../services/attachment.service";
import * as dependencyService from "../services/dependency.service";
import { AuthError } from "../services/auth.service";
import { broadcastToTeam } from "../socket";

export const teamsRouter = Router();

teamsRouter.use(requireAuth);

// Every route here is scoped to the caller's own team — :teamId in the path
// must match the JWT's teamId, otherwise one team could read another's data.
teamsRouter.use("/:teamId", (req, res, next) => {
  if (req.params.teamId !== req.auth!.teamId) {
    return res.status(403).json({ error: "Not a member of this team" });
  }
  next();
});

teamsRouter.get("/:teamId/members", async (req, res) => {
  const members = await prisma.user.findMany({ where: { teamId: req.params.teamId } });
  res.json({ members: members.map(toPublicUser) });
});

teamsRouter.get("/:teamId/columns", async (req, res) => {
  const columns = await prisma.column.findMany({
    where: { teamId: req.params.teamId },
    orderBy: { order: "asc" },
  });
  res.json({ columns });
});

teamsRouter.post("/:teamId/columns", requireAdmin, async (req, res) => {
  const parsed = createColumnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const teamId = req.params.teamId;
  const existing = await prisma.column.findMany({ where: { teamId }, orderBy: { order: "asc" } });

  let insertIndex = existing.length;
  if (parsed.data.afterColumnId) {
    const idx = existing.findIndex((c) => c.id === parsed.data.afterColumnId);
    if (idx === -1) return res.status(404).json({ error: "afterColumnId not found in this team" });
    insertIndex = idx + 1;
  }

  const finalOrder: (string | null)[] = existing.map((c) => c.id);
  finalOrder.splice(insertIndex, 0, null);

  const column = await prisma.$transaction(async (tx) => {
    const created = await tx.column.create({
      data: { teamId, name: parsed.data.name, order: insertIndex },
    });
    for (let i = 0; i < finalOrder.length; i++) {
      const id = finalOrder[i] === null ? created.id : (finalOrder[i] as string);
      if (id !== created.id) {
        await tx.column.update({ where: { id }, data: { order: i } });
      }
    }
    return created;
  });

  broadcastToTeam(teamId, "column:created", column);
  res.status(201).json({ column });
});

// Admin-only, same as column creation — moves an existing column to sit
// immediately after `afterColumnId` (or first, if null), renumbering every
// sibling's `order` in one transaction so positions stay a dense 0..n-1
// sequence (Column.order is an Int, not the Float Task.order uses, so
// there's no room for fractional between-value inserts here).
teamsRouter.patch("/:teamId/columns/:columnId/reorder", requireAdmin, async (req, res) => {
  const parsed = reorderColumnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const teamId = req.params.teamId;
  const columnId = req.params.columnId;
  const existing = await prisma.column.findMany({ where: { teamId }, orderBy: { order: "asc" } });

  if (!existing.some((c) => c.id === columnId)) {
    return res.status(404).json({ error: "Column not found" });
  }

  const withoutMoving = existing.filter((c) => c.id !== columnId);

  let insertIndex = 0;
  if (parsed.data.afterColumnId !== null) {
    const idx = withoutMoving.findIndex((c) => c.id === parsed.data.afterColumnId);
    if (idx === -1) return res.status(404).json({ error: "afterColumnId not found in this team" });
    insertIndex = idx + 1;
  }

  const finalIds = withoutMoving.map((c) => c.id);
  finalIds.splice(insertIndex, 0, columnId);

  const columns = await prisma.$transaction(async (tx) => {
    const updated = [];
    for (let i = 0; i < finalIds.length; i++) {
      const current = existing.find((c) => c.id === finalIds[i])!;
      updated.push(current.order === i ? current : await tx.column.update({ where: { id: finalIds[i] }, data: { order: i } }));
    }
    return updated;
  });

  broadcastToTeam(teamId, "column:reordered", columns);
  res.json({ columns });
});

teamsRouter.post("/:teamId/invites", requireAdmin, async (req, res) => {
  const parsed = createInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const invite = await createInvite(req.params.teamId, req.auth!.userId, parsed.data.expiresInDays);
  res.status(201).json({ invite: { code: invite.code, expiresAt: invite.expiresAt } });
});

teamsRouter.get("/:teamId/graph", async (req, res) => {
  const teamId = req.params.teamId;
  const [tasks, members, columns, attachments, dependencies] = await Promise.all([
    taskService.listTasks(teamId),
    prisma.user.findMany({ where: { teamId } }),
    prisma.column.findMany({ where: { teamId }, orderBy: { order: "asc" } }),
    attachmentService.listTeamAttachments(teamId),
    dependencyService.listTeamDependencies(teamId),
  ]);

  res.json({
    tasks: tasks.map(taskService.toPublicTask),
    members: members.map(toPublicUser),
    columns,
    attachments: attachments.map(attachmentService.toPublicAttachment),
    dependencies: dependencies.map(dependencyService.toPublicDependency),
  });
});

teamsRouter.get("/:teamId/tasks", async (req, res) => {
  const tasks = await taskService.listTasks(req.params.teamId);
  res.json({ tasks: tasks.map(taskService.toPublicTask) });
});

teamsRouter.post("/:teamId/tasks", async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const task = await taskService.createTask(req.params.teamId, req.auth!.userId, parsed.data);
    const publicTask = taskService.toPublicTask(task);
    broadcastToTeam(req.params.teamId, "task:created", publicTask);
    res.status(201).json({ task: publicTask });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
