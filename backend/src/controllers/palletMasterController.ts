import type { Request, Response } from 'express';
import * as svc from '../services/palletMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for Pallet Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in palletMasterService.ts; SQL lives in
// palletMasterRepository.ts.
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
  console.error(`\n   ❌ ERROR in PALLET MASTER / (${action}):`);
  console.error(`   Message: ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /pallet-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PALLET MASTER — / (list)');
  logRequest('/pallet-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Rows Returned: ${result.result.length} / total ${result.totalItems}`);

    return res.json({ status: 'success', result: result.result, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to load pallet master');
  }
}

// GET /pallet-master/check — duplicate pallet code check
export async function checkCode(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PALLET MASTER — /check');
  logRequest('/pallet-master/check', req.query);

  try {
    const result = await svc.checkCode(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    const exists = result.result > 0;
    logTiming(Date.now() - startTime);
    console.log(`   Code exists: ${exists ? 'YES' : 'NO'}`);

    return res.json({ status: 'success', result: result.result });
  } catch (error: any) {
    return fail(res, error, 'check', 'Failed to check pallet code');
  }
}

// POST /pallet-master — add
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PALLET MASTER — / (add)');
  logRequest('/pallet-master (POST)', req.body);

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(`   BLOCKED: pallet code '${result.palletcode}' already exists`);
      return res.json({
        status: 'blocked',
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Inserted pallet '${result.palletcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add pallet');
  }
}

// PUT /pallet-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PALLET MASTER — / (update)');
  logRequest('/pallet-master (PUT)', req.body);

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated '${result.palletcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update pallet');
  }
}

// DELETE /pallet-master — delete (with reference safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PALLET MASTER — / (delete)');
  logRequest('/pallet-master (DELETE)', req.query);

  try {
    const result = await svc.deleteRecord(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(
        `   BLOCKED: '${result.palletcode}' is referenced by ${result.references.length} table(s): ${result.references.join(', ')}`,
      );
      return res.json({
        status: 'blocked',
        references: result.references,
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Deleted '${result.palletcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete pallet');
  }
}
