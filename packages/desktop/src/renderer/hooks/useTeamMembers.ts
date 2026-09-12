import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ["members", teamId],
    queryFn: () => apiFetch<{ members: User[] }>(`/api/v1/teams/${teamId}/members`),
    select: (res) => res.members,
  });
}

// Promote a MEMBER to MENTOR, or demote a MENTOR back to MEMBER — admin-only
// (enforced server-side; this hook doesn't gate on role itself).
export function useSetMemberRole(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "MENTOR" | "MEMBER" }) =>
      apiFetch<{ member: User }>(`/api/v1/teams/${teamId}/members/${userId}/role`, {
        method: "PATCH",
        body: { role },
      }),
    onSuccess: (_res, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["members", teamId] });
      queryClient.invalidateQueries({ queryKey: ["memberProfile", teamId, userId] });
    },
  });
}
