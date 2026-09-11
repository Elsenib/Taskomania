import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import { useT } from "../i18n/useT";

export default function LoginScreen() {
  const { login } = useAuth();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="field">
        <label htmlFor="login-email">{t("auth.email")}</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">{t("auth.password")}</label>
        <PasswordInput
          id="login-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? t("auth.loggingIn") : t("auth.submitLogin")}
      </button>
    </form>
  );
}
