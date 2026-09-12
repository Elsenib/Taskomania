import { useEffect } from "react";

interface Props {
  avatarUrl: string;
  displayName: string;
  onClose: () => void;
}

// Deliberately its own tiny component rather than reusing
// AttachmentPreviewModal — that one is file/archive-preview specific (tree
// view, content-type detection); this is just "one image, bigger", so it
// mirrors the same overlay/panel/Escape/click-outside conventions without
// dragging in machinery this doesn't need.
export default function AvatarLightbox({ avatarUrl, displayName, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <img
          src={avatarUrl}
          alt={displayName}
          style={{
            display: "block",
            maxWidth: "min(80vw, 480px)",
            maxHeight: "80vh",
            borderRadius: 16,
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: -14,
            right: -14,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--ink)",
            fontSize: 16,
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
