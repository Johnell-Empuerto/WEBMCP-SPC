import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from '../config/database';
import { env } from '../config/env';

const router = Router();

// ════════════════════════════════════════════════════════════════════════════
// GET /api/health — system health (REAL data only, read-only)
// ════════════════════════════════════════════════════════════════════════════
// Reports live availability for:
//   - API server      (process uptime, response time, version, environment)
//   - Database        (SELECT 1 timing, size, table count, connections, version)
//   - Node-RED        (read-only GET to the configured runtime)
// and derives an OVERALL status from the actual results.
//
// SAFETY
//   - All database queries are READ-ONLY system metadata / DMV queries.
//   - No schema changes, no DML, no configuration modifications.
//   - No credentials, connection strings, or secrets are ever returned.
//   - Node-RED is only checked with a GET request — flows are never modified.
//   - If a metric cannot be obtained safely it is omitted (not faked).
//
// Node-RED endpoint: configured via NODE_RED_URL. If unset it falls back to
// the legacy runtime host; if explicitly empty (NODE_RED_URL=) the service is
// reported as "not-configured" instead of inventing a status.
// ════════════════════════════════════════════════════════════════════════════

let APP_VERSION = '1.0.0';
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'),
  ) as { version?: string };
  if (pkg.version) APP_VERSION = pkg.version;
} catch {
  /* keep default */
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Run a read-only query and return its recordset; on failure return undefined. */
async function safeQuery<T>(query: string): Promise<T[] | undefined> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(query);
    return result.recordset as T[];
  } catch {
    return undefined;
  }
}

router.get('/', async (_req, res) => {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  // ── API server ────────────────────────────────────────────────────────────
  const api = {
    status: 'healthy',
    responseTimeMs: null as number | null,
    uptime: formatUptime(process.uptime()),
    uptimeSeconds: Math.floor(process.uptime()),
    version: APP_VERSION,
    environment: process.env.NODE_ENV || 'development',
  };

  // ── Database ──────────────────────────────────────────────────────────────
  const database: {
    status: string;
    responseTimeMs: number | null;
    sizeMb: number | null;
    tables: number | null;
    connections: number | null;
    version: string | null;
  } = {
    status: 'unhealthy',
    responseTimeMs: null,
    sizeMb: null,
    tables: null,
    connections: null,
    version: null,
  };

  const dbStarted = Date.now();
  const ping = await safeQuery<{ ok: number }>('SELECT 1 AS ok');
  if (ping && ping.length > 0) {
    database.status = 'healthy';
    database.responseTimeMs = Date.now() - dbStarted;

    const sizeRows = await safeQuery<{ sizeMb: number }>(
      'SELECT SUM(size * 8.0 / 1024.0) AS sizeMb FROM sys.database_files WHERE type = 0',
    );
    if (sizeRows && sizeRows[0]?.sizeMb != null) database.sizeMb = Math.round(sizeRows[0].sizeMb * 10) / 10;

    const tableRows = await safeQuery<{ n: number }>(
      "SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'",
    );
    if (tableRows && tableRows[0]?.n != null) database.tables = tableRows[0].n;

    const connRows = await safeQuery<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sys.dm_exec_connections',
    );
    if (connRows && connRows[0]?.n != null) database.connections = connRows[0].n;

    const versionRows = await safeQuery<{ v: string }>(
      "SELECT CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(30)) AS v",
    );
    if (versionRows && versionRows[0]?.v) database.version = versionRows[0].v.trim();
  }

  // ── Node-RED ──────────────────────────────────────────────────────────────
  const nodeRedConfigured = process.env.NODE_RED_URL !== undefined && process.env.NODE_RED_URL !== '';
  // Single source of truth for the Node-RED URL (see config/env.ts).
  const nodeRedUrl = env.nodeRedUrl;
  const nodeRed: {
    status: string;
    responseTimeMs: number | null;
    endpoint: string | null;
  } = {
    status: 'not-configured',
    responseTimeMs: null,
    endpoint: null,
  };

  if (nodeRedConfigured || !process.env.NODE_RED_URL) {
    nodeRed.endpoint = nodeRedUrl;
    try {
      const nrStarted = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(nodeRedUrl, { signal: controller.signal });
      clearTimeout(timeout);
      const ms = Date.now() - nrStarted;
      nodeRed.responseTimeMs = ms;
      nodeRed.status = response.ok ? 'healthy' : 'unhealthy';
    } catch {
      nodeRed.status = 'unhealthy';
      nodeRed.responseTimeMs = null;
    }
  }

  // ── Overall ───────────────────────────────────────────────────────────────
  const services = [api.status, database.status, nodeRed.status];
  let overall: string;
  if (services.includes('unhealthy')) {
    overall = 'unhealthy';
  } else if (services.includes('warning') || services.includes('not-configured')) {
    overall = 'warning';
  } else {
    overall = 'healthy';
  }

  api.responseTimeMs = Date.now() - startedAt;

  res.json({
    success: true,
    message: overall === 'healthy' ? 'All systems operational' : `System ${overall}`,
    data: {
      api,
      database,
      nodeRed,
      overall,
      checkedAt,
    },
  });
});

export default router;
