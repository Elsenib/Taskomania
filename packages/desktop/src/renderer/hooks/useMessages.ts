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

export function useDirectMessages(teamId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ["directMessages", teamId, otherUserId],
    queryFn: () =>
      apiFetch<{ messages: Message[] }>(`/api/v1/teams/${teamId}/messages/dm/${otherUserId}`),
    select: (res) => res.messages,
    enabled: Boolean(teamId) && Boolean(otherUserId),
  });
}

export function useSendDirectMessage(teamId: string | undefined, otherUserId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ message: Message }>(`/api/v1/teams/${teamId}/messages/dm/${otherUserId}`, {
        method: "POST",
        body: { body },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["directMessages", teamId, otherUserId] }),
  });
}
