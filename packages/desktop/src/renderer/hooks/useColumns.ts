import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Column } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useColumns(teamId: string) {
  return useQuery({
    queryKey: ["columns", teamId],
    queryFn: () => apiFetch<{ columns: Column[] }>(`/api/v1/teams/${teamId}/columns`),
    select: (res) => res.columns,
  });
}

export function useCreateColumn(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; afterColumnId?: string | null }) =>
      apiFetch<{ column: Column }>(`/api/v1/teams/${teamId}/columns`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columns", teamId] }),
  });
}

export function useReorderColumn(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, afterColumnId }: { columnId: string; afterColumnId: string | null }) =>
      apiFetch<{ columns: Column[] }>(`/api/v1/teams/${teamId}/columns/${columnId}/reorder`, {
        method: "PATCH",
        body: { afterColumnId },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columns", teamId] }),
  });
}
