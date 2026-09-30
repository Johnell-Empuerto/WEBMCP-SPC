import type { Request, Response } from 'express';
import * as svc from '../services/locatorMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for Locator Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in locatorMasterService.ts; SQL lives in
// locatorMasterRepository.ts.
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
  console.error(`\n   ❌ ERROR in LOCATOR MASTER / (${action}):`);
  console.error(`   Message: ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /locator-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('LOCATOR MASTER — / (list)');
  logRequest('/locator-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Rows Returned: ${result.result.length} / total ${result.totalItems}`);

    return res.json({ status: 'success', result: result.result, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to load locator master');
  }
}

// GET /locator-master/check — duplicate locator code check
export async function checkCode(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('LOCATOR MASTER — /check');
  logRequest('/locator-master/check', req.query);

  try {
    const result = await svc.checkCode(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    const exists = result.result > 0;
    logTiming(Date.now() - startTime);
    console.log(`   Code exists: ${exists ? 'YES' : 'NO'}`);

    return res.json({ status: 'success', result: result.result });
  } catch (error: any) {
    return fail(res, error, 'check', 'Failed to check locator code');
  }
}

// POST /locator-master — add
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('LOCATOR MASTER — / (add)');
  logRequest('/locator-master (POST)', req.body);

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(`   BLOCKED: locator code '${result.locatorcode}' already exists`);
      return res.json({
        status: 'blocked',
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Inserted locator '${result.locatorcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add locator');
  }
}

// PUT /locator-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('LOCATOR MASTER — / (update)');
  logRequest('/locator-master (PUT)', req.body);

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated '${result.locatorcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update locator');
  }
}

// DELETE /locator-master — delete (with reference safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('LOCATOR MASTER — / (delete)');
  logRequest('/locator-master (DELETE)', req.query);

  try {
    const result = await svc.deleteRecord(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(
        `   BLOCKED: '${result.locatorcode}' is referenced by ${result.references.length} table(s): ${result.references.join(', ')}`,
      );
      return res.json({
        status: 'blocked',
        references: result.references,
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Deleted '${result.locatorcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete locator');
  }
}
