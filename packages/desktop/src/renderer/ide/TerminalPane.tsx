import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// A real shell (node-pty, spawned in main/ide/ptyHandlers.ts) with its own
// cwd = the open project's root. The ONLY place in the renderer that calls
// ideAPI.ptyWrite is term.onData() below — real local keystrokes, nothing
// else. That single invariant is what keeps this terminal "restricted": no
// task data, no socket event, no other code path can ever feed it input.
export default function TerminalPane({ cwd }: { cwd: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let sessionId: string | null = null;
    let unsubData: (() => void) | undefined;
    let unsubExit: (() => void) | undefined;

    const term = new Terminal({
      fontSize: 12.5,
      fontFamily: "Consolas, 'Courier New', monospace",
      theme: { background: "#0a0e14", foreground: "#e6edf3" },
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    window.ideAPI!
      .ptySpawn(cwd)
      .then((id) => {
        if (disposed) {
          window.ideAPI!.ptyKill(id);
          return;
        }
        sessionId = id;

        unsubData = window.ideAPI!.onPtyData(({ sessionId: sid, data }) => {
          if (sid === id) term.write(data);
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
  }, [cwd]);

  return <div ref={containerRef} style={{ height: "100%", padding: "6px 8px" }} />;
}
