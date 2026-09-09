import { prisma } from "../db";
import type { Comment } from "@prisma/client";

export function toPublicComment(comment: Comment) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function listComments(taskId: string) {
  return prisma.comment.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } });
}

export async function createComment(taskId: string, authorId: string, body: string) {
  return prisma.comment.create({ data: { taskId, authorId, body } });
}
