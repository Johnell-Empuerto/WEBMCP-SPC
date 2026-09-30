// Controller for NG Report HTTP requests.
// Handles the request/response layer only — reads query params, calls the
// service, and returns the same envelopes the old route returned.
// Business rules belong in ngReportService.ts; SQL belongs in
// ngReportRepository.ts.

import type { Request, Response } from 'express';
import * as svc from '../services/ngReportService';

function logSection(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function logTiming(ms: number): void {
  console.log(`   Execution Time: ${ms}ms`);
}

// GET /ng-report/options — filter dropdown options for the selected period.
export async function getOptions(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG REPORT — /options');
  console.log(`   Query: ${JSON.stringify(req.query)}`);

  try {
    const opts = await svc.getOptions(req.query.year, req.query.month);

    logTiming(Date.now() - startTime);
    console.log(`   Period: ${opts.startDate} → ${opts.endDate}`);
    console.log(`   ${opts.years.length} year(s), ${opts.lines.length} line(s), ${opts.models.length} model(s), ${opts.statuses.length} status(es)`);
    return res.json({ status: 'success', years: opts.years, lines: opts.lines, models: opts.models, shifts: opts.shifts, statuses: opts.statuses });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in NG REPORT /options:`);
    console.error(`   Message: ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch NG report options' });
  }
}

// GET /ng-report — paginated NG records + summary KPIs.
export async function getRecords(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('NG REPORT — / (records)');
  console.log(`   Query: ${JSON.stringify(req.query)}`);

  const size = Math.max(1, Math.min(100, Number(req.query.size) || 10));
  const pageno = Math.max(1, Number(req.query.pageno) || 1);
  const offset = (pageno - 1) * size;

  try {
    const result = await svc.getRecords({
      year: req.query.year,
      month: req.query.month,
      line: req.query.line,
      model: req.query.model,
      shift: req.query.shift,
      status: req.query.status,
      search: req.query.search,
      filters: req.query.filters,
      size,
      offset,
    });

    console.log(`   Search filters: ${result.searchFilterCount > 0 ? `${result.searchFilterCount} active` : '(none)'}`);
    logTiming(Date.now() - startTime);
    console.log(`   ${result.rows.length} record(s) fetched (total ${result.totalItems}), NG qty ${result.summary.totalNgQty}`);
    console.log(`   Top cause '${result.summary.topCause || '—'}', most affected line '${result.summary.mostAffectedLine || '—'}'`);

    return res.json({
      status: 'success',
      rows: result.rows,
      totalItems: result.totalItems,
      summary: result.summary,
    });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in NG REPORT / (records):`);
    console.error(`   Message: ${error.message}`);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch NG report records' });
  }
}
