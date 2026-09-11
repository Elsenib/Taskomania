import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import { useT } from "../i18n/useT";

export default function CreateTeamScreen() {
  const { registerTeam } = useAuth();
  const t = useT();
  const [teamName, setTeamName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerTeam({ teamName, displayName, email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="field">
        <label htmlFor="ct-teamname">{t("auth.teamName")}</label>
        <input
          id="ct-teamname"
          required
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="ct-displayname">{t("auth.yourName")}</label>
        <input
          id="ct-displayname"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="ct-email">{t("auth.email")}</label>
        <input
          id="ct-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="ct-password">{t("auth.passwordMin8")}</label>
        <PasswordInput
          id="ct-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? t("auth.creating") : t("auth.submitCreate")}
      </button>
    </form>
  );
}
