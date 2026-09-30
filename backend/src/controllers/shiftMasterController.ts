import type { Request, Response } from 'express';
import * as svc from '../services/shiftMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for Shift Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in shiftMasterService.ts; SQL lives in
// shiftMasterRepository.ts.
// ════════════════════════════════════════════════════════════════════════════

function logSection(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function logRequest(endpoint: string, body: any): void {
  console.log(`\n>> Incoming Request: ${endpoint}`);
  console.log(`   Body: ${JSON.stringify(body, null, 2)}`);
}

function logTiming(ms: number): void {
  console.log(`\n   Execution Time: ${ms}ms`);
}

function fail(res: Response, error: any, action: string, fallbackMessage: string) {
  console.error(`\n   ❌ ERROR in SHIFT MASTER / (${action}): ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /shift-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('SHIFT MASTER — / (list)');
  logRequest('/shift-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   ${result.rows.length} record(s) fetched (total ${result.totalItems})`);
    return res.json({ status: 'success', rows: result.rows, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to fetch shifts');
  }
}

// GET /shift-master/check — duplicate shift code check
export async function checkCode(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('SHIFT MASTER — /check');
  logRequest('/shift-master/check', req.query);

  try {
    const result = await svc.checkCode(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   '${req.query.code}' exists: ${result.exists}`);
    return res.json({ status: 'success', exists: result.exists });
  } catch (error: any) {
    return fail(res, error, 'check', 'Failed to check shift code');
  }
}

// POST /shift-master — add
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('SHIFT MASTER — / (add)');
  logRequest('/shift-master (POST)', req.body);

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(`   BLOCKED: shift '${result.code}' already exists`);
      return res.json({
        status: 'blocked',
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Inserted shift '${result.code}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add shift');
  }
}

// PUT /shift-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('SHIFT MASTER — / (update)');
  logRequest('/shift-master (PUT)', req.body);

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated shift '${result.code}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update shift');
  }
}

// DELETE /shift-master — delete (with reference safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('SHIFT MASTER — / (delete)');
  logRequest('/shift-master (DELETE)', req.query);

  try {
    const result = await svc.deleteRecord(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(
        `   BLOCKED: '${result.code}' is referenced by ${result.references.length} table(s): ${result.references.join(', ')}`,
      );
      return res.json({
        status: 'blocked',
        references: result.references,
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Deleted '${result.code}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete shift');
  }
}
