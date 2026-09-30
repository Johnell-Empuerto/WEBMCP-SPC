import type { Request, Response } from 'express';
import * as svc from '../services/dprMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for DPR Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'blocked', ... }).
// Business rules live in dprMasterService.ts; SQL lives in dprMasterRepository.ts.
// ════════════════════════════════════════════════════════════════════════════

// The legacy route resolved the tab from query first, then body.
function resolveTab(req: Request): string {
  return String(req.query.tab ?? req.body?.tab ?? '').trim();
}

function fail(res: Response, error: any, action: string, fallbackMessage: string) {
  console.error(`\n   ❌ ERROR in DPR MASTER / (${action}): ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /dpr-master — list (tab + search + status filter + sort + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  console.log(`\n>> DPR MASTER — list request: ${JSON.stringify(req.query)}`);

  try {
    const result = await svc.listRecords(resolveTab(req), req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    console.log(
      `   DPR MASTER ${result.tab}: ${result.result.length} rows / total ${result.totalItems} (${Date.now() - startTime}ms)`,
    );
    return res.json({ status: 'success', result: result.result, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to load DPR master records');
  }
}

// POST /dpr-master — create (INSERT)
export async function createRecord(req: Request, res: Response) {
  const startTime = Date.now();
  console.log(`\n>> DPR MASTER — create request: ${JSON.stringify(req.body)}`);

  try {
    const result = await svc.createRecord(resolveTab(req), req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    console.log(
      `   Created ${result.tabLabel} ${result.result.md_Usercode} (${Date.now() - startTime}ms)`,
    );
    return res.json({
      status: 'success',
      result: result.result,
      message: result.message,
    });
  } catch (error: any) {
    return fail(res, error, 'create', 'Failed to save DPR master record');
  }
}

// PUT /dpr-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  console.log(`\n>> DPR MASTER — update request: ${JSON.stringify(req.body)}`);

  try {
    const result = await svc.updateRecord(resolveTab(req), req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    console.log(
      `   Updated ${result.tabLabel} (${result.key}, ${Date.now() - startTime}ms)`,
    );
    return res.json({ status: 'success', message: result.message });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update DPR master record');
  }
}

// DELETE /dpr-master — delete (with reference safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  console.log(`\n>> DPR MASTER — delete request: ${JSON.stringify(req.query)}`);

  try {
    const result = await svc.deleteRecord(resolveTab(req), req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(
        `   BLOCKED: usercode '${result.usercode}' is referenced by ${result.references.length} table(s): ${result.references.join(', ')}`,
      );
      return res.json({
        status: 'blocked',
        references: result.references,
        message: result.message,
      });
    }

    console.log(
      `   Deleted ${result.tabLabel} record id ${result.rowId} (${Date.now() - startTime}ms)`,
    );
    return res.json({ status: 'success', message: result.message });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete DPR master record');
  }
}
