import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMessages, useSendMessage, useDirectMessages, useSendDirectMessage } from "../hooks/useMessages";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { useUiStore } from "../store/uiStore";
import { useMutedUsersStore } from "../store/mutedUsersStore";
import { useChatUnreadStore, formatBadgeCount } from "../store/chatUnreadStore";
import { formatShortDateTime } from "../lib/formatDate";
import { ApiError } from "../api/client";
import { useT } from "../i18n/useT";
import Avatar from "./Avatar";

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const teamId = user?.teamId;
  const { data: members } = useTeamMembers(teamId ?? "");
  const activeThread = useUiStore((s) => s.activeChatThread);
  const setActiveThread = useUiStore((s) => s.setActiveChatThread);
  const isMuted = useMutedUsersStore((s) => s.isMuted);
  const toggleMute = useMutedUsersStore((s) => s.toggleMute);
  const unreadByUser = useChatUnreadStore((s) => s.unreadByUser);
  const clearTeamUnread = useChatUnreadStore((s) => s.clearTeam);
  const clearUserUnread = useChatUnreadStore((s) => s.clearUser);
  // Mute/etiketlə/DM are all available from a member's profile menu, but
  // muting is admin/mentor-only by design — a plain member can still
  // mention or DM anyone, just not silence them.
  const canModerate = user?.role === "ADMIN" || user?.role === "MENTOR";

  const isDm = activeThread !== "team";
  const dmPartnerId = isDm ? activeThread : undefined;

  const teamMessages = useMessages(teamId);
  const dmMessages = useDirectMessages(teamId, dmPartnerId);
  const { data: messages, isLoading, isError } = isDm ? dmMessages : teamMessages;

  const sendTeamMessage = useSendMessage(teamId);
  const sendDirectMessage = useSendDirectMessage(teamId, dmPartnerId);
  const sendMessage = isDm ? sendDirectMessage : sendTeamMessage;

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menuForUserId, setMenuForUserId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const membersById = new Map((members ?? []).map((m) => [m.id, m]));
  const otherMembers = (members ?? []).filter((m) => m.id !== user?.id);
  const menuMember = menuForUserId ? membersById.get(menuForUserId) : undefined;
  const dmPartner = dmPartnerId ? membersById.get(dmPartnerId) : undefined;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages?.length, activeThread]);

  useEffect(() => {
    setError(null);
  }, [activeThread]);

  // Entering a thread (opening the panel onto it, or switching to it) is
  // what "read" means here — see chatUnreadStore's comment.
  useEffect(() => {
    if (activeThread === "team") clearTeamUnread();
    else clearUserUnread(activeThread);
  }, [activeThread, clearTeamUnread, clearUserUnread]);

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

  function handleMention(member: { id: string; displayName: string }) {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}@${member.displayName} `);
    setMenuForUserId(null);
    inputRef.current?.focus();
  }

  function handleOpenDm(member: { id: string }) {
    setActiveThread(member.id);
    setMenuForUserId(null);
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
          gap: 8,
          padding: "14px 64px 14px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {isDm && (
            <button
              type="button"
              onClick={() => setActiveThread("team")}
              aria-label={t("common.close")}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--muted)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h3
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: 15,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isDm ? dmPartner?.displayName ?? t("common.deletedUser") : t("chat.title")}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary"
          style={{ width: "auto", padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
        >
          {t("common.close")}
        </button>
      </div>

      {!isDm && (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          {otherMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMenuForUserId(m.id)}
              title={m.displayName}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
                opacity: isMuted(user!.id, m.id) ? 0.4 : 1,
                position: "relative",
              }}
            >
              <Avatar displayName={m.displayName} avatarUrl={m.avatarUrl} size={30} />
              {(unreadByUser[m.id] ?? 0) > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    minWidth: 15,
                    height: 15,
                    padding: "0 3px",
                    borderRadius: 8,
                    background: "var(--priority-high-ink)",
                    color: "white",
                    fontSize: 9.5,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {formatBadgeCount(unreadByUser[m.id])}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {menuMember && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--paper)",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginRight: 2 }}>
            {menuMember.displayName}
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
            onClick={() => handleMention(menuMember)}
          >
            {t("chat.mention")}
          </button>
          {canModerate && (
            <button
              type="button"
              className="btn-secondary"
              style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
              onClick={() => toggleMute(user!.id, menuMember.id)}
            >
              {isMuted(user!.id, menuMember.id) ? t("chat.unmute") : t("chat.mute")}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
            onClick={() => handleOpenDm(menuMember)}
          >
            {t("chat.directMessage")}
          </button>
          <button
            type="button"
            onClick={() => setMenuForUserId(null)}
            aria-label={t("common.close")}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 13,
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>
      )}

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
          ref={inputRef}
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
