import type { Request, Response } from 'express';
import * as svc from '../services/userMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for User Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in userMasterService.ts; SQL lives in
// userMasterRepository.ts.
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
  console.error(`\n   ❌ ERROR in USER MASTER / (${action}): ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /user-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('USER MASTER — / (list)');
  logRequest('/user-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   ${result.rows.length} record(s) fetched (total ${result.totalItems})`);
    return res.json({ status: 'success', rows: result.rows, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to fetch users');
  }
}

// GET /user-master/check — duplicate user code check
export async function checkCode(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('USER MASTER — /check');
  logRequest('/user-master/check', req.query);

  try {
    const result = await svc.checkCode(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   '${req.query.usercode}' exists: ${result.exists}`);
    return res.json({ status: 'success', exists: result.exists });
  } catch (error: any) {
    return fail(res, error, 'check', 'Failed to check user code');
  }
}

// POST /user-master — add
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('USER MASTER — / (add)');
  // Never log the raw password — only whether one was provided.
  logRequest('/user-master (POST)', { ...req.body, password: req.body.password ? '***' : '' });

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(`   BLOCKED: user '${result.usercode}' already exists`);
      return res.json({
        status: 'blocked',
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Inserted user '${result.usercode}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add user');
  }
}

// PUT /user-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('USER MASTER — / (update)');
  // Never log the raw password — only whether one was provided.
  logRequest('/user-master (PUT)', { ...req.body, password: req.body.password ? '***' : '' });

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated user '${result.usercode}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update user');
  }
}

// DELETE /user-master — delete (with safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('USER MASTER — / (delete)');
  logRequest('/user-master (DELETE)', req.query);

  try {
    const result = await svc.deleteRecord(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(
        `   BLOCKED: '${result.usercode}' ${result.references.length > 0
          ? `is referenced by ${result.references.length} table(s): ${result.references.join(', ')}`
          : result.message}`,
      );
      return res.json({
        status: 'blocked',
        ...(result.references.length > 0 ? { references: result.references } : {}),
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Deleted '${result.usercode}'`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete user');
  }
}
