import { ipcMain, BrowserWindow } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import {
  type HeavyLanguageId,
  isServerInstalled,
  downloadServer,
  resolveCsharpCommand,
  resolveJavaCommand,
} from "./lspDownloader";

export type LspLanguageId = "typescript" | "javascript" | "python" | "sql" | "csharp" | "java";

interface Session {
  proc: ChildProcessWithoutNullStreams;
  buffer: Buffer;
}

const sessions = new Map<string, Session>();
let nextId = 1;

interface SpawnSpec {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

// Real language servers, spawned as local child processes — same trust
// boundary as ptyHandlers.ts (see the comment there): only local, only
// started by the user opening a file of that language, never remotely
// triggerable. TypeScript/Python/SQL are plain Node CLIs bundled as npm
// dependencies, run via `electron.exe <script> --stdio` with
// ELECTRON_RUN_AS_NODE=1 (no separate Node.js install needed). C#/Java are
// real standalone tools too heavy to bundle in the installer — they're
// downloaded on first use (see lspDownloader.ts) and spawned directly.
function resolveSpawnSpec(languageId: LspLanguageId, projectRoot: string): SpawnSpec {
  switch (languageId) {
    case "typescript":
    case "javascript":
      return {
        command: process.execPath,
        args: [require.resolve("typescript-language-server/lib/cli.mjs"), "--stdio"],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      };
    case "python":
      return {
        command: process.execPath,
        args: [require.resolve("pyright/langserver.index.js"), "--stdio"],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      };
    case "sql":
      return {
        command: process.execPath,
        args: [require.resolve("sql-language-server/npm_bin/cli.js"), "up", "--method", "stdio"],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      };
    case "csharp": {
      const resolved = resolveCsharpCommand();
      if (!resolved) throw new Error("OmniSharp quraşdırılmayıb");
      return resolved;
    }
    case "java": {
      const resolved = resolveJavaCommand(projectRoot);
      if (!resolved) throw new Error("Java dil serveri quraşdırılmayıb");
      return resolved;
    }
  }
}

export function registerLspHandlers() {
  ipcMain.handle(
    "lsp:start",
    (event, { languageId, projectRoot }: { languageId: LspLanguageId; projectRoot: string }): string => {
      const { command, args, env } = resolveSpawnSpec(languageId, projectRoot);
      const proc = spawn(command, args, {
        cwd: projectRoot,
        env: env ?? process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const id = String(nextId++);
      const win = BrowserWindow.fromWebContents(event.sender);
      sessions.set(id, { proc, buffer: Buffer.alloc(0) });

      proc.stdout.on("data", (chunk: Buffer) => {
        const session = sessions.get(id);
        if (!session) return;
        session.buffer = Buffer.concat([session.buffer, chunk]);
        drainMessages(session, id, win);
      });

      proc.on("exit", () => {
        sessions.delete(id);
        if (win && !win.isDestroyed()) win.webContents.send("lsp:exit", { sessionId: id });
      });

      proc.on("error", (err) => {
        sessions.delete(id);
        if (win && !win.isDestroyed())
          win.webContents.send("lsp:exit", { sessionId: id, error: String(err) });
      });

      return id;
    }
  );

  // send-only (fire-and-forget), matching pty:write — the renderer's LSP
  // client is the only caller, driven by its own JSON-RPC request/notify
  // queue, never by external data.
  ipcMain.on("lsp:send", (_event, { sessionId, message }: { sessionId: string; message: unknown }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    const json = JSON.stringify(message);
    session.proc.stdin.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`, "utf8");
  });

  ipcMain.on("lsp:stop", (_event, sessionId: string) => {
    sessions.get(sessionId)?.proc.kill();
    sessions.delete(sessionId);
  });

  ipcMain.handle("lsp:isServerInstalled", (_event, languageId: HeavyLanguageId): boolean =>
    isServerInstalled(languageId)
  );

  ipcMain.handle("lsp:downloadServer", async (event, languageId: HeavyLanguageId): Promise<void> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    await downloadServer(languageId, (receivedBytes, totalBytes) => {
      if (win && !win.isDestroyed())
        win.webContents.send("lsp:downloadProgress", { languageId, receivedBytes, totalBytes });
    });
  });
}

// LSP frames messages as `Content-Length: N\r\n\r\n<N bytes of JSON>`, back
// to back, with no guarantee a chunk boundary lines up with a message
// boundary — buffer until a full header+body is available, repeat for
// whatever's left in the buffer (a single stdout "data" event can contain
// more than one message).
function drainMessages(session: Session, id: string, win: BrowserWindow | null) {
  for (;;) {
    const headerEnd = session.buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = session.buffer.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length: (\d+)/i.exec(header);
    if (!match) {
      session.buffer = Buffer.alloc(0);
      return;
    }
    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (session.buffer.length < bodyStart + contentLength) return;
    const body = session.buffer.subarray(bodyStart, bodyStart + contentLength).toString("utf8");
    session.buffer = session.buffer.subarray(bodyStart + contentLength);
    try {
      const message = JSON.parse(body);
      if (win && !win.isDestroyed()) win.webContents.send("lsp:message", { sessionId: id, message });
    } catch {
      // malformed frame — drop it, keep the stream going
    }
  }
}

export function killAllLspSessions() {
  for (const { proc } of sessions.values()) proc.kill();
  sessions.clear();
}
