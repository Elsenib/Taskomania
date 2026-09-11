import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Attachment, AttachmentKind, FileTreeNode } from "@team-tracker/shared";
import { apiFetch } from "../api/client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["attachments", taskId],
    queryFn: () => apiFetch<{ attachments: Attachment[] }>(`/api/v1/tasks/${taskId}/attachments`),
    select: (res) => res.attachments,
    enabled: Boolean(taskId),
  });
}

// All design-canvas attachments across the whole team — the canvas browser
// filters this client-side by uploadedById to show one member's canvas at a
// time, rather than fetching per-member (avoids N+1 requests when switching).
export function useTeamAttachments(teamId: string) {
  return useQuery({
    queryKey: ["teamAttachments", teamId],
    queryFn: () => apiFetch<{ attachments: Attachment[] }>(`/api/v1/teams/${teamId}/attachments`),
    select: (res) => res.attachments,
  });
}

export function useUploadAttachment(taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: AttachmentKind }) => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file, file.name);
      return apiFetch<{ attachment: Attachment }>(`/api/v1/tasks/${taskId}/attachments`, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments", taskId] }),
  });
}

export function useDeleteAttachment(taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch<void>(`/api/v1/attachments/${attachmentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments", taskId] }),
  });
}

// Content-serving URLs deliberately carry the attachment's accessToken instead
// of a JWT — they're loaded via <iframe>/<img src> and relative asset refs
// inside previewed HTML, none of which can attach an Authorization header.
// See docs/ARCHITECTURE.md.
export function attachmentContentUrl(attachment: Attachment, subPath = ""): string {
  const base = `${API_URL}/api/v1/attachments/${attachment.id}/${attachment.accessToken}/content`;
  return subPath ? `${base}/${subPath}` : base;
}

export function useAttachmentTree(attachment: Attachment | null) {
  return useQuery({
    queryKey: ["attachment-tree", attachment?.id],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/api/v1/attachments/${attachment!.id}/${attachment!.accessToken}/tree`
      );
      if (!res.ok) throw new Error("Failed to load file tree");
      return res.json() as Promise<{ tree: FileTreeNode[] }>;
    },
    select: (res) => res.tree,
    enabled: Boolean(attachment && attachment.kind === "ARCHIVE"),
  });
}
