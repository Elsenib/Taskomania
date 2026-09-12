import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  userId: string;
  teamId: string;
  role: "ADMIN" | "MENTOR" | "MEMBER";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: "Server misconfigured" });

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
}

// For the one route mentors get beyond a plain member: the team activity
// audit log. Every other admin-only route keeps using requireAdmin as-is —
// this is deliberately a separate, narrower middleware rather than changing
// requireAdmin itself, so nothing else silently opens up to mentors.
export function requireAdminOrMentor(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN" && req.auth?.role !== "MENTOR") {
    return res.status(403).json({ error: "Admin or mentor role required" });
  }
  next();
}
