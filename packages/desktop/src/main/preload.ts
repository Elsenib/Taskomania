import { contextBridge, ipcRenderer } from "electron";

// JWT token renderer-in öz localStorage-ında saxlanılır (bax api/client.ts) —
// bu, Chromium-un app-a aid persistent user-data qovluğuna yazılır, restart-dan
// sağ çıxır, IPC/electron-store lazım deyil (trusted, tək-mənbəli desktop app).
contextBridge.exposeInMainWorld("teamTracker", {
  version: process.versions.electron,
  // Brings the window forward when the user clicks a native notification —
  // needed because the window may be hidden to the tray or unfocused.
  focusWindow: () => ipcRenderer.send("focus-window"),
  // The window has no native close button (fullscreen, no frame) — these
  // back the in-app power menu's two options.
  sleepApp: () => ipcRenderer.send("app-sleep"),
  shutdownApp: () => ipcRenderer.send("app-shutdown"),
});
