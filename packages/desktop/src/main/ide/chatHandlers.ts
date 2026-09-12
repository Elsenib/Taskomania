import { ipcMain, BrowserWindow } from "electron";
import { io, type Socket } from "socket.io-client";
import { getIdeSessionContext, type IdeSessionContext } from "./taskContext";

// Mirrors packages/desktop/src/renderer/api/client.ts's apiFetch, but this
// is the MAIN process's own copy — the IDE renderer never holds the token
// (see taskContext.ts), so every authenticated request for it has to be
// made here and handed back as plain data.
async function apiFetch<T>(ctx: IdeSessionContext, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ctx.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

let socket: Socket | null = null;

// Same role as the Board renderer's own socket connection (api/socket.ts) —
// a live push channel for message:created — except this one lives in the
// main process and forwards events into the IDE window over plain IPC,
// since the IDE renderer can't hold a token to open its own socket.
export function startChatSession(ctx: IdeSessionContext, getWin: () => BrowserWindow | null) {
  socket?.disconnect();
  socket = io(ctx.apiUrl, { auth: { token: ctx.token } });
  socket.on("message:created", (payload) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send("chat:message", payload);
  });
}

export function stopChatSession() {
  socket?.disconnect();
  socket = null;
}

function requireContext(): IdeSessionContext {
  const ctx = getIdeSessionContext();
  if (!ctx) throw new Error("IDE sessiyası hazır deyil");
  return ctx;
}

export function registerChatHandlers() {
  ipcMain.handle("chat:listMembers", async () => {
    const ctx = requireContext();
    return apiFetch<{ members: unknown[] }>(ctx, `/api/v1/teams/${ctx.teamId}/members`).then((r) => r.members);
  });

  ipcMain.handle("chat:listTeamMessages", async () => {
    const ctx = requireContext();
    return apiFetch<{ messages: unknown[] }>(ctx, `/api/v1/teams/${ctx.teamId}/messages`).then((r) => r.messages);
  });

  ipcMain.handle("chat:sendTeamMessage", async (_event, body: string) => {
    const ctx = requireContext();
    return apiFetch<{ message: unknown }>(ctx, `/api/v1/teams/${ctx.teamId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }).then((r) => r.message);
  });

  ipcMain.handle("chat:listDirectMessages", async (_event, otherUserId: string) => {
    const ctx = requireContext();
    return apiFetch<{ messages: unknown[] }>(
      ctx,
      `/api/v1/teams/${ctx.teamId}/messages/dm/${otherUserId}`
    ).then((r) => r.messages);
  });

  ipcMain.handle("chat:sendDirectMessage", async (_event, otherUserId: string, body: string) => {
    const ctx = requireContext();
    return apiFetch<{ message: unknown }>(ctx, `/api/v1/teams/${ctx.teamId}/messages/dm/${otherUserId}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }).then((r) => r.message);
  });

  ipcMain.handle("chat:getCurrentUserId", async () => {
    const ctx = requireContext();
    return ctx.userId;
  });
}
