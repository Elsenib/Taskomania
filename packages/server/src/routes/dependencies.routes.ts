import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as dependencyService from "../services/dependency.service";
import { AuthError } from "../services/auth.service";
import { broadcastToTeam } from "../socket";

export const dependenciesRouter = Router();

dependenciesRouter.use(requireAuth);

dependenciesRouter.delete("/:id", async (req, res) => {
  try {
    const dep = await dependencyService.deleteDependency(req.params.id, req.auth!.teamId);
    broadcastToTeam(req.auth!.teamId, "dependency:deleted", {
      id: req.params.id,
      blockingTaskId: dep.blockingTaskId,
      blockedTaskId: dep.blockedTaskId,
    });
    res.status(204).end();
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
