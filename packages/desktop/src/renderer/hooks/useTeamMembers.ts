import { useQuery } from "@tanstack/react-query";
import type { User } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ["members", teamId],
    queryFn: () => apiFetch<{ members: User[] }>(`/api/v1/teams/${teamId}/members`),
    select: (res) => res.members,
  });
}
