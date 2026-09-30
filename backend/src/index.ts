// Environment values are loaded and validated FIRST (see config/env.ts).
// Never read process.env directly in this file — import { env } instead.
import { env } from "./config/env";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import routes from "./routes";
import { errorHandler } from "./middleware";
import { closePool } from "./config/database";

const app = express();
const PORT = env.port;

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    // CORS origin is environment-driven. Never use '*' in production.
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// TEMPORARY
app.use((req, _res, next) => {
  console.log("========== PROXY DEBUG ==========");
  console.log("req.ip:", req.ip);
  console.log("req.ips:", req.ips);
  console.log("remoteAddress:", req.socket.remoteAddress);
  console.log("x-forwarded-for:", req.headers["x-forwarded-for"]);
  console.log("x-real-ip:", req.headers["x-real-ip"]);
  console.log("x-forwarded-host:", req.headers["x-forwarded-host"]);
  console.log("x-forwarded-proto:", req.headers["x-forwarded-proto"]);
  console.log("=================================");
  next();
});

// const limiter = rateLimit({
//   windowMs: env.apiRateLimit.windowMs,
//   max: env.apiRateLimit.max,
//   validate: { xForwardedForHeader: false, ip: false },
//   keyGenerator: (req) => {
//     return req.socket.remoteAddress ?? "unknown";
//   },
//   message: {
//     success: false,
//     message: "Too many requests, please try again later",
//   },
// });

const limiter = rateLimit({
  windowMs: env.apiRateLimit.windowMs,
  max: env.apiRateLimit.max,

  keyGenerator: (req) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const normalizedIp = ip.replace(/^\[|\]$/g, "");

    return ipKeyGenerator(normalizedIp);
  },

  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});

app.use("/api/", limiter);

app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "NXPERT EON API is running",
    timestamp: new Date().toISOString(),
  });
});

// Unknown /api routes → JSON 404 (consistent with the API error envelope)
// instead of Express's default HTML 404 page.
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`NXPERT EON API server running on port ${PORT}`);
});

export default app;
