import { useRef, useState, type CSSProperties } from "react";
import type { Attachment, User } from "@team-tracker/shared";
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "../hooks/useAttachments";
import { formatBytes } from "../lib/formatBytes";
import { isDesignFile } from "../lib/fileKind";
import { ApiError } from "../api/client";
import AttachmentPreviewModal from "./AttachmentPreviewModal";
import DesignCanvas from "../canvas/DesignCanvas";

function kindLabel(a: Attachment) {
  return a.kind === "ARCHIVE" ? "Layihə" : "Fayl";
}

export default function AttachmentPanel({ taskId, members }: { taskId: string; members: User[] }) {
  const { data: attachments, isLoading, isError } = useAttachments(taskId);
  const uploadAttachment = useUploadAttachment(taskId);
  const deleteAttachment = useDeleteAttachment(taskId);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<Attachment | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const designFileCount = (attachments ?? []).filter((a) => a.kind === "FILE" && isDesignFile(a.originalName)).length;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  const membersById = new Map(members.map((m) => [m.id, m]));

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment.mutateAsync({ file, kind: "FILE" });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yükləmə alınmadı");
    }
  }

  async function handleArchiveSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      await uploadAttachment.mutateAsync({ file, kind: "ARCHIVE" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yükləmə alınmadı");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteAttachment.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silmək alınmadı");
    }
  }

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Fayllar</span>
        <div style={{ display: "flex", gap: 12 }}>
          {designFileCount > 0 && (
            <button type="button" onClick={() => setCanvasOpen(true)} style={linkButtonStyle}>
              Kanvasda bax
            </button>
          )}
          <button type="button" onClick={() => fileInputRef.current?.click()} style={linkButtonStyle}>
            + Fayl əlavə et
          </button>
          <button type="button" onClick={() => archiveInputRef.current?.click()} style={linkButtonStyle}>
            + Layihə (.zip)
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={archiveInputRef}
          type="file"
          accept=".zip"
          hidden
          onChange={(e) => {
            handleArchiveSelected(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <div style={{ fontSize: 12, color: "var(--priority-high-ink)", marginBottom: 8 }}>{error}</div>}
      {uploadAttachment.isPending && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Yüklənir...</div>
      )}

      {isLoading && <div style={{ fontSize: 13, color: "var(--muted)" }}>Yüklənir...</div>}
      {isError && (
        <div style={{ fontSize: 13, color: "var(--priority-high-ink)" }}>Faylları yükləmək alınmadı.</div>
      )}
      {!isLoading && !isError && attachments && attachments.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Hələ fayl əlavə edilməyib.</div>
      )}

      {attachments && attachments.length > 0 && (
        <div>
          {attachments.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewing(a)}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--accent)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.originalName}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                  {kindLabel(a)} · {formatBytes(a.sizeBytes)} · {membersById.get(a.uploadedById)?.displayName ?? "?"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={deleteAttachment.isPending}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--priority-high-ink)",
                  fontSize: 12,
                  cursor: "pointer",
                  flexShrink: 0,
                  marginLeft: 10,
                }}
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      )}

      {canvasOpen && (
        <DesignCanvas
          attachments={attachments ?? []}
          onClose={() => setCanvasOpen(false)}
          onOpenAttachment={(a) => setPreviewing(a)}
        />
      )}
      {previewing && <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

const linkButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--accent)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
  padding: 0,
};
