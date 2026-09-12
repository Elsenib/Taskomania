import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "./middleware/auth";

let io: SocketIOServer | null = null;

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return next(new Error("Unauthorized"));
    try {
      const payload = jwt.verify(token, secret) as AuthPayload;
      socket.data.teamId = payload.teamId;
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const teamId = socket.data.teamId as string;
    const userId = socket.data.userId as string;
    socket.join(`team:${teamId}`);
    // Lets a DM reach every one of this user's own open sessions/devices
    // (see sendToUser below) without broadcasting it to the whole team.
    socket.join(`user:${userId}`);
  });

  return io;
}

// Called by route handlers after a successful mutation to notify every other
// team member's open app. REST stays the single write path — this is purely
// a "something changed, here's the new value" notification, never itself a
// source of truth.
export function broadcastToTeam(teamId: string, event: string, payload: unknown) {
  io?.to(`team:${teamId}`).emit(event, payload);
}

// For a private DM: reaches only the two participants (every session/device
// each of them has open), never the rest of the team.
export function sendToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
