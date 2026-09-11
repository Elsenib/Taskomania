import { useState } from "react";
import { useAuth } from "./AuthContext";
import LoginScreen from "./LoginScreen";
import CreateTeamScreen from "./CreateTeamScreen";
import JoinTeamScreen from "./JoinTeamScreen";
import { useT } from "../i18n/useT";

type Mode = "login" | "create" | "join";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const { sessionExpired } = useAuth();
  const t = useT();

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Taskomania</h1>
        <p className="subtitle">
          {mode === "login" && t("auth.loginSubtitle")}
          {mode === "create" && t("auth.createSubtitle")}
          {mode === "join" && t("auth.joinSubtitle")}
        </p>

        {sessionExpired && <div className="form-error">{t("auth.sessionExpired")}</div>}

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            {t("auth.tabLogin")}
          </button>
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>
            {t("auth.tabCreate")}
          </button>
          <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
            {t("auth.tabJoin")}
          </button>
        </div>

        {mode === "login" && <LoginScreen />}
        {mode === "create" && <CreateTeamScreen />}
        {mode === "join" && <JoinTeamScreen />}
      </div>
    </div>
  );
}
