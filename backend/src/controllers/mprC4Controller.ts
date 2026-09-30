// Controller for MPR C4 HTTP requests.
// Handles the request/response layer only — it reads the request body, calls
// the service, and returns the same envelope the old route returned.
// Business rules belong in mprC4Service.ts; SQL belongs in
// mprC4Repository.ts.

import type { Request, Response } from 'express';
import * as svc from '../services/mprC4Service';

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

// POST /mpr-c4/data — Plan vs Actual per day/shift (MPR main table + chart).
export async function getData(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('MPR C4 — /data');
  logRequest('/mpr-c4/data', req.body);

  try {
    const result = await svc.getData(req.body ?? {});

    console.log(`   Month: ${result.log.month} (${result.log.startDate} → ${result.log.endDate})`);
    console.log(`   Machine: ${result.log.machine || '(all — C4 only)'} → line '${result.log.machineLine}'`);
    console.log(`   Product: ${result.log.product || '(all models)'}`);

    logTiming(Date.now() - startTime);
    console.log(`   Rows Returned: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`   Sample (first row): ${JSON.stringify(result.rows[0]).substring(0, 900)}`);
    }

    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in MPR C4 /data:`);
    console.error(`   Message: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to load MPR data' });
  }
}

// POST /mpr-c4/ng-data — NG details table.
export async function getNgData(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('MPR C4 — /ng-data');
  logRequest('/mpr-c4/ng-data', req.body);

  try {
    const result = await svc.getNgData(req.body ?? {});

    console.log(`   Month: ${result.log.month} (${result.log.startDate} → ${result.log.endDate})`);
    console.log(`   Machine: ${result.log.machine || '(all — C4 only)'}`);
    console.log(`   Product: ${result.log.product || '(all models)'}`);

    logTiming(Date.now() - startTime);
    console.log(`   Rows Returned: ${result.rows.length}`);

    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in MPR C4 /ng-data:`);
    console.error(`   Message: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to load MPR NG data' });
  }
}
