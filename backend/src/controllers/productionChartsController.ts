// Controller for Production Charts HTTP requests.
// Handles the request/response layer only — reads the request body, calls the
// service, and returns the same envelope the old route returned.
// Business rules belong in productionChartsService.ts; SQL belongs in
// productionChartsRepository.ts.

import type { Request, Response } from 'express';
import * as svc from '../services/productionChartsService';

// POST /production-charts/yearly — yearly analytics for all production lines.
export async function getYearly(req: Request, res: Response) {
  const startTime = Date.now();
  const { year, filters } = req.body ?? {};
  const line = String(filters?.line ?? 'all');
  const product = String(filters?.product ?? '');

  try {
    const result = await svc.getYearly(year, filters ?? {});

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n[Production Charts] Year ${result.year} | line=${line} | product=${product || '(all)'}`);
    console.log(`   Total Plan: ${result.data.summary.totalPlan}, Total Actual: ${result.data.summary.totalActual}, Achievement: ${result.data.summary.achievement}%`);
    console.log(`   WIP: ${result.data.summary.wip}, NG: ${result.data.summary.ng}, FG: ${result.data.summary.fg} | Lines: ${result.data.byLine.length}, Products: ${result.data.byProduct.length}`);
    console.log(`   Execution Time: ${elapsed}ms`);

    return res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in Production Charts /yearly:`);
    console.error(`   Message: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to load production analytics' });
  }
}
