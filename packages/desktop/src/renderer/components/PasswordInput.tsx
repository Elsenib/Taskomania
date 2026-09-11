import { useId, useState, type InputHTMLAttributes } from "react";
import { useT } from "../i18n/useT";

// Plain <input type="password"> with an eye toggle to reveal what you typed
// — people lose track mid-typing and have no way to check without this.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & { id?: string };

export default function PasswordInput({ id, style, ...rest }: Props) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div style={{ position: "relative" }}>
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        style={{ paddingRight: 36, ...style }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          padding: 4,
          cursor: "pointer",
          display: "flex",
          color: "var(--muted)",
        }}
      >
        {visible ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
