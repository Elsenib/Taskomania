// Draws a small red circle with the unread count as a PNG data: URI, for
// Electron's `BrowserWindow.setOverlayIcon` (the little badge Windows shows
// in the corner of a taskbar icon — same idea as Slack/Discord's unread
// dot). Rendered in the renderer (has a DOM/canvas), sent to the main
// process which actually owns the BrowserWindow — see main.ts's
// "app:setUnreadBadge" handler.
export function renderBadgeDataUrl(count: number): string | null {
  if (count <= 0) return null;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#e5484d";
  ctx.fill();

  const label = count > 99 ? "99+" : String(count);
  ctx.fillStyle = "white";
  ctx.font = `700 ${label.length > 2 ? 12 : 16}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2 + 1);

  return canvas.toDataURL("image/png");
}
