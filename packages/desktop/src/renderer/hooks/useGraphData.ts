import { useQuery } from "@tanstack/react-query";
import type { GraphData } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useGraphData(teamId: string) {
  return useQuery({
    queryKey: ["graph", teamId],
    queryFn: () => apiFetch<GraphData>(`/api/v1/teams/${teamId}/graph`),
  });
}
