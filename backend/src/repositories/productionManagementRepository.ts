// Repository for Production Management database access.
// Contains the SQL Server queries for the four Production Calendar endpoints
// (calendar-events, product-details, monthly-summary, daily-details). The
// actual-production source (buildActualDataSource) is shared with Production
// Charts via ./actualProductionRepository. Business logic (date resolution,
// response mapping) belongs in the service; HTTP concerns belong in the
// controller.
//
// The line filter is a whitelist ('0'..'5') and the machine/product filter is
// regex-sanitized to [a-zA-Z0-9_-] before interpolation — safe by construction
// (identical to the legacy builder).

import sql, { getPool } from '../config/database';
import { buildActualDataSource } from './actualProductionRepository';

export interface PmQueryFilters {
  /** Normalized 'YYYY-MM-DD' date (resolved by the service). */
  date: string;
  /** Line filter: '0' (all ADC) | '1'..'5'. */
  line: string;
  /** Machine/product prefix filter (optional). */
  machine: string;
}

// ── Date helpers (SQL range computation) ────────────────────────────────────
function getFirstDateOfMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().split('T')[0];
}

function getLastDateOfMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().split('T')[0];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Filter builders (whitelist / regex-sanitized — safe by construction) ────
function buildLineFilter(line: string): string {
  // Input validation — only allow known values
  if (line === '1' || line === '2' || line === '3') {
    return ` AND (pp.Ppt_Line = 'ADC ${line}' OR va.Machine_Line = '${line}')`;
  } else if (line === '4') {
    return ` AND (pp.Ppt_Line = 'C4' OR va.Machine_Line = '4')`;
  } else if (line === '5') {
    return ` AND (pp.Ppt_Line = 'KD' OR va.Machine_Line = '5')`;
  } else {
    // line === '0' or anything else — all ADC lines
    return ` AND (pp.Ppt_Line IN ('ADC 1', 'ADC 2', 'ADC 3') OR va.Machine_Line IN ('1', '2', '3'))`;
  }
}

function buildMachineFilter(machine: string): { planFilter: string; joinFilter: string } {
  if (!machine || machine.trim() === '') {
    return { planFilter: '', joinFilter: '' };
  }
  // Sanitize: only allow alphanumeric, hyphens, underscores (product code chars)
  const safe = machine.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return { planFilter: '', joinFilter: '' };
  return {
    planFilter: ` AND pm.Pmt_InternalProdCode LIKE '${safe}%'`,
    joinFilter: ` WHERE Pth_ProductCode IN (SELECT Pmt_Productcode FROM T_ProductMaster WHERE Pmt_InternalProdCode LIKE '${safe}%')`,
  };
}

// The SARGable date-range predicates pushed INTO each branch of the actual
// data source so SQL Server seeks instead of scanning every travelog row.
// Replaces CONVERT(DATE, ...) BETWEEN which prevented index usage.
// Semantics match the outer WHERE exactly:
//   ADC  — production date IS the header date (no shift adjustment):
//          header datetime in [startDate, nextDate)
//   KD/C4 — production date = detail input date shifted back at the 05:30
//          boundary, so input datetime in [startKD, nextKD)
// All four params (@startDate/@nextDate/@startKD/@nextKD) are bound by every
// caller of these queries.
function buildRanges(): {
  adcRange: string;
  kdRange: string;
  c4Range: string;
} {
  return {
    adcRange:
      ' AND h.Pth_ReqInputDate >= @startDate AND h.Pth_ReqInputDate < @nextDate',
    kdRange:
      ' AND d.Ptd_InputActualDate >= @startKD AND d.Ptd_InputActualDate < @nextKD',
    c4Range:
      ' AND c4.Ptd_InputActualDate >= @startKD AND c4.Ptd_InputActualDate < @nextKD',
  };
}

// POST /production-management/calendar-events — FULL OUTER JOIN of plan and
// actual, returns 2 events per product per day (Planned + Actual). The caller
// maps rows into calendar events.
export async function getCalendarEvents(filters: PmQueryFilters): Promise<any[]> {
  const { date, line, machine } = filters;

  const firstDay = getFirstDateOfMonth(date);
  const lastDay = getLastDateOfMonth(date);
  const nextMonthStart = addMonths(firstDay, 1);

  const lineFilter = buildLineFilter(line);
  const machineFilters = buildMachineFilter(machine);
  const { adcRange, kdRange, c4Range } = buildRanges();

  const query = `
WITH PlanData AS (
    SELECT
        CONVERT(DATE, Ppt_PlanDate) AS Ppt_PlanDate,
        Ppt_ProductCode,
        Ppt_Line,
        Ppt_CostCenterCode,
        SUM(Ppt_PlanQty) AS Ppt_PlanQty
    FROM T_ProductionPlanning
    WHERE Ppt_Status IN ('A', 'F')
    GROUP BY
        CONVERT(DATE, Ppt_PlanDate),
        Ppt_ProductCode,
        Ppt_Line,
        Ppt_CostCenterCode
),
ActualData AS (
    SELECT
        CONVERT(DATE, r.Pth_ReqInputDate) AS Pth_ReqInputDate,
        r.Pth_ProductCode,
        r.Machine_Line,
        r.Scm_ShiftCode,
        SUM(r.Wip_Stat) AS Total_WIP,
        SUM(r.Ng_Stat) AS Total_NG,
        SUM(r.Fg_Stat) AS Total_FG
    FROM ${buildActualDataSource(adcRange, kdRange, c4Range)} r
    ${machineFilters.joinFilter || 'WHERE 1=1'}
    GROUP BY
        CONVERT(DATE, r.Pth_ReqInputDate),
        r.Pth_ProductCode,
        r.Machine_Line,
        r.Scm_ShiftCode
)
SELECT
    COALESCE(pp.Ppt_PlanDate, va.Pth_ReqInputDate) AS plandate,
    COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode) AS prodcode,
    COALESCE(
        CASE
            WHEN va.Machine_Line = '1' THEN 'ADC 1'
            WHEN va.Machine_Line = '2' THEN 'ADC 2'
            WHEN va.Machine_Line = '3' THEN 'ADC 3'
            WHEN va.Machine_Line = '4' THEN 'C4'
            WHEN va.Machine_Line = '5' THEN 'KD'
            ELSE NULL
        END,
        pp.Ppt_Line
    ) AS line,
    ISNULL(pp.Ppt_PlanQty, 0) AS planqty,
    ISNULL(va.Total_WIP, 0) + ISNULL(va.Total_NG, 0) + ISNULL(va.Total_FG, 0) AS actqty,
    pm.Pmt_InternalProdCode AS product_alias,
    ISNULL(va.Total_WIP, 0) AS wip_qty,
    ISNULL(va.Total_NG, 0) AS ng_qty,
    ISNULL(va.Total_FG, 0) AS fg_qty,
    COALESCE(
        CASE
            WHEN va.Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
            WHEN va.Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
            WHEN va.Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
            WHEN pp.Ppt_CostCenterCode = '010109' THEN 'Shift 1'
            WHEN pp.Ppt_CostCenterCode = '010110' THEN 'Shift 2'
            WHEN pp.Ppt_CostCenterCode = '010111' THEN 'Shift 3'
            ELSE 'Unknown'
        END,
        'Unknown'
    ) AS ShiftName
FROM PlanData pp
FULL OUTER JOIN ActualData va
    ON pp.Ppt_ProductCode = va.Pth_ProductCode
    AND pp.Ppt_Line = CASE
        WHEN va.Machine_Line = '1' THEN 'ADC 1'
        WHEN va.Machine_Line = '2' THEN 'ADC 2'
        WHEN va.Machine_Line = '3' THEN 'ADC 3'
        WHEN va.Machine_Line = '4' THEN 'C4'
        WHEN va.Machine_Line = '5' THEN 'KD'
        ELSE NULL
    END
    AND pp.Ppt_PlanDate = va.Pth_ReqInputDate
    AND (
        (pp.Ppt_CostCenterCode = '010109' AND va.Scm_ShiftCode = 'Shift01')
        OR (pp.Ppt_CostCenterCode = '010110' AND va.Scm_ShiftCode = 'Shift02')
        OR (pp.Ppt_CostCenterCode = '010111' AND va.Scm_ShiftCode = 'Shift03')
    )
LEFT JOIN T_ProductMaster AS pm
    ON pm.Pmt_Productcode = COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode)
WHERE
    (pp.Ppt_PlanDate BETWEEN @firstDay AND @lastDay
     OR va.Pth_ReqInputDate BETWEEN @firstDay AND @lastDay)
    ${lineFilter}
    ${machineFilters.planFilter}
ORDER BY
    plandate ASC,
    line ASC,
    prodcode ASC,
    ShiftName ASC
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('firstDay', sql.NVarChar(10), firstDay);
  request.input('lastDay', sql.NVarChar(10), lastDay);
  request.input('startDate', sql.NVarChar(19), `${firstDay} 00:00:00`);
  request.input('nextDate', sql.NVarChar(19), `${nextMonthStart} 00:00:00`);
  request.input('startKD', sql.NVarChar(19), `${firstDay} 05:30:00`);
  request.input('nextKD', sql.NVarChar(19), `${nextMonthStart} 05:30:00`);

  const result = await request.query(query);
  return result.recordset;
}

// POST /production-management/product-details — product-level summary with
// plan vs actual (WIP+NG+FG), grouped by month.
export async function getProductDetails(filters: PmQueryFilters): Promise<any[]> {
  const { date, line, machine } = filters;

  const firstDay = getFirstDateOfMonth(date);
  const lastDay = getLastDateOfMonth(date);
  const nextMonthStart = addMonths(firstDay, 1);

  const lineFilter = buildLineFilter(line);
  const machineFilters = buildMachineFilter(machine);
  const { adcRange, kdRange, c4Range } = buildRanges();

  const query = `
SELECT
    pm.Pmt_InternalProdCode AS title,
    COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode) AS prodcode,
    ISNULL(SUM(pp.Ppt_PlanQty), 0) AS planqty,
    ISNULL(SUM(va.Total_WIP), 0) AS Total_WIP,
    ISNULL(SUM(va.Total_NG), 0) AS Total_NG,
    ISNULL(SUM(va.Total_FG), 0) AS Total_FG
FROM (
    SELECT
        CONVERT(DATE, Ppt_PlanDate) AS Ppt_PlanDate,
        Ppt_ProductCode,
        Ppt_Line,
        SUM(Ppt_PlanQty) AS Ppt_PlanQty
    FROM T_ProductionPlanning
    WHERE Ppt_Status IN ('A', 'F')
    GROUP BY
        CONVERT(DATE, Ppt_PlanDate),
        Ppt_ProductCode,
        Ppt_Line
) AS pp
FULL OUTER JOIN (
    SELECT
        CONVERT(DATE, r.Pth_ReqInputDate) AS Pth_ReqInputDate,
        r.Pth_ProductCode,
        r.Machine_Line,
        SUM(r.Wip_Stat) AS Total_WIP,
        SUM(r.Ng_Stat) AS Total_NG,
        SUM(r.Fg_Stat) AS Total_FG,
        SUM(r.Wip_Stat) + SUM(r.Ng_Stat) + SUM(r.Fg_Stat) AS TotalQty
    FROM ${buildActualDataSource(adcRange, kdRange, c4Range)} r
    ${machineFilters.joinFilter || 'WHERE 1=1'}
    GROUP BY
        CONVERT(DATE, r.Pth_ReqInputDate),
        r.Pth_ProductCode,
        r.Machine_Line
) AS va
    ON pp.Ppt_ProductCode = va.Pth_ProductCode
    AND pp.Ppt_Line = CASE
        WHEN va.Machine_Line = '1' THEN 'ADC 1'
        WHEN va.Machine_Line = '2' THEN 'ADC 2'
        WHEN va.Machine_Line = '3' THEN 'ADC 3'
        WHEN va.Machine_Line = '4' THEN 'C4'
        WHEN va.Machine_Line = '5' THEN 'KD'
        ELSE NULL
    END
    AND pp.Ppt_PlanDate = va.Pth_ReqInputDate
LEFT JOIN T_ProductMaster AS pm
    ON pm.Pmt_Productcode = COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode)
WHERE
    (pp.Ppt_PlanDate BETWEEN @firstDay AND @lastDay
     OR va.Pth_ReqInputDate BETWEEN @firstDay AND @lastDay)
    ${lineFilter}
    ${machineFilters.planFilter}
GROUP BY
    pm.Pmt_InternalProdCode,
    COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode)
ORDER BY
    COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode) ASC
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('firstDay', sql.NVarChar(10), firstDay);
  request.input('lastDay', sql.NVarChar(10), lastDay);
  request.input('startDate', sql.NVarChar(19), `${firstDay} 00:00:00`);
  request.input('nextDate', sql.NVarChar(19), `${nextMonthStart} 00:00:00`);
  request.input('startKD', sql.NVarChar(19), `${firstDay} 05:30:00`);
  request.input('nextKD', sql.NVarChar(19), `${nextMonthStart} 05:30:00`);

  const result = await request.query(query);
  return result.recordset;
}

// POST /production-management/monthly-summary — plan vs actual aggregated per
// month for the year of the selected date (used by the Jan..Dec chart).
export async function getMonthlySummary(filters: PmQueryFilters): Promise<any[]> {
  const { date, line, machine } = filters;

  const year = new Date(date + 'T00:00:00Z').getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const nextYearStart = `${year + 1}-01-01`;

  const lineFilter = buildLineFilter(line);
  const machineFilters = buildMachineFilter(machine);
  const { adcRange, kdRange, c4Range } = buildRanges();

  const query = `
WITH PlanData AS (
    SELECT
        MONTH(Ppt_PlanDate) AS planMonth,
        Ppt_ProductCode,
        Ppt_Line,
        SUM(Ppt_PlanQty) AS Ppt_PlanQty
    FROM T_ProductionPlanning
    WHERE Ppt_Status IN ('A', 'F')
      AND YEAR(CONVERT(DATE, Ppt_PlanDate)) = @year
    GROUP BY MONTH(Ppt_PlanDate), Ppt_ProductCode, Ppt_Line
),
ActualData AS (
    SELECT
        MONTH(r.Pth_ReqInputDate) AS actMonth,
        r.Pth_ProductCode,
        r.Machine_Line,
        SUM(r.Wip_Stat) + SUM(r.Ng_Stat) + SUM(r.Fg_Stat) AS actQty
    FROM ${buildActualDataSource(adcRange, kdRange, c4Range)} r
    ${machineFilters.joinFilter || 'WHERE 1=1'}
      AND YEAR(CONVERT(DATE, r.Pth_ReqInputDate)) = @year
    GROUP BY MONTH(r.Pth_ReqInputDate), r.Pth_ProductCode, r.Machine_Line
)
SELECT
    COALESCE(pp.planMonth, va.actMonth) AS month,
    ISNULL(SUM(pp.Ppt_PlanQty), 0) AS planqty,
    ISNULL(SUM(va.actQty), 0) AS actqty
FROM PlanData pp
FULL OUTER JOIN ActualData va
    ON pp.planMonth = va.actMonth
    AND pp.Ppt_ProductCode = va.Pth_ProductCode
    AND pp.Ppt_Line = CASE
        WHEN va.Machine_Line = '1' THEN 'ADC 1'
        WHEN va.Machine_Line = '2' THEN 'ADC 2'
        WHEN va.Machine_Line = '3' THEN 'ADC 3'
        WHEN va.Machine_Line = '4' THEN 'C4'
        WHEN va.Machine_Line = '5' THEN 'KD'
        ELSE NULL
    END
LEFT JOIN T_ProductMaster AS pm
    ON pm.Pmt_Productcode = COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode)
WHERE (pp.planMonth IS NOT NULL OR va.actMonth IS NOT NULL)
    ${lineFilter}
    ${machineFilters.planFilter}
GROUP BY COALESCE(pp.planMonth, va.actMonth)
ORDER BY COALESCE(pp.planMonth, va.actMonth) ASC
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('year', sql.Int, year);
  request.input('startDate', sql.NVarChar(19), `${yearStart} 00:00:00`);
  request.input('nextDate', sql.NVarChar(19), `${nextYearStart} 00:00:00`);
  request.input('startKD', sql.NVarChar(19), `${yearStart} 05:30:00`);
  request.input('nextKD', sql.NVarChar(19), `${nextYearStart} 05:30:00`);

  const result = await request.query(query);
  return result.recordset;
}

// POST /production-management/daily-details — shift-by-shift production
// details for a specific date.
export async function getDailyDetails(filters: PmQueryFilters): Promise<any[]> {
  const { date, line, machine } = filters;

  const nextDayDate = addDays(date, 1);

  const lineFilter = buildLineFilter(line);
  let machineFilter = '';
  if (machine && machine.trim() !== '') {
    const safe = machine.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safe) {
      machineFilter = ` AND pm.Pmt_InternalProdCode LIKE '${safe}%'`;
    }
  }

  // SARGable single-day range (same day semantics as CONVERT(DATE, ...) = @queryDate).
  const { adcRange, kdRange, c4Range } = buildRanges();

  const query = `
WITH PlanData AS (
    SELECT
        CONVERT(DATE, Ppt_PlanDate) AS Ppt_PlanDate,
        Ppt_ProductCode,
        Ppt_Line,
        Ppt_CostCenterCode,
        SUM(Ppt_PlanQty) AS Ppt_PlanQty
    FROM T_ProductionPlanning
    WHERE Ppt_Status IN ('A', 'F')
    GROUP BY
        CONVERT(DATE, Ppt_PlanDate),
        Ppt_ProductCode,
        Ppt_Line,
        Ppt_CostCenterCode
),
ActualData AS (
    SELECT
        CONVERT(DATE, r.Pth_ReqInputDate) AS Pth_ReqInputDate,
        r.Pth_ProductCode,
        r.Machine_Line,
        r.Scm_ShiftCode,
        SUM(r.Wip_Stat) AS Total_WIP,
        SUM(r.Ng_Stat) AS Total_NG,
        SUM(r.Fg_Stat) AS Total_FG
    FROM ${buildActualDataSource(adcRange, kdRange, c4Range)} r
    WHERE CONVERT(DATE, r.Pth_ReqInputDate) = @queryDate
    GROUP BY
        CONVERT(DATE, r.Pth_ReqInputDate),
        r.Pth_ProductCode,
        r.Machine_Line,
        r.Scm_ShiftCode
)
SELECT
    pm.Pmt_InternalProdCode AS title,
    COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode) AS prodcode,
    COALESCE(pp.Ppt_PlanDate, va.Pth_ReqInputDate) AS plandate,
    ISNULL(pp.Ppt_PlanQty, 0) AS planqty,
    ISNULL(va.Total_WIP, 0) AS Total_WIP,
    ISNULL(va.Total_NG, 0) AS Total_NG,
    ISNULL(va.Total_FG, 0) AS Total_FG,
    COALESCE(
        CASE
            WHEN va.Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
            WHEN va.Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
            WHEN va.Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
            WHEN pp.Ppt_CostCenterCode = '010109' THEN 'Shift 1'
            WHEN pp.Ppt_CostCenterCode = '010110' THEN 'Shift 2'
            WHEN pp.Ppt_CostCenterCode = '010111' THEN 'Shift 3'
            ELSE 'Unknown'
        END,
        'Unknown'
    ) AS ShiftName
FROM PlanData pp
FULL OUTER JOIN ActualData va
    ON pp.Ppt_ProductCode = va.Pth_ProductCode
    AND pp.Ppt_Line = CASE
        WHEN va.Machine_Line = '1' THEN 'ADC 1'
        WHEN va.Machine_Line = '2' THEN 'ADC 2'
        WHEN va.Machine_Line = '3' THEN 'ADC 3'
        WHEN va.Machine_Line = '4' THEN 'C4'
        WHEN va.Machine_Line = '5' THEN 'KD'
        ELSE NULL
    END
    AND pp.Ppt_PlanDate = va.Pth_ReqInputDate
    AND (
        (pp.Ppt_CostCenterCode = '010109' AND va.Scm_ShiftCode = 'Shift01')
        OR (pp.Ppt_CostCenterCode = '010110' AND va.Scm_ShiftCode = 'Shift02')
        OR (pp.Ppt_CostCenterCode = '010111' AND va.Scm_ShiftCode = 'Shift03')
    )
LEFT JOIN T_ProductMaster AS pm
    ON pm.Pmt_Productcode = COALESCE(pp.Ppt_ProductCode, va.Pth_ProductCode)
WHERE
    (pp.Ppt_PlanDate = @queryDate OR va.Pth_ReqInputDate = @queryDate)
    ${lineFilter}
    ${machineFilter}
ORDER BY
    plandate ASC,
    title ASC,
    ShiftName ASC
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('queryDate', sql.NVarChar(10), date);
  request.input('startDate', sql.NVarChar(19), `${date} 00:00:00`);
  request.input('nextDate', sql.NVarChar(19), `${nextDayDate} 00:00:00`);
  request.input('startKD', sql.NVarChar(19), `${date} 05:30:00`);
  request.input('nextKD', sql.NVarChar(19), `${nextDayDate} 05:30:00`);

  const result = await request.query(query);
  return result.recordset;
}
