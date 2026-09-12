import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMessages, useSendMessage } from "../hooks/useMessages";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { formatShortDateTime } from "../lib/formatDate";
import { ApiError } from "../api/client";
import { useT } from "../i18n/useT";
import Avatar from "./Avatar";

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const teamId = user?.teamId;
  const { data: members } = useTeamMembers(teamId ?? "");
  const { data: messages, isLoading, isError } = useMessages(teamId);
  const sendMessage = useSendMessage(teamId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const membersById = new Map((members ?? []).map((m) => [m.id, m]));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages?.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await sendMessage.mutateAsync(trimmed);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("chat.sendFailed"));
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 340,
        maxWidth: "100vw",
        background: "var(--card)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        zIndex: 90,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>{t("chat.title")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary"
          style={{ width: "auto", padding: "4px 10px", fontSize: 12 }}
        >
          {t("common.close")}
        </button>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {isLoading && <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>}

        {isError && (
          <div style={{ fontSize: 13, color: "var(--priority-high-ink)" }}>{t("chat.loadError")}</div>
        )}

        {!isLoading && !isError && messages && messages.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("chat.empty")}</div>
        )}

        {messages?.map((m) => {
          const author = membersById.get(m.authorId);
          return (
            <div key={m.id} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <Avatar displayName={author?.displayName ?? t("common.deletedUser")} avatarUrl={author?.avatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {author?.displayName ?? t("common.deletedUser")}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatShortDateTime(m.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "var(--priority-high-ink)", padding: "0 16px 8px" }}>{error}</div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("chat.placeholder")}
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
          disabled={!body.trim() || sendMessage.isPending}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            opacity: !body.trim() || sendMessage.isPending ? 0.5 : 1,
          }}
        >
          {t("common.send")}
        </button>
      </form>
    </div>
  );
}
