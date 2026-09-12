import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMyTeams, useInvalidateMyTeams } from "../hooks/useTeams";
import { ApiError } from "../api/client";
import { useT } from "../i18n/useT";
import { roleLabel } from "../lib/roleLabel";

type Mode = "list" | "create" | "join" | "delete";

export default function TeamSwitcher() {
  const t = useT();
  const { user, switchTeam, createAdditionalTeam, joinAdditionalTeam, leaveTeam, deleteTeam } = useAuth();
  const { data: teams } = useMyTeams();
  const invalidateMyTeams = useInvalidateMyTeams();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("list");
        setError(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!user) return null;
  const currentTeam = teams?.find((tm) => tm.teamId === user.teamId);

  async function handleSwitch(teamId: string) {
    if (teamId === user!.teamId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await switchTeam(teamId);
      await invalidateMyTeams();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("teamSwitcher.switchFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!teamName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAdditionalTeam(teamName.trim());
      await invalidateMyTeams();
      setTeamName("");
      setMode("list");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("teamSwitcher.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await joinAdditionalTeam(inviteCode.trim());
      await invalidateMyTeams();
      setInviteCode("");
      setMode("list");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("teamSwitcher.joinFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    setError(null);
    try {
      await leaveTeam(user!.teamId);
      await invalidateMyTeams();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("teamSwitcher.leaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmText.trim() !== currentTeam?.teamName) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTeam(user!.teamId);
      await invalidateMyTeams();
      setDeleteConfirmText("");
      setMode("list");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("teamSwitcher.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn-secondary"
        style={{ width: "auto", padding: "5px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
        </svg>
        {currentTeam?.teamName ?? "..."}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 260,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            padding: 10,
            zIndex: 50,
          }}
        >
          {error && <div className="form-error" style={{ marginBottom: 8 }}>{error}</div>}

          {mode === "list" && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--muted)", padding: "2px 6px 6px" }}>
                {t("teamSwitcher.myTeams")}
              </div>
              {(teams ?? []).map((tm) => (
                <button
                  key={tm.teamId}
                  type="button"
                  disabled={busy}
                  onClick={() => handleSwitch(tm.teamId)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "7px 6px",
                    border: "none",
                    borderRadius: 6,
                    background: tm.teamId === user.teamId ? "var(--accent-paper)" : "transparent",
                    color: "var(--ink)",
                    fontSize: 13,
                    fontWeight: tm.teamId === user.teamId ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tm.teamName}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0, marginLeft: 8 }}>
                    {roleLabel(tm.role, t)}
                  </span>
                </button>
              ))}

              <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

              <button
                type="button"
                onClick={() => setMode("create")}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 6px", border: "none", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {t("teamSwitcher.createTeam")}
              </button>
              <button
                type="button"
                onClick={() => setMode("join")}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 6px", border: "none", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {t("teamSwitcher.joinTeam")}
              </button>

              {(teams?.length ?? 0) > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLeave}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 6px", border: "none", background: "transparent", color: "var(--priority-high-ink)", fontSize: 13, cursor: "pointer" }}
                >
                  {t("teamSwitcher.leaveTeam")}
                </button>
              )}
              {currentTeam?.role === "ADMIN" && (teams?.length ?? 0) > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("delete")}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 6px", border: "none", background: "transparent", color: "var(--priority-high-ink)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {t("teamSwitcher.deleteTeam")}
                </button>
              )}
            </>
          )}

          {mode === "delete" && (
            <div>
              <div style={{ margin: "4px 6px 10px", fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4 }}>
                {t("teamSwitcher.deleteWarning")}
              </div>
              <div className="field" style={{ margin: "4px 6px 8px" }}>
                <label>
                  {t("teamSwitcher.deleteConfirmLabel")} <strong>{currentTeam?.teamName}</strong>
                </label>
                <input
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDelete()}
                />
              </div>
              <div style={{ display: "flex", gap: 6, padding: "0 6px" }}>
                <button
                  className="btn-primary"
                  style={{ width: "auto", flex: 1, background: "var(--priority-high-ink)", borderColor: "var(--priority-high-ink)" }}
                  disabled={busy || deleteConfirmText.trim() !== currentTeam?.teamName}
                  onClick={handleDelete}
                >
                  {t("teamSwitcher.deleteConfirmButton")}
                </button>
                <button
                  className="btn-secondary"
                  style={{ width: "auto", flexShrink: 0 }}
                  onClick={() => {
                    setMode("list");
                    setDeleteConfirmText("");
                  }}
                >
                  {t("teamSwitcher.back")}
                </button>
              </div>
            </div>
          )}

          {mode === "create" && (
            <div>
              <div className="field" style={{ margin: "4px 6px 8px" }}>
                <label>{t("teamSwitcher.teamNameLabel")}</label>
                <input
                  autoFocus
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div style={{ display: "flex", gap: 6, padding: "0 6px" }}>
                <button
                  className="btn-primary"
                  style={{ width: "auto", flex: 1 }}
                  disabled={busy || !teamName.trim()}
                  onClick={handleCreate}
                >
                  {t("teamSwitcher.create")}
                </button>
                <button
                  className="btn-secondary"
                  style={{ width: "auto", flexShrink: 0 }}
                  onClick={() => setMode("list")}
                >
                  {t("teamSwitcher.back")}
                </button>
              </div>
            </div>
          )}

          {mode === "join" && (
            <div>
              <div className="field" style={{ margin: "4px 6px 8px" }}>
                <label>{t("teamSwitcher.inviteCodeLabel")}</label>
                <input
                  autoFocus
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
              <div style={{ display: "flex", gap: 6, padding: "0 6px" }}>
                <button
                  className="btn-primary"
                  style={{ width: "auto", flex: 1 }}
                  disabled={busy || !inviteCode.trim()}
                  onClick={handleJoin}
                >
                  {t("teamSwitcher.join")}
                </button>
                <button
                  className="btn-secondary"
                  style={{ width: "auto", flexShrink: 0 }}
                  onClick={() => setMode("list")}
                >
                  {t("teamSwitcher.back")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
