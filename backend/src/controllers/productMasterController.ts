import type { Request, Response } from 'express';
import * as svc from '../services/productMasterService';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for Product Master.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response in the exact envelope the frontend depends on
// ({ status: 'success' | 'error' | 'duplicate' | 'blocked', ... }).
// Business rules live in productMasterService.ts; SQL lives in
// productMasterRepository.ts.
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
  console.error(`\n   ❌ ERROR in PRODUCT MASTER / (${action}):`);
  console.error(`   Message: ${error.message}`);
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// GET /product-master — list (filters + pagination)
export async function listRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCT MASTER — / (list)');
  logRequest('/product-master', req.query);

  try {
    const result = await svc.listRecords(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Rows Returned: ${result.result.length} / total ${result.totalItems}`);

    return res.json({ status: 'success', result: result.result, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'list', 'Failed to load product master');
  }
}

// GET /product-master/details — single product for the edit modal
export async function getDetails(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCT MASTER — /details');
  logRequest('/product-master/details', req.query);

  try {
    const result = await svc.getDetails(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Rows Returned: ${result.result.length}`);

    return res.json({ status: 'success', result: result.result, totalItems: result.totalItems });
  } catch (error: any) {
    return fail(res, error, 'details', 'Failed to load product details');
  }
}

// POST /product-master — add (duplicate check + INSERT)
export async function addRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCT MASTER — / (add)');
  logRequest('/product-master (POST)', req.body);

  try {
    const result = await svc.addRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.duplicate) {
      console.log(`   Product '${result.prodcode}' already exists → duplicate`);
      return res.json({ status: 'duplicate' });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Inserted '${result.prodcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'add', 'Failed to add product');
  }
}

// PUT /product-master — update
export async function updateRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCT MASTER — / (update)');
  logRequest('/product-master (PUT)', req.body);

  try {
    const result = await svc.updateRecord(req.body);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    logTiming(Date.now() - startTime);
    console.log(`   Updated '${result.prodcode}'`);

    return res.json({ status: 'success', result: [] });
  } catch (error: any) {
    return fail(res, error, 'update', 'Failed to update product');
  }
}

// DELETE /product-master — soft delete (with reference safety guard)
export async function deleteRecord(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCT MASTER — / (delete)');
  logRequest('/product-master (DELETE)', req.query);

  try {
    const result = await svc.deleteRecord(req.query);
    if (!result.ok) return res.status(result.statusCode).json({ status: 'error', message: result.message });

    if (result.blocked) {
      console.log(
        `   BLOCKED: '${result.prodcode}' is referenced by ${result.references.length} table(s): ${result.references.join(', ')}`,
      );
      return res.json({
        status: 'blocked',
        references: result.references,
        message: result.message,
      });
    }

    logTiming(Date.now() - startTime);
    console.log(`   Deleted (soft) '${result.prodcode}'`);

    return res.json({ status: 'success' });
  } catch (error: any) {
    return fail(res, error, 'delete', 'Failed to delete product');
  }
}

// GET /product-master/lookups — all dropdown data in one call
export async function getLookups(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCT MASTER — /lookups');

  try {
    const out = await svc.getLookups();

    logTiming(Date.now() - startTime);
    console.log(
      `   costCenters: ${(out.costCenters ?? []).length}, prodUnits: ${(out.prodUnits ?? []).length}, ` +
        `accountCodes: ${(out.accountCodes ?? []).length}, psGroupCodes: ${(out.psGroupCodes ?? []).length}`,
    );

    return res.json({ status: 'success', result: out });
  } catch (error: any) {
    return fail(res, error, 'lookups', 'Failed to load product lookups');
  }
}
