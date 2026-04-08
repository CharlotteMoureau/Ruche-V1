import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { hivesRouter } from "./routes/hives.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const env = globalThis.process?.env || {};
const port = Number(env.PORT || env.API_PORT || 4010);
const host = env.API_HOST || "0.0.0.0";
const appUrl = env.APP_URL || "http://127.0.0.1:5173";
const corsAllowedOrigins = [
  appUrl,
  ...(env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];
const allowedOriginSet = new Set(corsAllowedOrigins);
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOriginSet.has(origin)) return true;
  if (origin === "http://127.0.0.1:5173") return true;
  if (origin === "http://localhost:5173") return true;
  if (origin === "http://127.0.0.1:5174") return true;
  if (origin === "http://localhost:5174") return true;
  return localhostOriginPattern.test(origin);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
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
  res.status(500).json({ error: "Server error" });
});

app.listen(port, host, () => {
  console.log(`API running on http://${host}:${port}`);
});
