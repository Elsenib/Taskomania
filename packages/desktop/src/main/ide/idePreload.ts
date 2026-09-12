import { contextBridge, ipcRenderer } from "electron";

// Separate global from the Board window's `window.teamTracker` — this is
// the ONLY bridge exposed inside the IDE window's renderer. Every channel
// here is `invoke` (request/response) so the main process can validate/
// reject before doing anything — see fsHandlers.ts's resolveInRoot for the
// path-containment check backing every fs:* call.
contextBridge.exposeInMainWorld("ideAPI", {
  isIde: true,
  platform: process.platform,

  openProjectFolder: (): Promise<string | null> => ipcRenderer.invoke("dialog:openProjectFolder"),
  getProjectRoot: (): Promise<string | null> => ipcRenderer.invoke("fs:getProjectRoot"),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke("dialog:pickFolder"),
  createNewProject: (parentPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke("project:createNew", { parentPath, name }),
  readDir: (relPath: string) => ipcRenderer.invoke("fs:readDir", relPath),
  readFile: (relPath: string): Promise<string> => ipcRenderer.invoke("fs:readFile", relPath),
  readImageDataUrl: (relPath: string): Promise<string> =>
    ipcRenderer.invoke("fs:readImageDataUrl", relPath),
  writeFile: (relPath: string, content: string): Promise<void> =>
    ipcRenderer.invoke("fs:writeFile", relPath, content),
  createFile: (relPath: string): Promise<void> => ipcRenderer.invoke("fs:createFile", relPath),
  createFolder: (relPath: string): Promise<void> => ipcRenderer.invoke("fs:createFolder", relPath),
  renamePath: (fromRel: string, toRel: string): Promise<void> =>
    ipcRenderer.invoke("fs:rename", fromRel, toRel),
  deletePath: (relPath: string): Promise<void> => ipcRenderer.invoke("fs:delete", relPath),

  // Terminal — ptySpawn/ptyResize/ptyKill are invoke/send wrappers only.
  // ptyWrite must ONLY ever be called from TerminalPane.tsx's own
  // xterm.onData() handler (real keystrokes) — see ptyHandlers.ts's comment
  // for why that single rule is what makes this a "restricted" terminal.
  ptySpawn: (cwd: string, shell?: "cmd" | "powershell"): Promise<string> =>
    ipcRenderer.invoke("pty:spawn", { cwd, shell }),
  ptyWrite: (sessionId: string, data: string): void =>
    ipcRenderer.send("pty:write", { sessionId, data }),
  ptyResize: (sessionId: string, cols: number, rows: number): void =>
    ipcRenderer.send("pty:resize", { sessionId, cols, rows }),
  ptyKill: (sessionId: string): void => ipcRenderer.send("pty:kill", sessionId),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:openExternal", url),
  onPtyData: (callback: (payload: { sessionId: string; data: string }) => void) => {
    const listener = (_event: unknown, payload: { sessionId: string; data: string }) => callback(payload);
    ipcRenderer.on("pty:data", listener);
    return () => ipcRenderer.removeListener("pty:data", listener);
  },
  onPtyExit: (callback: (payload: { sessionId: string }) => void) => {
    const listener = (_event: unknown, payload: { sessionId: string }) => callback(payload);
    ipcRenderer.on("pty:exit", listener);
    return () => ipcRenderer.removeListener("pty:exit", listener);
  },

  scanDependencies: (rootPath: string) => ipcRenderer.invoke("project:scanDependencies", rootPath),

  // Real language servers (typescript-language-server/pyright/
  // sql-language-server), spawned locally per lspHandlers.ts. lspSend is
  // fire-and-forget like ptyWrite, but here the caller is the renderer's own
  // JSON-RPC client (lsp/LspClient.ts), never raw keystrokes directly.
  lspStart: (languageId: string, projectRoot: string): Promise<string> =>
    ipcRenderer.invoke("lsp:start", { languageId, projectRoot }),
  lspSend: (sessionId: string, message: unknown): void =>
    ipcRenderer.send("lsp:send", { sessionId, message }),
  lspStop: (sessionId: string): void => ipcRenderer.send("lsp:stop", sessionId),
  onLspMessage: (callback: (payload: { sessionId: string; message: unknown }) => void) => {
    const listener = (_event: unknown, payload: { sessionId: string; message: unknown }) => callback(payload);
    ipcRenderer.on("lsp:message", listener);
    return () => ipcRenderer.removeListener("lsp:message", listener);
  },
  onLspExit: (callback: (payload: { sessionId: string; error?: string }) => void) => {
    const listener = (_event: unknown, payload: { sessionId: string; error?: string }) => callback(payload);
    ipcRenderer.on("lsp:exit", listener);
    return () => ipcRenderer.removeListener("lsp:exit", listener);
  },

  // Only the taskId ever reaches this renderer — the JWT used to actually
  // perform the upload lives solely in the main process (see
  // main/ide/taskContext.ts). This window has no way to read or leak it.
  goLiveStart: (root: string, relPath: string): Promise<{ url: string }> =>
    ipcRenderer.invoke("goLive:start", { root, relPath }),
  goLiveStop: (): Promise<void> => ipcRenderer.invoke("goLive:stop"),

  getTaskContext: (): Promise<{ taskId: string } | null> => ipcRenderer.invoke("task:getContext"),
  saveProjectToTask: (stats: {
    typedChars: number;
    pastedChars: number;
    typedPercent: number;
    pastedPercent: number;
  }): Promise<void> => ipcRenderer.invoke("task:saveProject", stats),

  // C#/Java servers aren't bundled (too heavy for the installer) — these
  // let the renderer check/trigger the one-time download into Electron's
  // per-user data dir. See main/ide/lspDownloader.ts.
  lspIsServerInstalled: (languageId: "csharp" | "java"): Promise<boolean> =>
    ipcRenderer.invoke("lsp:isServerInstalled", languageId),
  lspDownloadServer: (languageId: "csharp" | "java"): Promise<void> =>
    ipcRenderer.invoke("lsp:downloadServer", languageId),
  onLspDownloadProgress: (
    callback: (payload: { languageId: string; receivedBytes: number; totalBytes: number }) => void
  ) => {
    const listener = (
      _event: unknown,
      payload: { languageId: string; receivedBytes: number; totalBytes: number }
    ) => callback(payload);
    ipcRenderer.on("lsp:downloadProgress", listener);
    return () => ipcRenderer.removeListener("lsp:downloadProgress", listener);
  },
});
