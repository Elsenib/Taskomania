import { useState } from "react";
import { useAuth } from "./AuthContext";
import LoginScreen from "./LoginScreen";
import CreateTeamScreen from "./CreateTeamScreen";
import JoinTeamScreen from "./JoinTeamScreen";

type Mode = "login" | "create" | "join";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const { sessionExpired } = useAuth();

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Taskomania</h1>
        <p className="subtitle">
          {mode === "login" && "Hesabına daxil ol"}
          {mode === "create" && "Komandan üçün yeni sahə yarat"}
          {mode === "join" && "Dəvət kodu ilə komandaya qoşul"}
        </p>

        {sessionExpired && (
          <div className="form-error">Sessiyanın vaxtı bitib. Zəhmət olmasa yenidən daxil ol.</div>
        )}

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Giriş
          </button>
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>
            Komanda yarat
          </button>
          <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
            Qoşul
          </button>
        </div>

        {mode === "login" && <LoginScreen />}
        {mode === "create" && <CreateTeamScreen />}
        {mode === "join" && <JoinTeamScreen />}
      </div>
    </div>
  );
}
