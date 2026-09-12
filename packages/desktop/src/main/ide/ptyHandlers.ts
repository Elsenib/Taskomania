import { ipcMain, BrowserWindow, shell } from "electron";
import os from "os";
import type { IPty } from "node-pty";

interface Session {
  proc: IPty;
}

const sessions = new Map<string, Session>();
let nextId = 1;

// Real shell processes — the single biggest attack surface in the whole IDE
// feature. The one rule that keeps this "restricted" (per the security
// discussion this feature was scoped around): pty:write is ONLY ever called
// from TerminalPane.tsx's own xterm.onData() handler, i.e. real local
// keystrokes. Nothing else in this codebase — no task data, no network
// event, no other IPC channel — is wired to call it. That is the actual
// boundary, not any command allow/deny-listing (which would be both
// incomplete and would defeat the point of a real terminal).
export function registerPtyHandlers() {
  ipcMain.handle(
    "pty:spawn",
    async (event, { cwd, shell: shellChoice }: { cwd: string; shell?: "cmd" | "powershell" }): Promise<string> => {
      const pty = await import("node-pty");
      const shell =
        os.platform() === "win32"
          ? shellChoice === "cmd"
            ? "cmd.exe"
            : "powershell.exe"
          : process.env.SHELL || "bash";
      const proc = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: 80,
        rows: 30,
        cwd,
        env: process.env as { [key: string]: string },
      });

      const id = String(nextId++);
      const win = BrowserWindow.fromWebContents(event.sender);
      sessions.set(id, { proc });

      proc.onData((data) => {
        if (win && !win.isDestroyed()) win.webContents.send("pty:data", { sessionId: id, data });
      });
      proc.onExit(() => {
        if (win && !win.isDestroyed()) win.webContents.send("pty:exit", { sessionId: id });
        sessions.delete(id);
      });

      return id;
    }
  );

  ipcMain.on("pty:write", (_event, { sessionId, data }: { sessionId: string; data: string }) => {
    sessions.get(sessionId)?.proc.write(data);
  });

  ipcMain.on(
    "pty:resize",
    (_event, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
      sessions.get(sessionId)?.proc.resize(cols, rows);
    }
  );

  ipcMain.on("pty:kill", (_event, sessionId: string) => {
    sessions.get(sessionId)?.proc.kill();
    sessions.delete(sessionId);
  });

  // Backs both the terminal's clickable-link addon (xterm's own output, e.g.
  // a dev server URL a user typed `npm run dev` to start) and the detected
  // dev-server banner button in TerminalPane.tsx — restricted to http(s) so
  // this can't be used to launch arbitrary protocol handlers/local files.
  ipcMain.handle("shell:openExternal", (_event, url: string): void => {
    if (!/^https?:\/\//i.test(url)) return;
    shell.openExternal(url);
  });
}

// Closing the IDE window destroys its renderer/JS context immediately —
// TerminalPane's React unmount cleanup (which calls pty:kill) is not
// guaranteed to run in time, so without this, every closed window leaks its
// shell process (powershell.exe/bash keeps running, holding its cwd locked
// on disk). Called from ide/ideWindow.ts's "closed" handler instead.
export function killAllPtySessions() {
  for (const { proc } of sessions.values()) {
    proc.kill();
  }
  sessions.clear();
}
