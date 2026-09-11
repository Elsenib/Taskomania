import { prisma } from "../db";
import { AuthError } from "./auth.service";
import { assertProjectInTeam } from "./project.service";
import type { createTaskSchema, updateTaskSchema } from "@team-tracker/shared";
import type { z } from "zod";
import type { Column, Role, Task } from "@prisma/client";

export function toPublicTask(task: Task) {
  return {
    id: task.id,
    teamId: task.teamId,
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    createdById: task.createdById,
    order: task.order,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function assertColumnInTeam(columnId: string, teamId: string): Promise<Column> {
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column || column.teamId !== teamId) {
    throw new AuthError("Column not found in this team", 404);
  }
  return column;
}

// Enforces the fixed workflow (see docs/ARCHITECTURE.md): members can only
// self-claim into Take (from To Do or Fail), then walk their own task
// forward one step at a time (Take -> In Progress -> Testing). Everything
// else — jumping ahead, moving someone else's task, touching Done/Fail/a
// custom column, or moving backwards — is admin-only. Admins bypass all of
// this entirely (they decide Testing -> Done/Fail and reassignment).
function assertMoveAllowed(
  from: Column,
  to: Column,
  callingRole: Role,
  callingUserId: string,
  effectiveAssigneeId: string | null
) {
  if (callingRole === "ADMIN") return;

  const claimingForSelf = (from.type === "TODO" || from.type === "FAIL") && to.type === "TAKE";
  const advancingOwnTask =
    (from.type === "TAKE" && to.type === "IN_PROGRESS") ||
    (from.type === "IN_PROGRESS" && to.type === "TESTING");

  if ((claimingForSelf || advancingOwnTask) && effectiveAssigneeId === callingUserId) return;

  throw new AuthError("Bu tapşırığı bu sütuna köçürməyə icazəniz yoxdur", 403);
}

async function assertAssigneeInTeam(assigneeId: string, teamId: string) {
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: assigneeId, teamId } },
  });
  if (!membership) {
    throw new AuthError("Assignee is not a member of this team", 404);
  }
}

// Deciding who works on what is an admin call — the one exception is a
// member claiming a task for themselves via the Take move (To Do/Fail ->
// Take), which assertMoveAllowed already validates. Anything else — handing
// a task to someone else, or setting your own name without going through
// Take — must come from an admin. Without this, the assignee dropdown in
// the task edit form let any member silently reassign any task.
function assertAssigneeChangeAllowed(
  currentAssigneeId: string | null,
  newAssigneeId: string | null,
  targetColumn: Column | undefined,
  callingRole: Role,
  callingUserId: string
) {
  if (callingRole === "ADMIN") return;
  if (newAssigneeId === currentAssigneeId) return;

  const isSelfClaim = targetColumn?.type === "TAKE" && newAssigneeId === callingUserId;
  if (isSelfClaim) return;

  throw new AuthError("Tapşırığı təyin etmək yalnız admin tərəfindən edilə bilər", 403);
}

export async function listTasks(teamId: string) {
  return prisma.task.findMany({ where: { teamId }, orderBy: { order: "asc" } });
}

export async function getTaskInTeam(taskId: string, teamId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.teamId !== teamId) throw new AuthError("Task not found", 404);
  return task;
}

export async function createTask(
  teamId: string,
  createdById: string,
  callingRole: Role,
  input: z.infer<typeof createTaskSchema>
) {
  const column = await assertColumnInTeam(input.columnId, teamId);
  if (callingRole !== "ADMIN" && column.type !== "TODO") {
    throw new AuthError("Tapşırıqları yalnız To Do sütununa əlavə edə bilərsiniz", 403);
  }
  if (input.assigneeId && callingRole !== "ADMIN") {
    throw new AuthError("Tapşırığı təyin etmək yalnız admin tərəfindən edilə bilər", 403);
  }
  if (input.assigneeId) await assertAssigneeInTeam(input.assigneeId, teamId);
  if (input.projectId) await assertProjectInTeam(input.projectId, teamId);

  const last = await prisma.task.findFirst({
    where: { teamId, columnId: input.columnId },
    orderBy: { order: "desc" },
  });
  const order = (last?.order ?? -1) + 1;

  return prisma.task.create({
    data: {
      teamId,
      columnId: input.columnId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assigneeId: input.assigneeId ?? null,
      projectId: input.projectId ?? null,
      createdById,
      order,
    },
  });
}

export async function updateTask(
  taskId: string,
  teamId: string,
  callingUserId: string,
  callingRole: Role,
  input: z.infer<typeof updateTaskSchema>
) {
  const task = await getTaskInTeam(taskId, teamId); // 404 if missing or wrong team

  let targetColumn: Column | undefined;
  const effectiveAssigneeId = input.assigneeId !== undefined ? input.assigneeId : task.assigneeId;
  if (input.columnId && input.columnId !== task.columnId) {
    targetColumn = await assertColumnInTeam(input.columnId, teamId);
    const currentColumn = await assertColumnInTeam(task.columnId, teamId);
    assertMoveAllowed(currentColumn, targetColumn, callingRole, callingUserId, effectiveAssigneeId);
  }
  if (input.assigneeId !== undefined) {
    assertAssigneeChangeAllowed(task.assigneeId, input.assigneeId, targetColumn, callingRole, callingUserId);
  }
  if (input.assigneeId) await assertAssigneeInTeam(input.assigneeId, teamId);
  if (input.projectId) await assertProjectInTeam(input.projectId, teamId);

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.columnId !== undefined && { columnId: input.columnId }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      }),
      ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
      ...(input.projectId !== undefined && { projectId: input.projectId }),
      ...(input.order !== undefined && { order: input.order }),
    },
  });

  if (targetColumn) {
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId: callingUserId,
        fromColumnId: task.columnId,
        toColumnId: targetColumn.id,
        assigneeId: effectiveAssigneeId,
      },
    });
  }

  return updated;
}

export async function deleteTask(taskId: string, teamId: string) {
  await getTaskInTeam(taskId, teamId);
  await prisma.task.delete({ where: { id: taskId } });
}

export function toPublicTaskActivity(activity: {
  id: string;
  taskId: string;
  userId: string;
  fromColumnId: string | null;
  toColumnId: string;
  assigneeId: string | null;
  createdAt: Date;
}) {
  return {
    id: activity.id,
    taskId: activity.taskId,
    userId: activity.userId,
    fromColumnId: activity.fromColumnId,
    toColumnId: activity.toColumnId,
    assigneeId: activity.assigneeId,
    createdAt: activity.createdAt.toISOString(),
  };
}

export async function listTaskActivity(taskId: string) {
  return prisma.taskActivity.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } });
}
