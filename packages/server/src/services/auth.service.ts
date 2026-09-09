import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../db";
import { signToken } from "../middleware/auth";
import type { registerTeamSchema, joinTeamSchema, loginSchema } from "@team-tracker/shared";
import type { z } from "zod";

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"];

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function registerTeam(input: z.infer<typeof registerTeamSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Email already in use", 409);

  const passwordHash = await bcrypt.hash(input.password, 10);

  const { team, user } = await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { name: input.teamName } });

    await tx.column.createMany({
      data: DEFAULT_COLUMNS.map((name, i) => ({ teamId: team.id, name, order: i })),
    });

    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        teamId: team.id,
        role: "ADMIN",
      },
    });

    return { team, user };
  });

  const token = signToken({ userId: user.id, teamId: team.id, role: "ADMIN" });
  return { token, user };
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

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      teamId: invite.teamId,
      role: "MEMBER",
    },
  });

  const token = signToken({ userId: user.id, teamId: user.teamId, role: "MEMBER" });
  return { token, user };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AuthError("Invalid email or password", 401);

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AuthError("Invalid email or password", 401);

  const token = signToken({ userId: user.id, teamId: user.teamId, role: user.role });
  return { token, user };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("User not found", 404);
  return user;
}

export function toPublicUser(user: {
  id: string;
  email: string;
  displayName: string;
  teamId: string;
  role: "ADMIN" | "MEMBER";
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    teamId: user.teamId,
    role: user.role,
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
