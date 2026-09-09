import { useState } from "react";
import { useAuth } from "./auth/AuthContext";
import AuthScreen from "./auth/AuthScreen";
import Board from "./board/Board";
import GraphView from "./graph/GraphView";
import InviteModal from "./components/InviteModal";

export default function App() {
  const { user, loading, connectionError, retryConnection, logout } = useAuth();
  const [viewMode, setViewMode] = useState<"board" | "graph">("board");
  const [inviteOpen, setInviteOpen] = useState(false);

  if (loading) {
    return (
      <div className="auth-shell">
        <p style={{ color: "var(--muted)" }}>Yüklənir...</p>
      </div>
    );
  }

  if (connectionError) {
    return (
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
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (viewMode === "graph") {
    return (
      <div className="app-shell">
        <GraphView teamId={user.teamId} onExit={() => setViewMode("board")} />
      </div>
    );
  }

  return (
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
