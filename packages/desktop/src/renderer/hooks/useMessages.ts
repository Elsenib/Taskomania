import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useMessages(teamId: string | undefined) {
  return useQuery({
    queryKey: ["messages", teamId],
    queryFn: () => apiFetch<{ messages: Message[] }>(`/api/v1/teams/${teamId}/messages`),
    select: (res) => res.messages,
    enabled: Boolean(teamId),
  });
}

export function useSendMessage(teamId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ message: Message }>(`/api/v1/teams/${teamId}/messages`, {
        method: "POST",
        body: { body },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", teamId] }),
  });
}
