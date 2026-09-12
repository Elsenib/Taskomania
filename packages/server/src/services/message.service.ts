import { prisma } from "../db";
import type { Message } from "@prisma/client";

export function toPublicMessage(message: Message) {
  return {
    id: message.id,
    teamId: message.teamId,
    authorId: message.authorId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function listMessages(teamId: string) {
  return prisma.message.findMany({ where: { teamId }, orderBy: { createdAt: "asc" } });
}

export async function createMessage(teamId: string, authorId: string, body: string) {
  return prisma.message.create({ data: { teamId, authorId, body } });
}
