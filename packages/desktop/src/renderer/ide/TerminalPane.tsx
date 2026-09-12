import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

// Matches the URL a dev server prints on startup (Vite's "Local:
// http://localhost:5173/", CRA/webpack's "http://localhost:3000", Next.js'
// "- Local: http://localhost:3000", etc.) — used to surface the "brauzerdə
// aç" banner button in IdeApp.tsx without knowing anything about which
// specific tool the user typed into the shell.
const DEV_SERVER_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d{2,5})?(?:\/[^\s\x1b]*)?/i;

// Dev servers colorize their own startup banner (Vite bolds just the port
// digits, etc.) — the raw pty bytes have ANSI/OSC escape sequences spliced
// INSIDE what looks like one continuous URL, which breaks DEV_SERVER_URL_RE
// (e.g. "localhost:" then an escape code then "5174" — \d{2,5} can't match
// across that gap, so the port silently gets dropped, sending the user to
// plain http://localhost with no port at all). Stripping every escape
// sequence before matching is what actually fixes that, not a smarter regex.
function stripAnsi(s: string): string {
  // CSI sequences (colors, cursor movement, ...) and OSC sequences (hyperlinks,
  // window title, ...) — the two escape families a shell/dev server realistically emits.
  return s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}

// A real shell (node-pty, spawned in main/ide/ptyHandlers.ts) with its own
// cwd = the open project's root. The ONLY place in the renderer that calls
// ideAPI.ptyWrite is term.onData() below — real local keystrokes, nothing
// else. That single invariant is what keeps this terminal "restricted": no
// task data, no socket event, no other code path can ever feed it input.
export default function TerminalPane({
  cwd,
  shell,
  onDevServerUrl,
}: {
  cwd: string;
  shell?: "cmd" | "powershell";
  onDevServerUrl?: (url: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // A ref, not a dependency: IdeApp passes an inline callback that gets a
  // new identity on every render, and this effect must NOT tear down and
  // respawn the whole shell session just because that identity changed.
  const onDevServerUrlRef = useRef(onDevServerUrl);
  onDevServerUrlRef.current = onDevServerUrl;

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let sessionId: string | null = null;
    let unsubData: (() => void) | undefined;
    let unsubExit: (() => void) | undefined;
    let devServerFound = false;
    // A URL can straddle two separate stdout chunks — keep a short tail of
    // recently-seen output so the regex still sees it whole either way.
    let tail = "";

    const term = new Terminal({
      fontSize: 12.5,
      fontFamily: "Consolas, 'Courier New', monospace",
      theme: { background: "#0a0e14", foreground: "#e6edf3" },
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        window.ideAPI!.openExternal(uri);
      })
    );
    term.open(containerRef.current);
    fitAddon.fit();

    window.ideAPI!
      .ptySpawn(cwd, shell)
      .then((id) => {
        if (disposed) {
          window.ideAPI!.ptyKill(id);
          return;
        }
        sessionId = id;

        unsubData = window.ideAPI!.onPtyData(({ sessionId: sid, data }) => {
          if (sid !== id) return;
          term.write(data);
          if (!devServerFound && onDevServerUrlRef.current) {
            tail = (tail + data).slice(-500);
            const match = DEV_SERVER_URL_RE.exec(stripAnsi(tail));
            if (match) {
              devServerFound = true;
              onDevServerUrlRef.current(match[0].replace(/[),.]+$/, ""));
            }
          }
        });
        unsubExit = window.ideAPI!.onPtyExit(({ sessionId: sid }) => {
          if (sid === id) term.write("\r\n\x1b[2m[proses bitdi]\x1b[0m\r\n");
        });

        term.onData((data) => window.ideAPI!.ptyWrite(id, data));
        window.ideAPI!.ptyResize(id, term.cols, term.rows);
      })
      .catch((err) => {
        if (!disposed) term.write(`\r\n\x1b[31mTerminal başladıla bilmədi: ${err?.message ?? err}\x1b[0m\r\n`);
      });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (sessionId) window.ideAPI!.ptyResize(sessionId, term.cols, term.rows);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      unsubData?.();
      unsubExit?.();
      if (sessionId) window.ideAPI!.ptyKill(sessionId);
      term.dispose();
    };
  }, [cwd, shell]);

  return <div ref={containerRef} style={{ height: "100%", padding: "6px 8px" }} />;
}
