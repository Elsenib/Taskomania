import { useEffect, useState } from "react";
import { useCreateInvite } from "../hooks/useInvites";
import { ApiError } from "../api/client";

export default function InviteModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const createInvite = useCreateInvite(teamId);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setError(null);
    setCopied(false);
    try {
      await createInvite.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dəvət kodu yaradıla bilmədi");
    }
  }

  async function handleCopy() {
    if (!createInvite.data) return;
    try {
      await navigator.clipboard.writeText(createInvite.data.invite.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const code = createInvite.data?.invite.code;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 26,
          width: 380,
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
          Komandaya dəvət et
        </h3>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted)" }}>
          Bu kodu komanda üzvünə göndər — "Qoşul" ekranında istifadə edəcək.
        </p>

        {error && <div className="form-error">{error}</div>}

        {createInvite.isPending && !code && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Yaradılır...</div>
        )}

        {code && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "12px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--paper)",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--ink)",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {code}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary"
              style={{ width: "auto", padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
            >
              {copied ? "Kopyalandı ✓" : "Kopyala"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={generate}
            className="btn-secondary"
            style={{ width: "auto" }}
            disabled={createInvite.isPending}
          >
            Yeni kod yarat
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ width: "auto" }}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
}
