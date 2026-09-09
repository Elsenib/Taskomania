import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "../api/client";

export default function JoinTeamScreen() {
  const { joinTeam } = useAuth();
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
      setError(err instanceof ApiError ? err.message : "Komandaya qoşulmaq alınmadı");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="field">
        <label htmlFor="jt-code">Dəvət kodu</label>
        <input
          id="jt-code"
          required
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="jt-displayname">Sənin adın</label>
        <input
          id="jt-displayname"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="jt-email">Email</label>
        <input
          id="jt-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="jt-password">Şifrə (min. 8 simvol)</label>
        <input
          id="jt-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Qoşulur..." : "Komandaya qoşul"}
      </button>
    </form>
  );
}
