import { useQuery } from "@tanstack/react-query";
import type { MemberProfile, MemberStats } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useMemberProfile(teamId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["memberProfile", teamId, userId],
    queryFn: () => apiFetch<{ profile: MemberProfile }>(`/api/v1/teams/${teamId}/members/${userId}/profile`),
    select: (res) => res.profile,
    enabled: Boolean(userId),
  });
}

export function useTeamStats(teamId: string) {
  return useQuery({
    queryKey: ["teamStats", teamId],
    queryFn: () => apiFetch<{ stats: MemberStats[] }>(`/api/v1/teams/${teamId}/stats`),
    select: (res) => res.stats,
  });
}
