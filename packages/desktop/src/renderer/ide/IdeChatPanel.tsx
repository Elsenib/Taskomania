import { FormEvent, useEffect, useRef, useState } from "react";
import type { Message, User } from "@team-tracker/shared";

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 9,
        background: "var(--priority-high-ink)",
        color: "white",
        fontSize: 10.5,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Team chat inside the IDE window. Unlike the Board's ChatPanel, this never
// talks to the API or a socket directly — the IDE renderer never holds the
// JWT (see main/ide/taskContext.ts's comment); every call here goes through
// ideAPI.chat* (main/ide/chatHandlers.ts), which makes the authenticated
// request from the main process and hands back plain data.
//
// Default view is the contact list (DMs first), not the team feed — this
// window is where you're heads-down in code, so a private "@sən kömək
// laz'ımdır?" ping to one person is the expected use, with the team-wide
// thread one tap away rather than the default.
export default function IdeChatPanel({ onClose }: { onClose: () => void }) {
  const [members, setMembers] = useState<User[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<"team" | string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadTeam, setUnreadTeam] = useState(0);
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.ideAPI?.chatGetCurrentUserId().then(setCurrentUserId).catch(() => {});
    window.ideAPI
      ?.chatListMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    return window.ideAPI?.onChatMessage((message) => {
      const belongsToThread =
        activeThread === "team"
          ? !message.toUserId
          : message.toUserId &&
            (message.authorId === activeThread || message.toUserId === activeThread) &&
            (message.authorId === currentUserId || message.toUserId === currentUserId);

      if (belongsToThread) {
        setMessages((old) => {
          if (!old) return old;
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        });
        return;
      }

      // Doesn't belong to whatever's open right now (or nothing's open) —
      // bump that thread's badge instead. Never for my own messages, and
      // never for a DM I'm not part of (a push I'd only get if I were).
      if (message.authorId === currentUserId) return;
      if (!message.toUserId) {
        setUnreadTeam((n) => n + 1);
      } else {
        const otherUserId = message.authorId === currentUserId ? message.toUserId : message.authorId;
        setUnreadByUser((old) => ({ ...old, [otherUserId]: (old[otherUserId] ?? 0) + 1 }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread, currentUserId]);

  // Entering a thread is "read" — same convention as the Board's ChatPanel.
  useEffect(() => {
    if (activeThread === "team") setUnreadTeam(0);
    else if (activeThread) setUnreadByUser((old) => ({ ...old, [activeThread]: 0 }));
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;
    setLoading(true);
    setError(null);
    const load =
      activeThread === "team"
        ? window.ideAPI?.chatListTeamMessages()
        : window.ideAPI?.chatListDirectMessages(activeThread);
    load
      ?.then(setMessages)
      .catch(() => setError("Mesajlar yüklənə bilmədi"))
      .finally(() => setLoading(false));
  }, [activeThread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages?.length]);

  const membersById = new Map((members ?? []).map((m) => [m.id, m]));
  const otherMembers = (members ?? []).filter((m) => m.id !== currentUserId);
  const dmPartner = activeThread && activeThread !== "team" ? membersById.get(activeThread) : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !activeThread) return;
    setSending(true);
    setError(null);
    try {
      const message =
        activeThread === "team"
          ? await window.ideAPI?.chatSendTeamMessage(trimmed)
          : await window.ideAPI?.chatSendDirectMessage(activeThread, trimmed);
      if (message) {
        setMessages((old) => {
          if (!old) return [message];
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        });
      }
      setBody("");
    } catch {
      setError("Mesaj göndərilə bilmədi");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        maxWidth: "100vw",
        background: "var(--card)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
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
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {activeThread && (
            <button
              type="button"
              onClick={() => setActiveThread(null)}
              style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 2 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h3
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: 14,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeThread === "team"
              ? "Komanda söhbəti"
              : dmPartner
                ? dmPartner.displayName
                : "Söhbət"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary"
          style={{ width: "auto", padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
        >
          Bağla
        </button>
      </div>

      {!activeThread && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <button
            type="button"
            onClick={() => setActiveThread("team")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              border: "none",
              borderBottom: "1px solid var(--border)",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              font: "inherit",
              color: "var(--ink)",
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              #
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Komanda söhbəti</span>
            {unreadTeam > 0 && <UnreadBadge count={unreadTeam} />}
          </button>

          {otherMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveThread(m.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                border: "none",
                borderBottom: "1px solid var(--border)",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                color: "var(--ink)",
              }}
            >
              {m.avatarUrl ? (
                <img
                  src={m.avatarUrl}
                  alt=""
                  style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {m.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{m.displayName}</span>
              {(unreadByUser[m.id] ?? 0) > 0 && <UnreadBadge count={unreadByUser[m.id]} />}
            </button>
          ))}

          {members !== null && otherMembers.length === 0 && (
            <div style={{ padding: 14, fontSize: 12.5, color: "var(--muted)" }}>
              Komandada başqa üzv yoxdur.
            </div>
          )}
        </div>
      )}

      {activeThread && (
        <>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
            {loading && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Yüklənir...</div>}
            {!loading && messages && messages.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Hələ heç bir mesaj yoxdur.</div>
            )}
            {messages?.map((m) => {
              const author = membersById.get(m.authorId);
              const mine = m.authorId === currentUserId;
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: mine ? "row-reverse" : "row",
                    gap: 8,
                    marginBottom: 10,
                    alignItems: "flex-end",
                  }}
                >
                  {!mine &&
                    (author?.avatarUrl ? (
                      <img
                        src={author.avatarUrl}
                        alt=""
                        style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {(author?.displayName ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                  <div style={{ minWidth: 0, maxWidth: "78%" }}>
                    {!mine && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>
                        {author?.displayName ?? "Silinmiş istifadəçi"}
                      </div>
                    )}
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 10px",
                        borderRadius: 10,
                        fontSize: 13,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        background: mine ? "var(--accent)" : "var(--paper-panel)",
                        color: mine ? "white" : "var(--ink)",
                        textAlign: "left",
                      }}
                    >
                      {m.body}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div style={{ fontSize: 11.5, color: "var(--priority-high-ink)", padding: "0 14px 6px" }}>{error}</div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--border)", flexShrink: 0 }}
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Mesaj yaz..."
              style={{
                flex: 1,
                padding: "7px 2px",
                border: "none",
                borderBottom: "1px solid var(--border)",
                background: "transparent",
                fontSize: 13,
                color: "var(--ink)",
              }}
            />
            <button
              type="submit"
              disabled={!body.trim() || sending}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--accent)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                opacity: !body.trim() || sending ? 0.5 : 1,
              }}
            >
              Göndər
            </button>
          </form>
        </>
      )}
    </div>
  );
}
