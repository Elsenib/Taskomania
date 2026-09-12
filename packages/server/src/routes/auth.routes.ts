import { Router } from "express";
import {
  registerTeamSchema,
  joinTeamSchema,
  loginSchema,
  updateProfileSchema,
  createAdditionalTeamSchema,
  joinAdditionalTeamSchema,
  switchTeamSchema,
} from "@team-tracker/shared";
import * as authService from "../services/auth.service";
import { requireAuth } from "../middleware/auth";
import { broadcastToTeam } from "../socket";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, user, teamId, role } = await authService.registerTeam(parsed.data);
    res.status(201).json({ token, user: authService.toPublicUser(user, teamId, role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.post("/join", async (req, res) => {
  const parsed = joinTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, user, teamId, role } = await authService.joinTeam(parsed.data);
    res.status(201).json({ token, user: authService.toPublicUser(user, teamId, role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, user, teamId, role } = await authService.login(parsed.data);
    res.json({ token, user: authService.toPublicUser(user, teamId, role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await authService.getMe(req.auth!.userId);
    res.json({ user: authService.toPublicUser(user, req.auth!.teamId, req.auth!.role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const user = await authService.updateProfile(req.auth!.userId, parsed.data);
    const publicUser = authService.toPublicUser(user, req.auth!.teamId, req.auth!.role);
    broadcastToTeam(req.auth!.teamId, "member:updated", publicUser);
    res.json({ user: publicUser });
  } catch (err) {
    handleAuthError(err, res);
  }
});

// --- Multi-team: an already-logged-in user managing more than one team ---

authRouter.get("/my-teams", requireAuth, async (req, res) => {
  const teams = await authService.listMyTeams(req.auth!.userId);
  res.json({ teams });
});

authRouter.post("/teams", requireAuth, async (req, res) => {
  const parsed = createAdditionalTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, teamId, role } = await authService.createAdditionalTeam(req.auth!.userId, parsed.data);
    const user = await authService.getMe(req.auth!.userId);
    res.status(201).json({ token, user: authService.toPublicUser(user, teamId, role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.post("/teams/join", requireAuth, async (req, res) => {
  const parsed = joinAdditionalTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, teamId, role } = await authService.joinAdditionalTeam(req.auth!.userId, parsed.data);
    const user = await authService.getMe(req.auth!.userId);
    res.status(201).json({ token, user: authService.toPublicUser(user, teamId, role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.post("/switch-team", requireAuth, async (req, res) => {
  const parsed = switchTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, teamId, role } = await authService.switchTeam(req.auth!.userId, parsed.data.teamId);
    const user = await authService.getMe(req.auth!.userId);
    res.json({ token, user: authService.toPublicUser(user, teamId, role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

authRouter.post("/leave-team", requireAuth, async (req, res) => {
  const parsed = switchTeamSchema.safeParse(req.body); // same shape: { teamId }
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { token, teamId, role } = await authService.leaveTeam(req.auth!.userId, parsed.data.teamId);
    const user = await authService.getMe(req.auth!.userId);
    res.json({ token, user: authService.toPublicUser(user, teamId, role) });
  } catch (err) {
    handleAuthError(err, res);
  }
});

// Whole-team, permanent deletion (admin-only, re-verified against the DB
// inside the service since the target team may not be the JWT's currently
// active one). Broadcasts to the room BEFORE responding to the deleting
// admin so any other connected member's client (useRealtimeSync.ts) hears
// about it immediately — unlike leaving, this affects everyone in the team,
// not just the actor, so it's the one membership-change event that can't
// stay silent until next refetch.
authRouter.post("/delete-team", requireAuth, async (req, res) => {
  const parsed = switchTeamSchema.safeParse(req.body); // same shape: { teamId }
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const deletedTeamId = parsed.data.teamId;
    const { token, teamId, role } = await authService.deleteTeam(req.auth!.userId, deletedTeamId);
    broadcastToTeam(deletedTeamId, "team:deleted", { teamId: deletedTeamId });
    const user = await authService.getMe(req.auth!.userId);
    res.json({ token, user: authService.toPublicUser(user, teamId, role) });
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
