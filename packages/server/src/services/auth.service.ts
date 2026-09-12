import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../db";
import { signToken } from "../middleware/auth";
import type {
  registerTeamSchema,
  joinTeamSchema,
  loginSchema,
  createAdditionalTeamSchema,
  joinAdditionalTeamSchema,
} from "@team-tracker/shared";
import type { z } from "zod";
import type { Role } from "@prisma/client";

// Fixed top-level workflow: To Do -> Take -> In Progress -> Done, each with
// their sub-column (Testing under In Progress, Fail under Done) created
// right after. See assertMoveAllowed() in task.service.ts for the movement
// rules this shape exists to support.
const DEFAULT_TOP_LEVEL_COLUMNS: { name: string; type: "TODO" | "TAKE" | "IN_PROGRESS" | "DONE" }[] = [
  { name: "To Do", type: "TODO" },
  { name: "Take", type: "TAKE" },
  { name: "In Progress", type: "IN_PROGRESS" },
  { name: "Done", type: "DONE" },
];

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Shared by every "create a brand-new team" path (first-ever registration,
// or an existing user spinning up an additional team to admin).
async function seedDefaultColumns(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], teamId: string) {
  for (let i = 0; i < DEFAULT_TOP_LEVEL_COLUMNS.length; i++) {
    const { name, type } = DEFAULT_TOP_LEVEL_COLUMNS[i];
    const column = await tx.column.create({ data: { teamId, name, type, order: i } });

    if (type === "IN_PROGRESS") {
      await tx.column.create({
        data: { teamId, name: "Testing", type: "TESTING", order: 0, parentId: column.id },
      });
    } else if (type === "DONE") {
      await tx.column.create({
        data: { teamId, name: "Fail", type: "FAIL", order: 0, parentId: column.id },
      });
    }
  }
}

function issueSession(userId: string, teamId: string, role: Role) {
  return signToken({ userId, teamId, role });
}

export async function registerTeam(input: z.infer<typeof registerTeamSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Email already in use", 409);

  const passwordHash = await bcrypt.hash(input.password, 10);

  const { team, user } = await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { name: input.teamName } });
    await seedDefaultColumns(tx, team.id);

    const user = await tx.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName },
    });
    await tx.teamMembership.create({ data: { userId: user.id, teamId: team.id, role: "ADMIN" } });

    return { team, user };
  });

  const token = issueSession(user.id, team.id, "ADMIN");
  return { token, user, teamId: team.id, role: "ADMIN" as Role };
}

export async function joinTeam(input: z.infer<typeof joinTeamSchema>) {
  const invite = await prisma.invite.findUnique({ where: { code: input.inviteCode } });
  if (!invite) throw new AuthError("Invalid invite code", 404);
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new AuthError("Invite code has expired", 410);
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Email already in use", 409);

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName },
    });
    await tx.teamMembership.create({ data: { userId: user.id, teamId: invite.teamId, role: "MEMBER" } });
    return user;
  });

  const token = issueSession(user.id, invite.teamId, "MEMBER");
  return { token, user, teamId: invite.teamId, role: "MEMBER" as Role };
}

// Already-logged-in user spinning up an additional team they'll admin —
// same column seeding as registerTeam, just no new User row.
export async function createAdditionalTeam(
  userId: string,
  input: z.infer<typeof createAdditionalTeamSchema>
) {
  const team = await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { name: input.teamName } });
    await seedDefaultColumns(tx, team.id);
    await tx.teamMembership.create({ data: { userId, teamId: team.id, role: "ADMIN" } });
    return team;
  });

  const token = issueSession(userId, team.id, "ADMIN");
  return { token, teamId: team.id, role: "ADMIN" as Role };
}

// Already-logged-in user joining an additional team as a member via invite code.
export async function joinAdditionalTeam(
  userId: string,
  input: z.infer<typeof joinAdditionalTeamSchema>
) {
  const invite = await prisma.invite.findUnique({ where: { code: input.inviteCode } });
  if (!invite) throw new AuthError("Invalid invite code", 404);
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new AuthError("Invite code has expired", 410);
  }

  const existing = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId: invite.teamId } },
  });
  if (existing) throw new AuthError("Artıq bu komandanın üzvüsünüz", 409);

  await prisma.teamMembership.create({ data: { userId, teamId: invite.teamId, role: "MEMBER" } });

  const token = issueSession(userId, invite.teamId, "MEMBER");
  return { token, teamId: invite.teamId, role: "MEMBER" as Role };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AuthError("Invalid email or password", 401);

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AuthError("Invalid email or password", 401);

  // Default to whichever team this user last had active — new accounts have
  // exactly one membership (from register/join), so this is a no-op for them.
  const membership = await prisma.teamMembership.findFirst({
    where: { userId: user.id },
    orderBy: { lastActiveAt: "desc" },
  });
  if (!membership) throw new AuthError("Bu hesab heç bir komandaya aid deyil", 403);

  await prisma.teamMembership.update({
    where: { id: membership.id },
    data: { lastActiveAt: new Date() },
  });

  const token = issueSession(user.id, membership.teamId, membership.role);
  return { token, user, teamId: membership.teamId, role: membership.role };
}

// Re-issues a token scoped to a different team the user already belongs to
// — no re-authentication needed, just proof of membership.
export async function switchTeam(userId: string, teamId: string) {
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (!membership) throw new AuthError("Bu komandanın üzvü deyilsiniz", 403);

  await prisma.teamMembership.update({
    where: { id: membership.id },
    data: { lastActiveAt: new Date() },
  });

  const token = issueSession(userId, teamId, membership.role);
  return { token, teamId, role: membership.role };
}

export async function listMyTeams(userId: string) {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { lastActiveAt: "desc" },
  });
  return memberships.map((m) => ({ teamId: m.teamId, teamName: m.team.name, role: m.role }));
}

// Members can always leave; an admin can only leave if another admin remains
// (there's no "promote a member to admin" feature yet, so a sole admin
// leaving would strand the team with nobody able to manage it). Leaving your
// only team is blocked too — join/create another first — so a session never
// ends up in a teamless, unusable state.
export async function leaveTeam(userId: string, teamId: string) {
  const [membership, teamMemberships] = await Promise.all([
    prisma.teamMembership.findUnique({ where: { userId_teamId: { userId, teamId } } }),
    prisma.teamMembership.findMany({ where: { teamId } }),
  ]);
  if (!membership) throw new AuthError("Bu komandanın üzvü deyilsiniz", 403);

  const myTeamCount = await prisma.teamMembership.count({ where: { userId } });
  if (myTeamCount <= 1) {
    throw new AuthError("Bu sizin son komandanızdır — tərk etməzdən əvvəl başqa bir komandaya qoşulun və ya yeni yaradın", 400);
  }

  if (membership.role === "ADMIN") {
    const otherAdmins = teamMemberships.filter((m) => m.role === "ADMIN" && m.userId !== userId);
    if (otherAdmins.length === 0) {
      throw new AuthError("Bu komandanın yeganə adminisiniz, tərk edə bilməzsiniz", 400);
    }
  }

  await prisma.teamMembership.delete({ where: { id: membership.id } });

  // Land back on whatever team is now most-recently-active for this user.
  const next = await prisma.teamMembership.findFirst({
    where: { userId },
    orderBy: { lastActiveAt: "desc" },
  });
  const token = issueSession(userId, next!.teamId, next!.role);
  return { token, teamId: next!.teamId, role: next!.role };
}

// Permanent, whole-team deletion — distinct from leaveTeam (which only
// removes the caller). Re-checks the role against the DB rather than
// trusting the caller's JWT (whose role/teamId reflect whatever team is
// CURRENTLY active, which may not be the team being deleted) — this is
// destructive enough to be worth the extra query. Only TeamMembership and
// Project cascade automatically from Team in the schema; Invite/Task/Column
// don't, so they're deleted explicitly, in dependency order, inside one
// transaction (Task first — its own cascades take Comment/Attachment/
// TaskActivity/TaskDependency with it — then Column, which Task referenced).
export async function deleteTeam(userId: string, teamId: string) {
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (!membership) throw new AuthError("Bu komandanın üzvü deyilsiniz", 403);
  if (membership.role !== "ADMIN") {
    throw new AuthError("Yalnız admin komandanı silə bilər", 403);
  }

  const myTeamCount = await prisma.teamMembership.count({ where: { userId } });
  if (myTeamCount <= 1) {
    throw new AuthError(
      "Bu sizin yeganə komandanızdır — silmək əvəzinə əvvəlcə başqa bir komandaya qoşulun və ya yeni yaradın",
      400
    );
  }

  await prisma.$transaction([
    prisma.invite.deleteMany({ where: { teamId } }),
    prisma.task.deleteMany({ where: { teamId } }),
    prisma.column.deleteMany({ where: { teamId } }),
    prisma.team.delete({ where: { id: teamId } }),
  ]);

  const next = await prisma.teamMembership.findFirst({
    where: { userId },
    orderBy: { lastActiveAt: "desc" },
  });
  const token = issueSession(userId, next!.teamId, next!.role);
  return { token, teamId: next!.teamId, role: next!.role };
}

// Admin promotes a MEMBER to MENTOR, or demotes a MENTOR back to MEMBER —
// deliberately restricted to just these two roles (see setMemberRoleSchema
// in @team-tracker/shared) so this can't be used as a backdoor to mint a
// second admin. The route calling this already gates on requireAdmin.
export async function setMemberRole(teamId: string, targetUserId: string, newRole: "MENTOR" | "MEMBER") {
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: targetUserId, teamId } },
  });
  if (!membership) throw new AuthError("Bu komandanın üzvü deyil", 404);
  if (membership.role === "ADMIN") {
    throw new AuthError("Admin rolü buradan dəyişdirilə bilməz", 400);
  }

  const updated = await prisma.teamMembership.update({
    where: { id: membership.id },
    data: { role: newRole },
    include: { user: true },
  });
  return toPublicUser(updated.user, teamId, updated.role);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("User not found", 404);
  return user;
}

export async function updateProfile(
  userId: string,
  input: { displayName?: string; avatarUrl?: string | null; onboardingSeen?: true }
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      ...(input.onboardingSeen && { onboardingSeenAt: new Date() }),
    },
  });
}

export function toPublicUser(
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    onboardingSeenAt: Date | null;
    createdAt: Date;
  },
  teamId: string,
  role: Role
) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    onboardingSeenAt: user.onboardingSeenAt ? user.onboardingSeenAt.toISOString() : null,
    teamId,
    role,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function createInvite(teamId: string, createdById: string, expiresInDays?: number) {
  const code = crypto.randomBytes(5).toString("hex"); // 10-char code
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  return prisma.invite.create({
    data: { teamId, createdById, code, expiresAt },
  });
}
