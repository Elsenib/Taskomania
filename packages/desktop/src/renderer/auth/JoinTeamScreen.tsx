import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import { useT } from "../i18n/useT";

export default function JoinTeamScreen() {
  const { joinTeam } = useAuth();
  const t = useT();
  const [inviteCode, setInviteCode] = useState("");
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
      await joinTeam({ inviteCode, displayName, email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.joinFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="field">
        <label htmlFor="jt-code">{t("auth.inviteCode")}</label>
        <input
          id="jt-code"
          required
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="jt-displayname">{t("auth.yourName")}</label>
        <input
          id="jt-displayname"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="jt-email">{t("auth.email")}</label>
        <input
          id="jt-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="jt-password">{t("auth.passwordMin8")}</label>
        <PasswordInput
          id="jt-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? t("auth.joining") : t("auth.submitJoin")}
      </button>
    </form>
  );
}
