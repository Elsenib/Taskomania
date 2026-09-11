import { useQuery } from "@tanstack/react-query";
import type { TaskActivity } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: ["taskActivity", taskId],
    queryFn: () => apiFetch<{ activity: TaskActivity[] }>(`/api/v1/tasks/${taskId}/activity`),
    select: (res) => res.activity,
    enabled: Boolean(taskId),
  });
}
