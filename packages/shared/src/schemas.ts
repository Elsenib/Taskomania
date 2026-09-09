import { z } from "zod";

export const registerTeamSchema = z.object({
  teamName: z.string().min(2).max(100),
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const joinTeamSchema = z.object({
  inviteCode: z.string().min(4).max(32),
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createTaskSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  columnId: z.string().uuid().optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  order: z.number().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const createInviteSchema = z.object({
  expiresInDays: z.number().int().positive().max(30).optional(),
});

export const createDependencySchema = z.object({
  blockedTaskId: z.string().uuid(),
});

export const createColumnSchema = z.object({
  name: z.string().min(1).max(50),
  // insert immediately after this column; omitted/null = append at the end
  afterColumnId: z.string().uuid().nullable().optional(),
});

export const reorderColumnSchema = z.object({
  // insert the column immediately after this one; null = move to the front.
  // Unlike createColumnSchema's afterColumnId, this is required — a reorder
  // always has an explicit new position, there's no "leave it" default.
  afterColumnId: z.string().uuid().nullable(),
});
