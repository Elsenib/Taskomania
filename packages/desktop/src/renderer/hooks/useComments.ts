import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Comment } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => apiFetch<{ comments: Comment[] }>(`/api/v1/tasks/${taskId}/comments`),
    select: (res) => res.comments,
    enabled: Boolean(taskId),
  });
}

export function useCreateComment(taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ comment: Comment }>(`/api/v1/tasks/${taskId}/comments`, {
        method: "POST",
        body: { body },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", taskId] }),
  });
}
