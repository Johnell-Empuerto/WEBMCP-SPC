// Controller:
// Handles the HTTP request and returns the service result.
// It extracts the query parameters, calls the service, and preserves the
// exact success (200), validation (400) and failure (500) behavior of the
// original route. Business and database logic belong in lower layers.

import type { Request, Response } from 'express';
import * as svc from '../services/logsService';

function logSection(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function logRequest(endpoint: string, query: unknown): void {
  console.log(`\n>> Incoming Request: ${endpoint}`);
  console.log(`   Query: ${JSON.stringify(query)}`);
}

// GET /logs — paged log viewer (reproduces legacy /logs exactly).
// Query: { machine, dateFrom, dateTo, search?, size?, pageno? }
export async function getLogs(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('LOGS — /');
  logRequest('/logs', req.query);

  try {
    const result = await svc.getLogs(req.query);

    if (!result.ok) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    console.log(`   machine=${result.machine} rows=${result.rows.length} total=${result.totalItems} (${Date.now() - startTime}ms)`);

    return res.json({
      status: 'success',
      result: result.rows,
      totalItems: result.totalItems,
      page: result.page,
      size: result.size,
      machine: result.machine,
    });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in LOGS /:`);
    console.error(`   Message: ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to load logs' });
  }
}

// GET /logs/options — machine/log-type dropdown (legacy fixed list).
export async function getOptions(_req: Request, res: Response) {
  return res.json({ status: 'success', result: svc.getOptions() });
}