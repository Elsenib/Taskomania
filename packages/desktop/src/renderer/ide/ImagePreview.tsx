// Shown instead of EditorPane when the open file is an image (see
// lib/fileKind.ts's isImageFile) — Monaco is a text editor and would
// otherwise decode the binary bytes as UTF-8 garbage (mojibake). The IDE
// window has no read access to Board's AttachmentPreviewModal (separate
// window/preload), so this is its own minimal equivalent: just the image,
// centered, no zoom/pan.
export default function ImagePreview({ dataUrl, name }: { dataUrl: string; name: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "auto",
        background: "repeating-conic-gradient(#1b2130 0% 25%, #161b26 0% 50%) 50% / 20px 20px",
      }}
    >
      <img
        src={dataUrl}
        alt={name}
        style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
      />
    </div>
  );
}
