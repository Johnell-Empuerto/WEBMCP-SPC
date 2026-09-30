// ════════════════════════════════════════════════════════════════════════════
// Environment configuration — the single source of truth for process.env.
//
// WHY THIS FILE EXISTS
//   - It loads .env FIRST (import 'dotenv/config' runs when this module is
//     required). In compiled CommonJS, regular imports are evaluated before the
//     module body runs, so calling dotenv.config() in index.ts was too late for
//     modules like config/database.ts that read process.env at import time.
//     Every module that needs environment values must import from here so the
//     ordering is always correct.
//   - It fails fast: if a REQUIRED variable (DB_PASSWORD, JWT_SECRET) is
//     missing, the server refuses to start with a clear message instead of
//     silently using a hardcoded default. This is what makes the app safe to
//     run in production — there are no secret fallbacks baked into source code.
//
// RULES FOR DEVELOPERS
//   - Never read process.env directly in another module. Import { env } from
//     './env' (or '../config/env') instead.
//   - Never hardcode a secret default in source code. Add new required
//     variables here and document them in eon_backend/.env.example.
//   - See docs/SECURITY.md for the full environment-variable policy.
// ════════════════════════════════════════════════════════════════════════════

import "dotenv/config";
import type { SignOptions } from "jsonwebtoken";

/** The exact expiresIn type jsonwebtoken accepts (seconds or duration string). */
export type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;

/** Read a required variable or throw a startup error with a helpful message. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy eon_backend/.env.example to eon_backend/.env and fill in the values.`,
    );
  }
  return value.trim();
}

/** Valid duration strings jsonwebtoken understands (ms, s, m, h, d, w, y). */
const DURATION_RE = /^\d+(ms|s|m|h|d|w|y)$/;

/**
 * Parse a JWT lifetime value: positive seconds (28800) or a duration string
 * ('8h', '7d'). Invalid values fail fast at startup instead of blowing up
 * inside jwt.sign at login time.
 */
function expiresInEnv(name: string, fallback: JwtExpiresIn): JwtExpiresIn {
  const raw = String(process.env[name] ?? "").trim();
  if (raw === "") return fallback;
  if (/^\d+$/.test(raw)) return Number(raw) as JwtExpiresIn;
  if (DURATION_RE.test(raw)) return raw as JwtExpiresIn;
  throw new Error(
    `Invalid ${name} value "${raw}". Use seconds (e.g. 28800) or a duration string (e.g. '8h', '7d').`,
  );
}

/** Parse a number with a fallback (never throws). */
function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",

  port: numberEnv("PORT", 3002),

  db: {
    server: process.env.DB_SERVER || "iot-server",
    database: process.env.DB_DATABASE || "NXPERT_EON",
    user: process.env.DB_USER || "sa",
    // Password is REQUIRED — never shipped a default. It lives in eon_backend/.env.
    password: requireEnv("DB_PASSWORD"),
    port: numberEnv("DB_PORT", 1433),
    poolMin: numberEnv("DB_POOL_MIN", 2),
    poolMax: numberEnv("DB_POOL_MAX", 10),
  },

  jwt: {
    // Secret is REQUIRED — no fallback. It lives in eon_backend/.env.
    secret: requireEnv("JWT_SECRET"),
    // Expirations may be seconds (28800) or a duration string ('8h').
    accessExpiresIn: expiresInEnv("JWT_EXPIRES_IN", 28800),
    refreshExpiresIn: expiresInEnv("JWT_REFRESH_EXPIRES_IN", 604800),
  },

  // Allowed browser origin for CORS. In production this MUST be set to the
  // real frontend origin(s) — never '*'.
  corsOrigin: process.env.CORS_ORIGIN || "http://192.168.0.103:5173",

  // Node-RED runtime used only by the /api/health check (read-only GET).
  nodeRedUrl: process.env.NODE_RED_URL || "http://iot-server:1880/",

  apiRateLimit: {
    windowMs: numberEnv("API_RATE_LIMIT_WINDOW_MS", 900000),
    max: numberEnv("API_RATE_LIMIT_MAX", 500),
  },
};
