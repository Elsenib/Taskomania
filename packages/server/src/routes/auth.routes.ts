import { Router } from "express";
import { registerTeamSchema, joinTeamSchema, loginSchema } from "@team-tracker/shared";
import * as authService from "../services/auth.service";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, user } = await authService.registerTeam(parsed.data);
    res.status(201).json({ token, user: authService.toPublicUser(user) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.post("/join", async (req, res) => {
  const parsed = joinTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, user } = await authService.joinTeam(parsed.data);
    res.status(201).json({ token, user: authService.toPublicUser(user) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, user } = await authService.login(parsed.data);
    res.json({ token, user: authService.toPublicUser(user) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await authService.getMe(req.auth!.userId);
    res.json({ user: authService.toPublicUser(user) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

function handleAuthError(err: unknown, res: import("express").Response) {
  if (err instanceof authService.AuthError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
