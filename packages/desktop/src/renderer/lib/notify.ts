import iconUrl from "../assets/notification-icon.png";

// Thin wrapper around the web Notification API — Electron routes this
// straight to the OS notification center (Windows Action Center) without
// any main-process plumbing, including while the window is minimized or
// hidden to the tray, as long as the renderer process is still alive.
export function notify(title: string, body: string, onClick?: () => void) {
  if (typeof Notification === "undefined") return;

  const fire = () => {
    const n = new Notification(title, { body, icon: iconUrl });
    n.onclick = () => {
      window.teamTracker?.focusWindow();
      onClick?.();
    };
  };

  if (Notification.permission === "granted") {
    fire();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") fire();
    });
  }
}
