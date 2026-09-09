import { FormEvent, useState } from "react";
import type { User } from "@team-tracker/shared";
import { useComments, useCreateComment } from "../hooks/useComments";
import { formatShortDateTime } from "../lib/formatDate";
import { ApiError } from "../api/client";

export default function CommentThread({ taskId, members }: { taskId: string; members: User[] }) {
  const { data: comments, isLoading, isError } = useComments(taskId);
  const createComment = useCreateComment(taskId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const membersById = new Map(members.map((m) => [m.id, m]));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await createComment.mutateAsync(trimmed);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şərh göndərilmədi");
    }
  }

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Şərhlər</div>

      {isLoading && <div style={{ fontSize: 13, color: "var(--muted)" }}>Yüklənir...</div>}

      {isError && (
        <div style={{ fontSize: 13, color: "var(--priority-high-ink)", marginBottom: 12 }}>
          Şərhləri yükləmək alınmadı.
        </div>
      )}

      {!isLoading && !isError && comments && comments.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Hələ şərh yoxdur.
        </div>
      )}

      {comments && comments.length > 0 && (
        <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 14 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  {membersById.get(c.authorId)?.displayName ?? "Silinmiş istifadəçi"}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatShortDateTime(c.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{c.body}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "var(--priority-high-ink)", marginBottom: 8 }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Şərh yaz..."
          style={{
            flex: 1,
            padding: "8px 2px",
            border: "none",
            borderBottom: "1px solid var(--border)",
            background: "transparent",
            fontSize: 13,
            color: "var(--ink)",
          }}
        />
        <button
          type="submit"
          disabled={!body.trim() || createComment.isPending}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            opacity: !body.trim() || createComment.isPending ? 0.5 : 1,
          }}
        >
          Göndər
        </button>
      </form>
    </div>
  );
}
