import { Router } from "express";
import {
  createInviteSchema,
  createTaskSchema,
  createColumnSchema,
  reorderColumnSchema,
  renameColumnSchema,
  createProjectSchema,
  renameProjectSchema,
  setMemberRoleSchema,
} from "@team-tracker/shared";
import { prisma } from "../db";
import { requireAuth, requireAdmin, requireAdminOrMentor } from "../middleware/auth";
import { toPublicUser, createInvite, setMemberRole } from "../services/auth.service";
import * as taskService from "../services/task.service";
import * as attachmentService from "../services/attachment.service";
import * as dependencyService from "../services/dependency.service";
import * as statsService from "../services/stats.service";
import * as projectService from "../services/project.service";
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
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId: req.params.teamId },
    include: { user: true },
  });
  res.json({ members: memberships.map((m) => toPublicUser(m.user, m.teamId, m.role)) });
});

// Promote a member to mentor, or demote a mentor back to member — see
// auth.service.ts's setMemberRole for why "ADMIN" is never an accepted
// value here (this can't mint a second admin).
teamsRouter.patch("/:teamId/members/:userId/role", requireAdmin, async (req, res) => {
  const parsed = setMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const publicUser = await setMemberRole(req.params.teamId, req.params.userId, parsed.data.role);
    broadcastToTeam(req.auth!.teamId, "member:updated", publicUser);
    res.json({ member: publicUser });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
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
  // Sub-columns (Testing/Fail) live in their own order sequence scoped to
  // their parent — only top-level columns take part in this reordering.
  const existing = await prisma.column.findMany({
    where: { teamId, parentId: null },
    orderBy: { order: "asc" },
  });

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
      data: { teamId, name: parsed.data.name, type: "CUSTOM", order: insertIndex },
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
  const existing = await prisma.column.findMany({
    where: { teamId, parentId: null },
    orderBy: { order: "asc" },
  });

  if (!existing.some((c) => c.id === columnId)) {
    return res.status(404).json({ error: "Column not found (sub-columns can't be reordered)" });
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

// Admin-only: rename a column (name only — type/parent/order are structural
// and never change after creation for the fixed workflow columns; custom
// columns don't have those concepts either, so a plain rename is all this needs).
teamsRouter.patch("/:teamId/columns/:columnId", requireAdmin, async (req, res) => {
  const parsed = renameColumnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const teamId = req.params.teamId;
  const existing = await prisma.column.findUnique({ where: { id: req.params.columnId } });
  if (!existing || existing.teamId !== teamId) {
    return res.status(404).json({ error: "Column not found" });
  }

  const column = await prisma.column.update({
    where: { id: existing.id },
    data: { name: parsed.data.name },
  });

  broadcastToTeam(teamId, "column:renamed", column);
  res.json({ column });
});

// Any member can list/read — tagging a task with a project is organizational,
// not a permission-sensitive action. Only creating/renaming/deleting the
// project list itself is admin-only (same split as Columns).
teamsRouter.get("/:teamId/projects", async (req, res) => {
  const projects = await projectService.listProjects(req.params.teamId);
  res.json({ projects: projects.map(projectService.toPublicProject) });
});

teamsRouter.post("/:teamId/projects", requireAdmin, async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const project = await projectService.createProject(req.params.teamId, parsed.data.name);
    const publicProject = projectService.toPublicProject(project);
    broadcastToTeam(req.params.teamId, "project:created", publicProject);
    res.status(201).json({ project: publicProject });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

teamsRouter.patch("/:teamId/projects/:projectId", requireAdmin, async (req, res) => {
  const parsed = renameProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const project = await projectService.renameProject(
      req.params.projectId,
      req.params.teamId,
      parsed.data.name
    );
    const publicProject = projectService.toPublicProject(project);
    broadcastToTeam(req.params.teamId, "project:renamed", publicProject);
    res.json({ project: publicProject });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

teamsRouter.delete("/:teamId/projects/:projectId", requireAdmin, async (req, res) => {
  try {
    await projectService.deleteProject(req.params.projectId, req.params.teamId);
    broadcastToTeam(req.params.teamId, "project:deleted", { id: req.params.projectId });
    res.status(204).end();
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Team-wide, unfiltered — powers the per-member design canvas browser (any
// member can view anyone's canvas, no admin-only carve-out like profiles have).
teamsRouter.get("/:teamId/attachments", async (req, res) => {
  const attachments = await attachmentService.listTeamAttachments(req.params.teamId);
  res.json({ attachments: attachments.map(attachmentService.toPublicAttachment) });
});

teamsRouter.get("/:teamId/stats", async (req, res) => {
  const stats = await statsService.getTeamStats(req.params.teamId);
  res.json({ stats });
});

teamsRouter.get("/:teamId/members/:userId/profile", async (req, res) => {
  try {
    const profile = await statsService.getMemberProfile(
      req.params.teamId,
      req.params.userId,
      req.auth!.role
    );
    res.json({ profile });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin-only audit trail: every column move across the whole team, newest first.
teamsRouter.get("/:teamId/activity", requireAdminOrMentor, async (req, res) => {
  const activity = await statsService.getTeamActivityFeed(req.params.teamId);
  res.json({ activity });
});

teamsRouter.post("/:teamId/invites", requireAdmin, async (req, res) => {
  const parsed = createInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const invite = await createInvite(req.params.teamId, req.auth!.userId, parsed.data.expiresInDays);
  res.status(201).json({ invite: { code: invite.code, expiresAt: invite.expiresAt } });
});

teamsRouter.get("/:teamId/graph", async (req, res) => {
  const teamId = req.params.teamId;
  const [tasks, memberships, columns, attachments, dependencies] = await Promise.all([
    taskService.listTasks(teamId),
    prisma.teamMembership.findMany({ where: { teamId }, include: { user: true } }),
    prisma.column.findMany({ where: { teamId }, orderBy: { order: "asc" } }),
    attachmentService.listTeamAttachments(teamId),
    dependencyService.listTeamDependencies(teamId),
  ]);

  res.json({
    tasks: tasks.map(taskService.toPublicTask),
    members: memberships.map((m) => toPublicUser(m.user, m.teamId, m.role)),
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
    const task = await taskService.createTask(
      req.params.teamId,
      req.auth!.userId,
      req.auth!.role,
      parsed.data
    );
    const publicTask = taskService.toPublicTask(task);
    broadcastToTeam(req.params.teamId, "task:created", publicTask);
    res.status(201).json({ task: publicTask });
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
