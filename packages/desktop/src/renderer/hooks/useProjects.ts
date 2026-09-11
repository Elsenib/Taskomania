import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

export function useProjects(teamId: string) {
  return useQuery({
    queryKey: ["projects", teamId],
    queryFn: () => apiFetch<{ projects: Project[] }>(`/api/v1/teams/${teamId}/projects`),
    select: (res) => res.projects,
  });
}

export function useCreateProject(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ project: Project }>(`/api/v1/teams/${teamId}/projects`, {
        method: "POST",
        body: { name },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", teamId] }),
  });
}

export function useRenameProject(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      apiFetch<{ project: Project }>(`/api/v1/teams/${teamId}/projects/${projectId}`, {
        method: "PATCH",
        body: { name },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", teamId] }),
  });
}

export function useDeleteProject(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<void>(`/api/v1/teams/${teamId}/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", teamId] });
      // A deleted project's tasks fall back to unlabeled server-side —
      // refresh so cards/filters stop showing the removed tag immediately.
      queryClient.invalidateQueries({ queryKey: ["tasks", teamId] });
    },
  });
}
