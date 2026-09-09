import { prisma } from "../db";
import { AuthError } from "./auth.service";
import type { TaskDependency } from "@prisma/client";

export function toPublicDependency(d: TaskDependency) {
  return {
    id: d.id,
    blockingTaskId: d.blockingTaskId,
    blockedTaskId: d.blockedTaskId,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function listTeamDependencies(teamId: string) {
  return prisma.taskDependency.findMany({
    where: { blockingTask: { teamId } },
  });
}

export async function listTaskDependencies(taskId: string) {
  return prisma.taskDependency.findMany({
    where: { OR: [{ blockingTaskId: taskId }, { blockedTaskId: taskId }] },
  });
}

export async function createDependency(
  teamId: string,
  blockingTaskId: string,
  blockedTaskId: string
) {
  if (blockingTaskId === blockedTaskId) {
    throw new AuthError("A task cannot depend on itself", 400);
  }

  const [blocking, blocked] = await Promise.all([
    prisma.task.findUnique({ where: { id: blockingTaskId } }),
    prisma.task.findUnique({ where: { id: blockedTaskId } }),
  ]);
  if (!blocking || blocking.teamId !== teamId || !blocked || blocked.teamId !== teamId) {
    throw new AuthError("Task not found in this team", 404);
  }

  const reverseExists = await prisma.taskDependency.findUnique({
    where: {
      blockingTaskId_blockedTaskId: { blockingTaskId: blockedTaskId, blockedTaskId: blockingTaskId },
    },
  });
  if (reverseExists) {
    throw new AuthError("These tasks already depend on each other in the opposite direction", 409);
  }

  try {
    return await prisma.taskDependency.create({ data: { blockingTaskId, blockedTaskId } });
  } catch {
    throw new AuthError("This dependency already exists", 409);
  }
}

export async function deleteDependency(id: string, teamId: string) {
  const dep = await prisma.taskDependency.findUnique({
    where: { id },
    include: { blockingTask: true },
  });
  if (!dep || dep.blockingTask.teamId !== teamId) {
    throw new AuthError("Dependency not found", 404);
  }
  await prisma.taskDependency.delete({ where: { id } });
  return dep;
}
