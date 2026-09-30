import type { Request, Response } from 'express';
import * as svc from '../services/preferenceMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for Preference Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in preferenceMasterService.ts; SQL lives in
// preferenceMasterRepository.ts.
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
  console.error(`\n   ❌ ERROR in PREFERENCE MASTER / (${action}): ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /preference-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PREFERENCE MASTER — / (list)');
  logRequest('/preference-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   ${result.rows.length} record(s) fetched (total ${result.totalItems})`);
    return res.json({ status: 'success', rows: result.rows, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to fetch preferences');
  }
}

// GET /preference-master/groups — distinct parameter groups for the filter
export async function getGroups(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PREFERENCE MASTER — /groups');

  try {
    const result = await svc.getGroups();
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   ${result.groups.length} group(s)`);
    return res.json({ status: 'success', groups: result.groups });
  } catch (error: any) {
    return fail(res, error, 'groups', 'Failed to fetch groups');
  }
}

// GET /preference-master/check — duplicate (group, seq) check
export async function checkKey(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PREFERENCE MASTER — /check');
  logRequest('/preference-master/check', req.query);

  try {
    const result = await svc.checkKey(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   exists: ${result.exists}`);
    return res.json({ status: 'success', exists: result.exists });
  } catch (error: any) {
    return fail(res, error, 'check', 'Failed to check preference');
  }
}

// POST /preference-master — add
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PREFERENCE MASTER — / (add)');
  logRequest('/preference-master (POST)', req.body);

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(`   BLOCKED: preference '${result.parameterid}' seq ${result.seq} already exists`);
      return res.json({
        status: 'blocked',
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Inserted preference '${result.parameterid}' seq ${result.seq}`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add preference');
  }
}

// PUT /preference-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PREFERENCE MASTER — / (update)');
  logRequest('/preference-master (PUT)', req.body);

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated preference '${result.parameterid}' seq ${result.seq}`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update preference');
  }
}

// DELETE /preference-master — delete
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PREFERENCE MASTER — / (delete)');
  logRequest('/preference-master (DELETE)', req.query);

  try {
    const result = await svc.deleteRecord(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Deleted '${result.parameterid}' seq ${result.seq}`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete preference');
  }
}
