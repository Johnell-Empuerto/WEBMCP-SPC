import type { Request, Response } from 'express';
import * as svc from '../services/ngMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for NG (Defect) Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in ngMasterService.ts; SQL lives in ngMasterRepository.ts.
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
  console.error(`\n   ❌ ERROR in NG MASTER / (${action}): ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /ng-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG MASTER — / (list)');
  logRequest('/ng-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   ${result.rows.length} record(s) fetched (total ${result.totalItems})`);
    return res.json({ status: 'success', rows: result.rows, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to fetch NG records');
  }
}

// GET /ng-master/check — duplicate defect code check
export async function checkCode(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG MASTER — /check');
  logRequest('/ng-master/check', req.query);

  try {
    const result = await svc.checkCode(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   '${req.query.code}' exists: ${result.exists}`);
    return res.json({ status: 'success', exists: result.exists });
  } catch (error: any) {
    return fail(res, error, 'check', 'Failed to check defect code');
  }
}

// POST /ng-master — add
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG MASTER — / (add)');
  logRequest('/ng-master (POST)', req.body);

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(`   BLOCKED: defect '${result.code}' already exists`);
      return res.json({
        status: 'blocked',
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Inserted defect '${result.code}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add defect');
  }
}

// PUT /ng-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG MASTER — / (update)');
  logRequest('/ng-master (PUT)', req.body);

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated defect '${result.code}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update defect');
  }
}

// DELETE /ng-master — delete (with reference safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG MASTER — / (delete)');
  logRequest('/ng-master (DELETE)', req.query);

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
    return fail(res, error, 'delete', 'Failed to delete defect');
  }
}
