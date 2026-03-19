import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { hivesRouter } from "./routes/hives.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const env = globalThis.process?.env || {};
const port = Number(env.API_PORT || 4000);
const appUrl = env.APP_URL || "http://localhost:5173";

app.use(
  cors({
    origin: [appUrl, "http://localhost:5173"],
    credentials: false,
  }),
);
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/hives", hivesRouter);
app.use("/api/admin", adminRouter);

app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error(err);
  res.status(500).json({ error: "Erreur serveur" });
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
