import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import AuthScreen from "./auth/AuthScreen";
import Board from "./board/Board";
import GraphView from "./graph/GraphView";
import InviteModal from "./components/InviteModal";
import StartupAnimation from "./components/StartupAnimation";
import PowerMenu from "./components/PowerMenu";

// Matches startup-animation.mp4's own length — the video should always play
// through in full, never get cut off early just because the backend (often
// woken from a Railway sleep) happened to respond before it finished.
const STARTUP_ANIMATION_MIN_MS = 8000;

export default function App() {
  const { user, loading, connectionError, retryConnection, logout } = useAuth();
  const [viewMode, setViewMode] = useState<"board" | "graph">("board");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [minAnimationElapsed, setMinAnimationElapsed] = useState(false);

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
          <p className="subtitle">Sessiyan qorunub, sadəcə backend-ə qoşulmaq alınmadı</p>
          <div className="form-error">{connectionError}</div>
          <button className="btn-primary" onClick={retryConnection}>
            Yenidən cəhd et
          </button>
        </div>
      </div>
    );
  } else if (!user) {
    content = <AuthScreen />;
  } else if (viewMode === "graph") {
    content = (
      <div className="app-shell">
        <GraphView teamId={user.teamId} onExit={() => setViewMode("board")} />
      </div>
    );
  } else {
    content = (
      <div className="app-shell">
        <header className="app-header">
          <h2>Taskomania</h2>
          <div className="user-info">
            {user.displayName} ({user.role === "ADMIN" ? "Admin" : "Üzv"})
            {user.role === "ADMIN" && (
              <button
                className="btn-secondary"
                style={{ width: "auto", marginLeft: 12, padding: "5px 12px", fontSize: 12 }}
                onClick={() => setInviteOpen(true)}
              >
                Dəvət et
              </button>
            )}
            <button
              className="btn-secondary"
              style={{ width: "auto", marginLeft: 8, padding: "5px 12px", fontSize: 12 }}
              onClick={() => setViewMode("graph")}
            >
              Qraf
            </button>
            <button
              className="btn-secondary"
              style={{ width: "auto", marginLeft: 8, padding: "5px 12px", fontSize: 12 }}
              onClick={logout}
            >
              Çıxış
            </button>
          </div>
        </header>
        <Board teamId={user.teamId} />
        {inviteOpen && <InviteModal teamId={user.teamId} onClose={() => setInviteOpen(false)} />}
      </div>
    );
  }

  return (
    <>
      {content}
      <PowerMenu />
    </>
  );
}
