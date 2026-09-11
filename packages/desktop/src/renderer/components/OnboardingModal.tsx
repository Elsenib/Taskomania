import { useT } from "../i18n/useT";

const RULES = [
  { title: "onboarding.rule1Title", body: "onboarding.rule1Body" },
  { title: "onboarding.rule2Title", body: "onboarding.rule2Body" },
  { title: "onboarding.rule3Title", body: "onboarding.rule3Body" },
  { title: "onboarding.rule4Title", body: "onboarding.rule4Body" },
  { title: "onboarding.rule5Title", body: "onboarding.rule5Body" },
  { title: "onboarding.rule6Title", body: "onboarding.rule6Body" },
] as const;

interface Props {
  onClose: () => void;
  // First-time flow shows a single confirm button that both dismisses the
  // modal and marks it seen server-side; reopening later from the profile
  // just needs a plain close, "seen" is already recorded.
  confirmLabel?: string;
}

export default function OnboardingModal({ onClose, confirmLabel }: Props) {
  const t = useT();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div
        className="thin-scroll"
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 28,
          width: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 700, color: "var(--ink)" }}>
          {t("onboarding.title")}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>{t("onboarding.intro")}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {RULES.map((rule, i) => (
            <div key={rule.title} style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--accent-paper)",
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                  {t(rule.title)}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.4 }}>{t(rule.body)}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ margin: "20px 0 0", fontSize: 12, color: "var(--muted)" }}>{t("onboarding.footer")}</p>

        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onClose}>
          {confirmLabel ?? t("common.close")}
        </button>
      </div>
    </div>
  );
}
