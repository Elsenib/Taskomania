import { prisma } from "../db";
import { AuthError } from "./auth.service";
import { toPublicUser } from "./auth.service";
import { toPublicTask } from "./task.service";
import { toPublicAttachment } from "./attachment.service";
import type { Role } from "@prisma/client";

// Success/fail counts are derived from TaskActivity's `assigneeId` snapshot
// (who the task was assigned to at the moment it landed in Done/Fail), never
// from Task.assigneeId — that field gets overwritten when a failed task is
// reassigned, which would silently erase the original person's failure.
async function computeTeamAggregates(teamId: string) {
  const [columns, tasks, activities] = await Promise.all([
    prisma.column.findMany({ where: { teamId } }),
    prisma.task.findMany({ where: { teamId } }),
    prisma.taskActivity.findMany({ where: { task: { teamId } } }),
  ]);

  const columnTypeById = new Map(columns.map((c) => [c.id, c.type]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return { columns, tasks, activities, columnTypeById, taskById };
}

function percentageFor(successCount: number, failCount: number): number {
  const decided = successCount + failCount;
  return decided === 0 ? 100 : Math.round((successCount / decided) * 100);
}

// Admins don't do tasks themselves (they assign/oversee), so a productivity
// percentage for them is meaningless noise — excluded from the leaderboard
// entirely rather than shown as a confusing 100%/0-decided row.
export async function getTeamStats(teamId: string) {
  const { tasks, activities, columnTypeById } = await computeTeamAggregates(teamId);
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId, role: "MEMBER" },
    include: { user: true },
  });
  const members = memberships.map((m) => m.user);

  const successTaskIdsByUser = new Map<string, Set<string>>();
  const failTaskIdsByUser = new Map<string, Set<string>>();
  for (const member of members) {
    successTaskIdsByUser.set(member.id, new Set());
    failTaskIdsByUser.set(member.id, new Set());
  }

  for (const activity of activities) {
    if (!activity.assigneeId) continue;
    const toType = columnTypeById.get(activity.toColumnId);
    if (toType === "DONE") successTaskIdsByUser.get(activity.assigneeId)?.add(activity.taskId);
    if (toType === "FAIL") failTaskIdsByUser.get(activity.assigneeId)?.add(activity.taskId);
  }

  const activeCountByUser = new Map<string, number>();
  for (const task of tasks) {
    if (!task.assigneeId) continue;
    const type = columnTypeById.get(task.columnId);
    if (type === "TAKE" || type === "IN_PROGRESS" || type === "TESTING") {
      activeCountByUser.set(task.assigneeId, (activeCountByUser.get(task.assigneeId) ?? 0) + 1);
    }
  }

  return members.map((member) => {
    const successCount = successTaskIdsByUser.get(member.id)?.size ?? 0;
    const failCount = failTaskIdsByUser.get(member.id)?.size ?? 0;
    return {
      userId: member.id,
      successCount,
      failCount,
      activeCount: activeCountByUser.get(member.id) ?? 0,
      percentage: percentageFor(successCount, failCount),
    };
  });
}

export async function getMemberProfile(teamId: string, userId: string, callingRole: Role) {
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    include: { user: true },
  });
  if (!membership) throw new AuthError("Member not found", 404);
  const user = membership.user;

  // Only the admin (or a mentor, who's meant to see everything per their
  // oversight role) can open the admin's own profile — a plain member has
  // no business seeing another member's manager-level view, and there's
  // nothing task-productivity-related to show there anyway (see below).
  if (membership.role === "ADMIN" && callingRole !== "ADMIN" && callingRole !== "MENTOR") {
    throw new AuthError("Bu profilə baxmaq icazəniz yoxdur", 403);
  }

  const { tasks, activities, taskById, columnTypeById } = await computeTeamAggregates(teamId);
  const attachments = await prisma.attachment.findMany({
    where: { uploadedById: userId, task: { teamId } },
  });

  const myActivities = activities.filter((a) => a.assigneeId === userId);
  const successTaskIds = new Set(
    myActivities.filter((a) => columnTypeById.get(a.toColumnId) === "DONE").map((a) => a.taskId)
  );
  const failTaskIds = new Set(
    myActivities.filter((a) => columnTypeById.get(a.toColumnId) === "FAIL").map((a) => a.taskId)
  );

  const currentTasks = tasks.filter((t) => {
    if (t.assigneeId !== userId) return false;
    const type = columnTypeById.get(t.columnId);
    return type === "TAKE" || type === "IN_PROGRESS" || type === "TESTING";
  });

  const successCount = successTaskIds.size;
  const failCount = failTaskIds.size;

  return {
    user: toPublicUser(user, teamId, membership.role),
    // null for admins/mentors — see the guard above, there's no productivity
    // concept for a role that doesn't execute tasks (mentors oversee, same
    // as admins, and are excluded from getTeamStats's leaderboard the same
    // way via its own `role: "MEMBER"` filter).
    stats:
      membership.role === "ADMIN" || membership.role === "MENTOR"
        ? null
        : {
            userId,
            successCount,
            failCount,
            activeCount: currentTasks.length,
            percentage: percentageFor(successCount, failCount),
          },
    currentTasks: currentTasks.map(toPublicTask),
    successfulTasks: [...successTaskIds]
      .map((id) => taskById.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map(toPublicTask),
    failedTasks: [...failTaskIds]
      .map((id) => taskById.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map(toPublicTask),
    attachments: attachments.map(toPublicAttachment),
  };
}

export async function getTeamActivityFeed(teamId: string, limit = 200) {
  const activities = await prisma.taskActivity.findMany({
    where: { task: { teamId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { task: { select: { title: true } } },
  });

  return activities.map((a) => ({
    id: a.id,
    taskId: a.taskId,
    taskTitle: a.task.title,
    userId: a.userId,
    assigneeId: a.assigneeId,
    fromColumnId: a.fromColumnId,
    toColumnId: a.toColumnId,
    createdAt: a.createdAt.toISOString(),
  }));
}
