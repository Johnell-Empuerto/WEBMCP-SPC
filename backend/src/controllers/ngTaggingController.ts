// Controller for NG Tagging HTTP requests.
// Handles the request/response layer only — reads query/body params, calls
// the service, and returns the same envelopes the old route returned.
// Business rules belong in ngTaggingService.ts; SQL belongs in
// ngTaggingRepository.ts.

import type { Request, Response } from 'express';
import * as svc from '../services/ngTaggingService';

function logSection(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function logTiming(ms: number): void {
  console.log(`   Execution Time: ${ms}ms`);
}

// GET /ng-tagging/processes — active process codes.
export async function getProcesses(_req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG TAGGING — /processes');

  try {
    const rows = await svc.getProcesses();
    logTiming(Date.now() - startTime);
    console.log(`   ${rows.length} process(es)`);
    return res.json({ status: 'success', rows });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in NG TAGGING /processes: ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch processes' });
  }
}

// GET /ng-tagging/defects — active defects (optionally filtered by process).
export async function getDefects(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG TAGGING — /defects');

  const processCode = String(req.query.processCode ?? '').trim();

  try {
    const rows = await svc.resolveDefects(processCode);
    logTiming(Date.now() - startTime);
    console.log(`   processCode='${processCode}' → ${rows.length} defect(s)`);
    return res.json({ status: 'success', rows });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in NG TAGGING /defects: ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch defects' });
  }
}

// GET /ng-tagging/lookup — look up a product lot + existing NG entries.
export async function lookup(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG TAGGING — /lookup');

  const partsId = String(req.query.partsId ?? '').trim();
  if (!partsId) {
    return res.status(400).json({ status: 'error', message: 'Parts ID is required' });
  }

  try {
    const { row, ngCount } = await svc.lookupPart(partsId);
    logTiming(Date.now() - startTime);
    if (!row) {
      console.log(`   '${partsId}' NOT FOUND in T_TravelogHeader`);
      return res.json({ status: 'success', found: false, ngCount: 0 });
    }
    console.log(`   '${partsId}' → model '${row.model}' status '${row.status}' ngCount ${ngCount}`);
    return res.json({
      status: 'success',
      found: true,
      partsId: row.partsId,
      productCode: row.productCode,
      model: row.model,
      productName: row.productName,
      partStatus: row.status,
      ngCount,
    });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in NG TAGGING /lookup: ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to look up part' });
  }
}

// POST /ng-tagging — tag a product lot as NG.
export async function tag(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG TAGGING — / (tag)');
  const body = req.body ?? {};
  console.log(`   Body: ${JSON.stringify(body)}`);

  try {
    const result = await svc.tagPart(body);

    if (!result.ok) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    logTiming(Date.now() - startTime);
    const partsId = String(body.partsId ?? '').trim();
    const processCode = String(body.processCode ?? '').trim().padStart(2, '0').substring(0, 2);
    console.log(`   Tagged '${partsId}' → NG (${processCode} / ${String(body.defectCode ?? '')} / ${String(body.userCode ?? '')})`);
    return res.json({ status: 'success' });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in NG TAGGING / (tag): ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to tag part as NG' });
  }
}

// GET /ng-tagging — NG history (paginated, filterable).
export async function history(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG TAGGING — / (history)');
  console.log(`   Query: ${JSON.stringify(req.query)}`);

  const size = Math.max(1, Number(req.query.size) || 10);
  const pageno = Math.max(1, Number(req.query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const search = String(req.query.search ?? '').trim();
  const processCode = String(req.query.processCode ?? '').trim();
  const dateFrom = String(req.query.dateFrom ?? '').trim();
  const dateTo = String(req.query.dateTo ?? '').trim();

  try {
    const { rows, totalItems } = await svc.getHistory({ size, offset, search, processCode, dateFrom, dateTo });
    logTiming(Date.now() - startTime);
    console.log(`   ${rows.length} record(s) fetched (total ${totalItems})`);
    return res.json({ status: 'success', rows, totalItems });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in NG TAGGING / (history): ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch NG history' });
  }
}
