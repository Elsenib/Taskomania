import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskDependency } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: ["dependencies", taskId],
    queryFn: () => apiFetch<{ dependencies: TaskDependency[] }>(`/api/v1/tasks/${taskId}/dependencies`),
    select: (res) => res.dependencies,
    enabled: Boolean(taskId),
  });
}

export function useCreateDependency(taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockedTaskId: string) =>
      apiFetch<{ dependency: TaskDependency }>(`/api/v1/tasks/${taskId}/dependencies`, {
        method: "POST",
        body: { blockedTaskId },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["dependencies", taskId] });
      queryClient.invalidateQueries({ queryKey: ["dependencies", res.dependency.blockedTaskId] });
    },
  });
}

// Only invalidates the currently-open task's own list. If the other side of
// the link is open in someone else's window, the "dependency:deleted" socket
// event (see useRealtimeSync) patches theirs — see Phase 4 of the plan.
export function useDeleteDependency(taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependencyId: string) =>
      apiFetch<void>(`/api/v1/dependencies/${dependencyId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dependencies", taskId] }),
  });
}
