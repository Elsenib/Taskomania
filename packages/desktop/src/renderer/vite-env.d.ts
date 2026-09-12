/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  teamTracker: {
    version: string;
    focusWindow(): void;
    sleepApp(): void;
    shutdownApp(): void;
    openIde(): void;
    openIdeForTask(taskId: string, token: string, apiUrl: string): void;
  };
  // Only present in the separate IDE window (see main/ide/idePreload.ts) —
  // undefined in the main Board window, which is how main.tsx decides which
  // root component to mount.
  ideAPI?: {
    isIde: true;
    openProjectFolder(): Promise<string | null>;
    getProjectRoot(): Promise<string | null>;
    pickFolder(): Promise<string | null>;
    createNewProject(parentPath: string, name: string): Promise<string>;
    readDir(relPath: string): Promise<{ name: string; isDirectory: boolean }[]>;
    readFile(relPath: string): Promise<string>;
    writeFile(relPath: string, content: string): Promise<void>;
    createFile(relPath: string): Promise<void>;
    createFolder(relPath: string): Promise<void>;
    renamePath(fromRel: string, toRel: string): Promise<void>;
    deletePath(relPath: string): Promise<void>;
    ptySpawn(cwd: string): Promise<string>;
    ptyWrite(sessionId: string, data: string): void;
    ptyResize(sessionId: string, cols: number, rows: number): void;
    ptyKill(sessionId: string): void;
    onPtyData(callback: (payload: { sessionId: string; data: string }) => void): () => void;
    onPtyExit(callback: (payload: { sessionId: string }) => void): () => void;
    scanDependencies(rootPath: string): Promise<{
      nodes: { id: string; label: string; ext: string }[];
      links: { source: string; target: string }[];
    }>;
    lspStart(languageId: string, projectRoot: string): Promise<string>;
    lspSend(sessionId: string, message: unknown): void;
    lspStop(sessionId: string): void;
    onLspMessage(callback: (payload: { sessionId: string; message: unknown }) => void): () => void;
    onLspExit(callback: (payload: { sessionId: string; error?: string }) => void): () => void;
    lspIsServerInstalled(languageId: "csharp" | "java"): Promise<boolean>;
    lspDownloadServer(languageId: "csharp" | "java"): Promise<void>;
    onLspDownloadProgress(
      callback: (payload: { languageId: string; receivedBytes: number; totalBytes: number }) => void
    ): () => void;
    goLiveStart(root: string, relPath: string): Promise<{ url: string }>;
    goLiveStop(): Promise<void>;
    getTaskContext(): Promise<{ taskId: string } | null>;
    saveProjectToTask(stats: {
      typedChars: number;
      pastedChars: number;
      typedPercent: number;
      pastedPercent: number;
    }): Promise<void>;
  };
}
