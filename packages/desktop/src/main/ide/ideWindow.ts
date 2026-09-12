import { BrowserWindow } from "electron";
import path from "path";
import { killAllPtySessions } from "./ptyHandlers";
import { killAllLspSessions } from "./lspHandlers";
import { setTaskContext, type TaskContext } from "./taskContext";
import { killGoLiveServer } from "./goLiveServer";
import { stopWatching } from "./fsHandlers";

const isDev = process.env.NODE_ENV === "development";
const iconPath = path.join(__dirname, "../../build/icon.png");

let ideWindow: BrowserWindow | null = null;

// Deliberately a SEPARATE BrowserWindow from the main Board window, with its
// own preload (idePreload.ts) and its own session partition. This is the
// core security boundary for the whole IDE feature: the Board's renderer
// (which displays task descriptions/comments — untrusted-ish user content)
// never has fs/pty/lsp bridges in its own contextBridge surface at all, and
// never shares localStorage/cookies (hence the JWT token) with this window —
// so a hypothetical XSS in the Board simply has no path to the terminal or
// disk, regardless of how carefully the rest of the code is written.
export function openIdeWindow(taskContext?: TaskContext) {
  // Always (re-)apply, even when reusing an already-open window — opening
  // "for" a different task, or opening plain after a task-scoped session,
  // should retarget which task "Layihəni tapşırığa saxla" uploads to.
  setTaskContext(taskContext ?? null);

  if (ideWindow && !ideWindow.isDestroyed()) {
    ideWindow.show();
    ideWindow.focus();
    return ideWindow;
  }

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Taskomania IDE",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "idePreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "persist:ide",
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173/?window=ide");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../../dist/renderer/index.html"), {
      search: "window=ide",
    });
  }

  win.on("closed", () => {
    // The window's JS context is destroyed immediately on close, so
    // TerminalPane's own unmount cleanup can't be relied on to kill its
    // shell process in time — do it explicitly here instead, or every
    // closed IDE window leaks an orphaned powershell.exe/bash.
    killAllPtySessions();
    killAllLspSessions();
    killGoLiveServer();
    stopWatching();
    setTaskContext(null);
    ideWindow = null;
  });

  ideWindow = win;
  return win;
}
