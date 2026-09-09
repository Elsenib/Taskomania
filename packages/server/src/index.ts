import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createSocketServer } from "./socket";
import { authRouter } from "./routes/auth.routes";
import { teamsRouter } from "./routes/teams.routes";
import { tasksRouter } from "./routes/tasks.routes";
import { attachmentsRouter } from "./routes/attachments.routes";
import { dependenciesRouter } from "./routes/dependencies.routes";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "team-tracker-server" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/teams", teamsRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/attachments", attachmentsRouter);
app.use("/api/v1/dependencies", dependenciesRouter);

const httpServer = createServer(app);
createSocketServer(httpServer);

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
