import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/useT";

// The window runs fullscreen with no native frame/title bar, so there's no
// OS close button — this is the only way to close the app, wherever the
// user currently is (video, auth screens, board all render it the same way).
export default function PowerMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={rootRef} style={{ position: "fixed", top: 14, right: 14, zIndex: 1000 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("powerMenu.ariaLabel")}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid var(--border)",
          background: "var(--card)",
          color: "var(--muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v8" />
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 0,
            width: 200,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            padding: 6,
          }}
        >
          <button
            type="button"
            className="power-menu-item"
            onClick={() => {
              setOpen(false);
              window.teamTracker?.sleepApp();
            }}
          >
            {t("powerMenu.sleep")}
          </button>
          <button
            type="button"
            className="power-menu-item"
            style={{ color: "var(--priority-high-ink)" }}
            onClick={() => {
              setOpen(false);
              window.teamTracker?.shutdownApp();
            }}
          >
            {t("powerMenu.shutdown")}
          </button>
        </div>
      )}
    </div>
  );
}
