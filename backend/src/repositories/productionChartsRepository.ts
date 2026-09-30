// Repository for Production Charts database access.
// Contains the SQL Server queries for the yearly analytics endpoint. The
// actual-production source (buildActualDataSource) is shared with Production
// Management via ./actualProductionRepository. Business logic (year parsing,
// JS aggregation) belongs in the service; HTTP concerns belong in the
// controller.
//
// The line filter is a whitelist and the product filter is regex-sanitized to
// [a-zA-Z0-9_-] before interpolation — safe by construction.

import sql, { getPool } from '../config/database';
import { buildActualDataSource } from './actualProductionRepository';

export interface ChartsYearlyFilters {
  year: number;
  /** Line filter: 'all' | '1'..'5'. */
  line: string;
  /** Product prefix filter (optional). */
  product: string;
}

// Line filter for the charts module — unlike Production Management's "0"
// (which means ADC lines only), "all" here means ALL production lines
// (ADC 1..3, C4, KD) as required by the yearly dashboard.
function buildLineFilters(line: string): { plan: string; actual: string } {
  if (line === '1' || line === '2' || line === '3') {
    return { plan: ` AND pp.Ppt_Line = 'ADC ${line}'`, actual: ` AND r.Machine_Line = '${line}'` };
  } else if (line === '4') {
    return { plan: ` AND pp.Ppt_Line = 'C4'`, actual: ` AND r.Machine_Line = '4'` };
  } else if (line === '5') {
    return { plan: ` AND pp.Ppt_Line = 'KD'`, actual: ` AND r.Machine_Line = '5'` };
  }
  return { plan: '', actual: '' }; // ALL lines
}

// Product filter — prefix match on the internal product code, matching the
// exact semantics Production Management applies for its product/machine search.
function buildProductFilters(product: string): { plan: string; actual: string } {
  const safe = product?.trim()?.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return { plan: '', actual: '' };
  return {
    plan: ` AND pp.Ppt_ProductCode IN (SELECT Pmt_Productcode FROM T_ProductMaster WHERE Pmt_InternalProdCode LIKE @productPrefix)`,
    actual: ` AND r.Pth_ProductCode IN (SELECT Pmt_Productcode FROM T_ProductMaster WHERE Pmt_InternalProdCode LIKE @productPrefix)`,
  };
}

// POST /production-charts/yearly — plan and actual rows for the whole year.
// The two result sets are merged (FULL OUTER JOIN semantics) in the service.
export async function getYearlyRows(filters: ChartsYearlyFilters): Promise<{
  planRows: any[];
  actualRows: any[];
}> {
  const { year, line, product } = filters;

  const yearStart = `${year}-01-01`;
  const nextYearStart = `${year + 1}-01-01`;
  const lineFilters = buildLineFilters(line);
  const productFilters = buildProductFilters(product);

  // SARGable year-range predicates (same year semantics as the legacy
  // YEAR(CONVERT(DATE, ...)) = @year filter, but index-friendly). KD/C4 use
  // the 05:30 shift-boundary offset so computed production dates land in the
  // same year — identical to Production Management.
  const adcRange = '';
  const kdRange = '';
  const c4Range = '';

  const pool = await getPool();
  const request = pool.request();
  request.input('startDate', sql.NVarChar(19), `${yearStart} 00:00:00`);
  request.input('nextDate', sql.NVarChar(19), `${nextYearStart} 00:00:00`);
  request.input('startKD', sql.NVarChar(19), `${yearStart} 05:30:00`);
  request.input('nextKD', sql.NVarChar(19), `${nextYearStart} 05:30:00`);
  const productPrefix = product.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (productPrefix) {
    request.input('productPrefix', sql.NVarChar(100), `${productPrefix}%`);
  }

  // ── Query 1: Plan (T_ProductionPlanning) ──────────────────────────────
  const planQuery = `
SELECT
    pp.Ppt_Line AS line,
    pp.Ppt_ProductCode AS prodcode,
    SUM(pp.Ppt_PlanQty) AS planqty
FROM T_ProductionPlanning pp
WHERE pp.Ppt_Status IN ('A', 'F')
  AND pp.Ppt_PlanDate >= @startDate AND pp.Ppt_PlanDate < @nextDate
  ${lineFilters.plan}
  ${productFilters.plan}
GROUP BY pp.Ppt_Line, pp.Ppt_ProductCode
`;
  const planResult = await request.query(planQuery);

  // ── Query 2: Actual (base-table equivalent of V_ActualProductionDetail) ─
  const actualQuery = `
SELECT
    r.Machine_Line AS line,
    r.Pth_ProductCode AS prodcode,
    MAX(pm.Pmt_InternalProdCode) AS title,
    SUM(r.Wip_Stat) AS wip,
    SUM(r.Ng_Stat) AS ng,
    SUM(r.Fg_Stat) AS fg
FROM ${buildActualDataSource(adcRange, kdRange, c4Range)} r
LEFT JOIN T_ProductMaster pm ON pm.Pmt_Productcode = r.Pth_ProductCode
WHERE 1=1
  ${lineFilters.actual}
  ${productFilters.actual}
GROUP BY r.Machine_Line, r.Pth_ProductCode
`;
  const actualResult = await request.query(actualQuery);

  return {
    planRows: planResult.recordset ?? [],
    actualRows: actualResult.recordset ?? [],
  };
}
