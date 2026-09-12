import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from "electron";
import path from "path";
import { openIdeWindow } from "./ide/ideWindow";
import { registerFsHandlers } from "./ide/fsHandlers";
import { registerPtyHandlers } from "./ide/ptyHandlers";
import { registerDependencyScanner } from "./ide/dependencyScanner";
import { registerLspHandlers } from "./ide/lspHandlers";
import { registerTaskContextHandlers, type IdeSessionContext } from "./ide/taskContext";
import { registerGoLiveHandlers } from "./ide/goLiveServer";
import { registerChatHandlers } from "./ide/chatHandlers";

const isDev = process.env.NODE_ENV === "development";
const iconPath = path.join(__dirname, "../build/icon.png");

// Chromium blocks audible autoplay without a prior user gesture — the
// startup wake-up video needs sound to play from the very first launch,
// before the user has clicked anything.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Windows groups toast notifications by this id and uses it to pick the
// taskbar/notification icon+name — without it, notifications show up as
// generic "Electron" toasts instead of "Taskomania".
app.setAppUserModelId("com.taskomania.desktop");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
// Set right before app.quit() so the window's close handler knows to let it
// through instead of hiding to tray (see createWindow's "close" listener).
let isQuitting = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Taskomania",
    icon: iconPath,
    // Fullscreen-only in production — in dev it fights the DevTools window
    // (Windows keeps a fullscreen/exclusive window on top of everything
    // else, DevTools included), so debugging stays in a normal window.
    fullscreen: !isDev,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  }

  // Closing the window (the "X" button) hides it to the tray instead of
  // quitting — the socket connection needs to stay alive in the background
  // for task-assignment notifications to keep arriving. Real quit only
  // happens via the tray menu's "Çıx" or the OS shutting the app down.
  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });

  mainWindow = win;
  return win;
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image);
  tray.setToolTip("Taskomania");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Göstər",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: "Çıx",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// Renderer asks for this when a Notification the user clicked should bring
// the (possibly hidden-to-tray or unfocused) window to the front.
ipcMain.on("focus-window", () => {
  mainWindow?.show();
  mainWindow?.focus();
});

// The window runs fullscreen with no frame/menu, so the renderer's own
// power-button UI (PowerMenu.tsx) is the only way to close it — these are
// its two options: hide to tray (socket stays connected) or fully quit.
ipcMain.on("app-sleep", () => {
  mainWindow?.hide();
});
ipcMain.on("app-shutdown", () => {
  isQuitting = true;
  app.quit();
});

// Opens the IDE as a separate window (see ide/ideWindow.ts for why it's not
// just another view inside the main window). Always carries the caller's
// token/apiUrl/teamId/userId now (team chat needs them even without a
// task); taskId is only set from TaskDetailModal's "Daxili IDE" choice,
// scoping the "Layihəni tapşırığa saxla" action to that task — see
// ide/taskContext.ts.
ipcMain.on("ide:open", (_event, ctx: IdeSessionContext) => {
  openIdeWindow(ctx);
});

app.whenReady().then(() => {
  // No default "File Edit View Window Help" menu bar — the app runs
  // fullscreen/kiosk-style with its own in-app controls only.
  Menu.setApplicationMenu(null);

  createWindow();
  createTray();
  registerFsHandlers();
  registerPtyHandlers();
  registerDependencyScanner();
  registerLspHandlers();
  registerTaskContextHandlers();
  registerGoLiveHandlers();
  registerChatHandlers();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Intentionally a no-op on all platforms: the window hides to the tray
  // rather than closing, so this event only fires after a real quit, by
  // which point the app is already tearing down.
});
