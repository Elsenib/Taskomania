import { useQuery } from "@tanstack/react-query";
import type { TeamActivityEntry } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

// Admin-only audit feed — the endpoint itself enforces that, this hook just
// fetches it (only mounted from the Settings admin panel).
export function useTeamActivity(teamId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["teamActivity", teamId],
    queryFn: () => apiFetch<{ activity: TeamActivityEntry[] }>(`/api/v1/teams/${teamId}/activity`),
    select: (res) => res.activity,
    enabled,
  });
}
