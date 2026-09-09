import { useEffect, useState } from "react";
import type { Attachment, FileTreeNode } from "@team-tracker/shared";
import { attachmentContentUrl, useAttachmentTree } from "../hooks/useAttachments";
import FileTree from "./FileTree";
import FilePreview from "./FilePreview";

function findDefaultFile(nodes: FileTreeNode[]): FileTreeNode | null {
  const files: FileTreeNode[] = [];
  const collect = (list: FileTreeNode[]) => {
    for (const n of list) {
      if (n.type === "file") files.push(n);
      else if (n.children) collect(n.children);
    }
  };
  collect(nodes);
  return files.find((f) => f.name.toLowerCase() === "index.html") ?? files[0] ?? null;
}

export default function AttachmentPreviewModal({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const isArchive = attachment.kind === "ARCHIVE";
  const { data: tree, isLoading: treeLoading } = useAttachmentTree(isArchive ? attachment : null);
  const [selected, setSelected] = useState<FileTreeNode | null>(null);

  useEffect(() => {
    if (isArchive && tree && !selected) {
      setSelected(findDefaultFile(tree));
    }
  }, [isArchive, tree, selected]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const previewUrl = isArchive
    ? selected
      ? attachmentContentUrl(attachment, selected.path)
      : null
    : attachmentContentUrl(attachment);
  const previewName = isArchive ? (selected?.name ?? "") : attachment.originalName;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: 12,
          width: "88vw",
          height: "86vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {attachment.originalName}
            {isArchive && previewName && (
              <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {previewName}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {isArchive && (
            <div
              style={{
                width: 220,
                flexShrink: 0,
                borderRight: "1px solid var(--border)",
                overflowY: "auto",
                padding: 8,
              }}
            >
              {treeLoading && <div style={{ padding: 8, fontSize: 12, color: "var(--muted)" }}>Yüklənir...</div>}
              {tree && (
                <FileTree nodes={tree} selectedPath={selected?.path ?? null} onSelect={setSelected} />
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {previewUrl && previewName ? (
              <FilePreview url={previewUrl} filename={previewName} />
            ) : (
              <div style={{ padding: 24, color: "var(--muted)" }}>
                {isArchive ? "Baxmaq üçün bir fayl seç" : "Yüklənir..."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
