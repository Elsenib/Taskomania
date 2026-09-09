import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, createTaskSchema, updateTaskSchema } from "@team-tracker/shared";
import type { z } from "zod";
import { apiFetch } from "../api/client";

type CreateTaskInput = z.infer<typeof createTaskSchema>;
type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// Lets useRealtimeSync tell "I just changed this task myself" apart from "a
// teammate changed it" — the task:updated broadcast carries no actor field,
// so without this, self-assigning via "Götür" would notify you about your
// own action. Entries expire quickly; this only needs to cover the window
// between the mutation firing and its own socket echo arriving.
const recentlyMutatedByMe = new Map<string, number>();
const SELF_MUTATION_WINDOW_MS = 4000;

export function wasRecentlyMutatedByMe(taskId: string): boolean {
  const at = recentlyMutatedByMe.get(taskId);
  if (at === undefined) return false;
  if (Date.now() - at > SELF_MUTATION_WINDOW_MS) {
    recentlyMutatedByMe.delete(taskId);
    return false;
  }
  return true;
}

function markMutatedByMe(taskId: string) {
  recentlyMutatedByMe.set(taskId, Date.now());
}

export function useTasks(teamId: string) {
  return useQuery({
    queryKey: ["tasks", teamId],
    queryFn: () => apiFetch<{ tasks: Task[] }>(`/api/v1/teams/${teamId}/tasks`),
    select: (res) => res.tasks,
  });
}

export function useCreateTask(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch<{ task: Task }>(`/api/v1/teams/${teamId}/tasks`, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", teamId] }),
  });
}

export function useUpdateTask(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) => {
      markMutatedByMe(taskId);
      return apiFetch<{ task: Task }>(`/api/v1/tasks/${taskId}`, { method: "PATCH", body: input });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", teamId] }),
  });
}

export function useDeleteTask(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiFetch<void>(`/api/v1/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", teamId] }),
  });
}
