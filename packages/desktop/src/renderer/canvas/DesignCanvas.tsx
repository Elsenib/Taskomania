import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Attachment } from "@team-tracker/shared";
import { attachmentContentUrl } from "../hooks/useAttachments";
import { isImageFile } from "../lib/fileKind";
import { useT } from "../i18n/useT";

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const FRAME_WIDTH = 320;

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export default function DesignCanvas({
  attachments,
  onClose,
  onOpenAttachment,
  extraHeaderContent,
}: {
  attachments: Attachment[];
  onClose: () => void;
  onOpenAttachment: (attachment: Attachment) => void;
  // Lets a caller (the per-member canvas browser) inject its own controls —
  // e.g. a member switcher — into the header without DesignCanvas needing to
  // know anything about that use case. The per-task "Kanvasda bax" caller
  // just omits this.
  extraHeaderContent?: ReactNode;
}) {
  const t = useT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 60, y: 60, scale: 1 });
  const dragRef = useRef<{ startClientX: number; startClientY: number; originX: number; originY: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  // Native, non-passive wheel listener — React's onWheel can't reliably
  // preventDefault (needed so the page itself doesn't scroll while zooming).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      setTransform((t) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * (1 - e.deltaY * 0.0015)));
        const worldX = (cursorX - t.x) / t.scale;
        const worldY = (cursorY - t.y) / t.scale;
        return {
          scale: nextScale,
          x: cursorX - worldX * nextScale,
          y: cursorY - worldY * nextScale,
        };
      });
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return; // only pan when grabbing empty canvas
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: transform.x,
      originY: transform.y,
    };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    setTransform((t) => ({ ...t, x: dragRef.current!.originX + dx, y: dragRef.current!.originY + dy }));
  }

  function handlePointerUp() {
    dragRef.current = null;
    setIsDragging(false);
  }

  function resetView() {
    setTransform({ x: 60, y: 60, scale: 1 });
  }

  const designFiles = attachments.filter((a) => a.kind === "FILE");

  return (
    <div style={{ position: "fixed", inset: 0, background: "#e9e9ec", zIndex: 150, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          // Extra room on the right so the zoom/fit controls don't sit under
          // the fixed power-menu button (top-right corner, present on every screen).
          paddingRight: 60,
          background: "var(--card)",
          borderBottom: "1px solid var(--border)",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-secondary" style={{ width: "auto", padding: "5px 12px", fontSize: 12 }} onClick={onClose}>
            {t("common.close")}
          </button>
          {extraHeaderContent}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{Math.round(transform.scale * 100)}%</span>
          <button className="btn-secondary" style={{ width: "auto", padding: "5px 12px", fontSize: 12 }} onClick={resetView}>
            {t("canvas.fitView")}
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          cursor: isDragging ? "grabbing" : "grab",
          backgroundImage: "radial-gradient(rgba(0,0,0,0.09) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {designFiles.length === 0 ? (
          <div style={{ padding: 40, color: "var(--muted)", fontSize: 13 }}>{t("canvas.empty")}</div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: "0 0",
              display: "flex",
              flexWrap: "wrap",
              gap: 56,
              // Cap the row width so files wrap into a grid instead of one
              // long strip — a real layout, not a manually-positioned canvas.
              width: Math.min(designFiles.length, 4) * (FRAME_WIDTH + 56),
            }}
          >
            {designFiles.map((a) => (
              <Frame key={a.id} attachment={a} onOpen={() => onOpenAttachment(a)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Renders the iframe at a real desktop viewport size and scales the whole
// thing down visually — showing the actual page layout in miniature,
// instead of a native-tiny-viewport render that just crops the top-left
// corner (what a plain width:100%/height:220 iframe would show).
const NATIVE_WIDTH = 1280;
const NATIVE_HEIGHT = 800;
const THUMB_HEIGHT = (FRAME_WIDTH / NATIVE_WIDTH) * NATIVE_HEIGHT;

function HtmlFrameThumbnail({ url, title }: { url: string; title: string }) {
  const scale = FRAME_WIDTH / NATIVE_WIDTH;
  return (
    <div style={{ width: FRAME_WIDTH, height: THUMB_HEIGHT, overflow: "hidden", position: "relative" }}>
      <iframe
        src={url}
        title={title}
        sandbox="allow-scripts"
        style={{
          width: NATIVE_WIDTH,
          height: NATIVE_HEIGHT,
          border: "none",
          pointerEvents: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

function Frame({ attachment, onOpen }: { attachment: Attachment; onOpen: () => void }) {
  const url = attachmentContentUrl(attachment);
  const isImage = isImageFile(attachment.originalName);

  return (
    <div style={{ width: FRAME_WIDTH, flexShrink: 0 }}>
      <div
        style={{
          fontSize: 12,
          color: "#5a5a63",
          marginBottom: 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {attachment.originalName}
      </div>
      <div
        onClick={onOpen}
        style={{
          background: "white",
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.08)",
          cursor: "pointer",
          minHeight: 120,
        }}
      >
        {isImage ? (
          <img src={url} alt={attachment.originalName} style={{ width: "100%", display: "block" }} />
        ) : (
          <HtmlFrameThumbnail url={url} title={attachment.originalName} />
        )}
      </div>
    </div>
  );
}
