import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from "electron";
import path from "path";

const isDev = process.env.NODE_ENV === "development";
const iconPath = path.join(__dirname, "../build/icon.png");

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

app.whenReady().then(() => {
  createWindow();
  createTray();

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
