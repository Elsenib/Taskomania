import { prisma } from "../db";
import { AuthError } from "./auth.service";
import type { createTaskSchema, updateTaskSchema } from "@team-tracker/shared";
import type { z } from "zod";
import type { Task } from "@prisma/client";

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
    createdById: task.createdById,
    order: task.order,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function assertColumnInTeam(columnId: string, teamId: string) {
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column || column.teamId !== teamId) {
    throw new AuthError("Column not found in this team", 404);
  }
}

async function assertAssigneeInTeam(assigneeId: string, teamId: string) {
  const user = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!user || user.teamId !== teamId) {
    throw new AuthError("Assignee is not a member of this team", 404);
  }
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
  input: z.infer<typeof createTaskSchema>
) {
  await assertColumnInTeam(input.columnId, teamId);
  if (input.assigneeId) await assertAssigneeInTeam(input.assigneeId, teamId);

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
      createdById,
      order,
    },
  });
}

export async function updateTask(
  taskId: string,
  teamId: string,
  input: z.infer<typeof updateTaskSchema>
) {
  await getTaskInTeam(taskId, teamId); // 404 if missing or wrong team

  if (input.columnId) await assertColumnInTeam(input.columnId, teamId);
  if (input.assigneeId) await assertAssigneeInTeam(input.assigneeId, teamId);

  return prisma.task.update({
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
      ...(input.order !== undefined && { order: input.order }),
    },
  });
}

export async function deleteTask(taskId: string, teamId: string) {
  await getTaskInTeam(taskId, teamId);
  await prisma.task.delete({ where: { id: taskId } });
}
