import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "fs/promises";
import { watch, type FSWatcher } from "fs";
import path from "path";

// One open project per app instance (matches the plan: a single IDE window
// is reused/focused rather than multiple projects open at once). Every
// fs:* handler below resolves its relative path against THIS root and
// rejects anything that would escape it — the renderer's own code can be
// trusted to only ever send well-behaved relative paths, but this check
// means it doesn't have to be: even a compromised renderer can't read/write
// outside the chosen folder, because the main process is the actual gate.
let projectRoot: string | null = null;

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

let watcher: FSWatcher | null = null;
let watchDebounce: NodeJS.Timeout | null = null;

// The file tree only re-reads a folder on explicit create/delete/move —
// with no watcher, anything that changes the project from OUTSIDE those
// actions (typing `npm create vite@latest .` in the built-in terminal,
// git checkout, another editor) is invisible until the window is closed
// and reopened. Debounced because a single scaffold command can touch
// hundreds of files within milliseconds of each other — one refresh at
// the end, not hundreds mid-write.
function startWatching(root: string, win: BrowserWindow) {
  watcher?.close();
  watcher = null;
  try {
    watcher = watch(root, { recursive: true }, () => {
      if (watchDebounce) clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        if (!win.isDestroyed()) win.webContents.send("fs:changed");
      }, 400);
    });
  } catch {
    // `recursive` isn't supported on every platform/fs — the tree still
    // works, it just falls back to only refreshing on its own actions.
    watcher = null;
  }
}

export function stopWatching() {
  if (watchDebounce) clearTimeout(watchDebounce);
  watcher?.close();
  watcher = null;
}

function resolveInRoot(relPath: string): string {
  if (!projectRoot) throw new Error("Heç bir layihə qovluğu açıq deyil");
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Yol layihə kökündən kənara çıxır");
  }
  return resolved;
}

export interface FsEntry {
  name: string;
  isDirectory: boolean;
}

// Read by taskUpload.ts (zipping the currently open project to attach it to
// a task) — separate from the fs:getProjectRoot IPC handler below, which is
// for the renderer; this is for other main-process modules.
export function getCurrentProjectRoot(): string | null {
  return projectRoot;
}

export function registerFsHandlers() {
  ipcMain.handle("dialog:openProjectFolder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(win!, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    projectRoot = result.filePaths[0];
    if (win) startWatching(projectRoot, win);
    return projectRoot;
  });

  ipcMain.handle("fs:getProjectRoot", async () => projectRoot);

  // Generic folder picker with NO side effect on the active project root —
  // used to choose WHERE a brand-new project folder should be created,
  // as opposed to dialog:openProjectFolder which opens an EXISTING one.
  ipcMain.handle("dialog:pickFolder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(win!, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Creates a brand-new, empty project folder under a chosen parent
  // directory and makes it the active root — the "start from scratch"
  // counterpart to opening an existing folder.
  ipcMain.handle(
    "project:createNew",
    async (event, { parentPath, name }: { parentPath: string; name: string }): Promise<string> => {
      const fullPath = path.join(parentPath, name);
      await fs.mkdir(fullPath, { recursive: false });
      projectRoot = fullPath;
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) startWatching(projectRoot, win);
      return fullPath;
    }
  );

  ipcMain.handle("fs:readDir", async (_event, relPath: string): Promise<FsEntry[]> => {
    const dirPath = resolveInRoot(relPath);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
      .filter((e) => e.name !== "node_modules" && e.name !== ".git")
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
  });

  ipcMain.handle("fs:readFile", async (_event, relPath: string): Promise<string> => {
    return fs.readFile(resolveInRoot(relPath), "utf-8");
  });

  // Images can't go through fs:readFile's utf-8 decoding (binary bytes come
  // out as mojibake garbage in Monaco) — read as a Buffer instead and hand
  // the renderer a ready-to-use data: URI for a plain <img src>.
  ipcMain.handle("fs:readImageDataUrl", async (_event, relPath: string): Promise<string> => {
    const buffer = await fs.readFile(resolveInRoot(relPath));
    const ext = path.extname(relPath).slice(1).toLowerCase();
    const mime = IMAGE_MIME[ext] ?? "application/octet-stream";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  });

  ipcMain.handle("fs:writeFile", async (_event, relPath: string, content: string): Promise<void> => {
    await fs.writeFile(resolveInRoot(relPath), content, "utf-8");
  });

  ipcMain.handle("fs:createFile", async (_event, relPath: string): Promise<void> => {
    await fs.writeFile(resolveInRoot(relPath), "", { flag: "wx" });
  });

  ipcMain.handle("fs:createFolder", async (_event, relPath: string): Promise<void> => {
    await fs.mkdir(resolveInRoot(relPath));
  });

  ipcMain.handle("fs:rename", async (_event, fromRel: string, toRel: string): Promise<void> => {
    await fs.rename(resolveInRoot(fromRel), resolveInRoot(toRel));
  });

  ipcMain.handle("fs:delete", async (_event, relPath: string): Promise<void> => {
    await fs.rm(resolveInRoot(relPath), { recursive: true });
  });
}
