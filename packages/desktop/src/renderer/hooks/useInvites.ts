import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

interface InviteResponse {
  invite: { code: string; expiresAt: string | null };
}

export function useCreateInvite(teamId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<InviteResponse>(`/api/v1/teams/${teamId}/invites`, {
        method: "POST",
        body: {},
      }),
  });
}
