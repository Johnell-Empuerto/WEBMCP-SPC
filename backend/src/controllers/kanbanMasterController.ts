import type { Request, Response } from 'express';
import * as svc from '../services/kanbanMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for Kanban Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in kanbanMasterService.ts; SQL lives in
// kanbanMasterRepository.ts.
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
  console.error(`\n   ❌ ERROR in KANBAN MASTER / (${action}):`);
  console.error(`   Message: ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /kanban-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('KANBAN MASTER — / (list)');
  logRequest('/kanban-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Rows Returned: ${result.result.length} / total ${result.totalItems}`);

    return res.json({ status: 'success', result: result.result, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to load kanban master');
  }
}

// POST /kanban-master — add (auto Kanban-ID + INSERT)
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('KANBAN MASTER — / (add)');
  logRequest('/kanban-master (POST)', req.body);

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log('   Inserted Kanban');

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add kanban');
  }
}

// PUT /kanban-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('KANBAN MASTER — / (update)');
  logRequest('/kanban-master (PUT)', req.body);

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated '${result.kanbanid}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update kanban');
  }
}

// DELETE /kanban-master — delete (with reference safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('KANBAN MASTER — / (delete)');
  logRequest('/kanban-master (DELETE)', req.query);

  try {
    const result = await svc.deleteRecord(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(
        `   BLOCKED: '${result.kanbanid}' is referenced by ${result.references.length} table(s): ${result.references.join(', ')}`,
      );
      return res.json({
        status: 'blocked',
        references: result.references,
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Deleted '${result.kanbanid}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete kanban');
  }
}

// GET /kanban-master/lookups — dropdown data in one call
export async function getLookups(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('KANBAN MASTER — /lookups');

  try {
    const { partNos, locators } = await svc.getLookups();

    logTiming(Date.now() - startTime);
    console.log(`   partNos: ${partNos.length}, locators: ${locators.length}`);

    return res.json({ status: 'success', result: { partNos, locators } });
  } catch (error: any) {
    return fail(res, error, 'lookups', 'Failed to load kanban lookups');
  }
}
