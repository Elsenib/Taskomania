import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import AuthScreen from "./auth/AuthScreen";
import Board from "./board/Board";
import GraphView from "./graph/GraphView";
import CanvasBrowserScreen from "./canvas/CanvasBrowserScreen";
import InviteModal from "./components/InviteModal";
import StartupAnimation from "./components/StartupAnimation";
import PowerMenu from "./components/PowerMenu";
import Avatar from "./components/Avatar";
import TeamRoster from "./components/TeamRoster";
import TeamSwitcher from "./components/TeamSwitcher";
import ProfileScreen from "./profile/ProfileScreen";
import SettingsScreen from "./settings/SettingsScreen";
import OnboardingModal from "./components/OnboardingModal";
import ChatPanel from "./components/ChatPanel";
import { useT } from "./i18n/useT";
import { roleLabel } from "./lib/roleLabel";
import { useUiStore } from "./store/uiStore";
import ideIcon from "./assets/ide-icon.png";

// Matches startup-animation.mp4's own length — the video should always play
// through in full, never get cut off early just because the backend (often
// woken from a Railway sleep) happened to respond before it finished.
const STARTUP_ANIMATION_MIN_MS = 8000;

export default function App() {
  const { user, loading, connectionError, retryConnection, logout, updateProfile } = useAuth();
  const t = useT();
  const [viewMode, setViewMode] = useState<"board" | "graph" | "canvas" | "profile">("board");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [minAnimationElapsed, setMinAnimationElapsed] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chatOpen = useUiStore((s) => s.chatOpen);
  const openChat = useUiStore((s) => s.openChat);
  const closeChat = useUiStore((s) => s.closeChat);

  // Profile is a full screen (like Graph/Canvas), reachable from anywhere —
  // the roster, your own header button, or a node in the Graph.
  function openProfile(userId: string) {
    setProfileUserId(userId);
    setViewMode("profile");
  }

  useEffect(() => {
    const timer = setTimeout(() => setMinAnimationElapsed(true), STARTUP_ANIMATION_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  let content;

  if (loading || !minAnimationElapsed) {
    content = <StartupAnimation />;
  } else if (connectionError) {
    content = (
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h1>Taskomania</h1>
          <p className="subtitle">{t("app.connectionErrorSubtitle")}</p>
          <div className="form-error">{connectionError}</div>
          <button className="btn-primary" onClick={retryConnection}>
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  } else if (!user) {
    content = <AuthScreen />;
  } else if (viewMode === "graph") {
    content = (
      <div className="app-shell">
        <GraphView teamId={user.teamId} onExit={() => setViewMode("board")} onOpenProfile={openProfile} />
      </div>
    );
  } else if (viewMode === "canvas") {
    content = (
      <div className="app-shell">
        <CanvasBrowserScreen teamId={user.teamId} onExit={() => setViewMode("board")} />
      </div>
    );
  } else if (viewMode === "profile" && profileUserId) {
    content = (
      <div className="app-shell">
        <ProfileScreen teamId={user.teamId} userId={profileUserId} onClose={() => setViewMode("board")} />
      </div>
    );
  } else {
    content = (
      <div className="app-shell">
        <header className="app-header">
          <h2>Taskomania</h2>
          <TeamSwitcher />
          <TeamRoster teamId={user.teamId} viewerRole={user.role} onSelect={openProfile} />
          <div className="user-info">
            <button
              type="button"
              onClick={() => openProfile(user.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--ink)",
                font: "inherit",
              }}
            >
              <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} />
              {user.displayName} ({roleLabel(user.role, t)})
            </button>
            {user.role === "ADMIN" && (
              <button
                className="btn-secondary"
                style={{ width: "auto", marginLeft: 12, padding: "5px 12px", fontSize: 12 }}
                onClick={() => setInviteOpen(true)}
              >
                {t("nav.invite")}
              </button>
            )}
            <button
              className="btn-secondary"
              style={{ width: "auto", marginLeft: 8, padding: "5px 12px", fontSize: 12 }}
              onClick={() => setViewMode("graph")}
            >
              {t("nav.graph")}
            </button>
            <button
              className="btn-secondary"
              title={t("canvas.navTitle")}
              aria-label={t("canvas.navTitle")}
              style={{ width: "auto", marginLeft: 8, padding: "5px 8px", display: "flex" }}
              onClick={() => setViewMode("canvas")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </button>
            <button
              className="btn-secondary"
              title={t("nav.ide")}
              aria-label={t("nav.ide")}
              style={{
                width: 27,
                height: 27,
                marginLeft: 8,
                padding: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => window.teamTracker.openIde()}
            >
              <img
                src={ideIcon}
                alt=""
                style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
              />
            </button>
            <button
              className="btn-secondary"
              title={t("nav.chat")}
              aria-label={t("nav.chat")}
              style={{ width: "auto", marginLeft: 8, padding: "5px 8px", display: "flex" }}
              onClick={() => (chatOpen ? closeChat() : openChat())}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              className="btn-secondary"
              title={t("nav.settings")}
              aria-label={t("nav.settings")}
              style={{ width: "auto", marginLeft: 8, padding: "5px 8px", display: "flex" }}
              onClick={() => setSettingsOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              className="btn-secondary"
              style={{ width: "auto", marginLeft: 8, padding: "5px 12px", fontSize: 12 }}
              onClick={logout}
            >
              {t("nav.logout")}
            </button>
          </div>
        </header>
        <Board teamId={user.teamId} />
        {inviteOpen && <InviteModal teamId={user.teamId} onClose={() => setInviteOpen(false)} />}
        {settingsOpen && <SettingsScreen onClose={() => setSettingsOpen(false)} />}
        {chatOpen && <ChatPanel onClose={closeChat} />}
      </div>
    );
  }

  return (
    <>
      {content}
      {user && !user.onboardingSeenAt && (
        <OnboardingModal
          confirmLabel={t("onboarding.confirm")}
          onClose={() => updateProfile({ onboardingSeen: true })}
        />
      )}
      <PowerMenu />
    </>
  );
}
