import { prisma } from "../db";
import type { Message } from "@prisma/client";

export function toPublicMessage(message: Message) {
  return {
    id: message.id,
    teamId: message.teamId,
    authorId: message.authorId,
    toUserId: message.toUserId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function listTeamMessages(teamId: string) {
  return prisma.message.findMany({ where: { teamId, toUserId: null }, orderBy: { createdAt: "asc" } });
}

export async function createTeamMessage(teamId: string, authorId: string, body: string) {
  return prisma.message.create({ data: { teamId, authorId, body } });
}

// Messages exchanged between exactly these two users, in either direction —
// there's no separate "conversation" row, a DM is just any Message where
// {author, toUser} is this pair in some order.
export async function listDirectMessages(teamId: string, userAId: string, userBId: string) {
  return prisma.message.findMany({
    where: {
      teamId,
      OR: [
        { authorId: userAId, toUserId: userBId },
        { authorId: userBId, toUserId: userAId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createDirectMessage(teamId: string, authorId: string, toUserId: string, body: string) {
  return prisma.message.create({ data: { teamId, authorId, toUserId, body } });
}
