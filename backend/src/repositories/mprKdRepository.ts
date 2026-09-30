// Repository for MPR KD database access.
// Contains the SQL Server queries for the Monthly Production Record (KD)
// module. These queries reproduce the LIVE legacy Node-RED /fetchkd-data
// variant (node c3805995a39e7992, builder 544f202552d42f9b — FULL OUTER JOIN,
// Total_WIP = NG + FG) and /fetchkd-ng-data (node 50da6f4b5961704b) exactly.
// Business logic (month parsing, machine mapping) belongs in the service; HTTP
// concerns belong in the controller.
//
// Everything is parameterized — no SQL string concatenation of user input.
// The only interpolation is the fixed KD machine line '5' (whitelist value).

import sql, { getPool } from '../config/database';

export interface MprKdQueryFilters {
  startDate: string;
  endDate: string;
  /** Always '5' (KD is a single line). */
  machineLine: string;
  /** Exact product code (optional). */
  product?: string;
}

export interface MprKdNgQueryFilters {
  startDate: string;
  endDate: string;
  /** Raw selected machine ('KD' or empty) — decides the = vs IN condition. */
  machine: string;
  /** Exact product code (optional). */
  product?: string;
}

// POST /mpr-kd/data — Plan vs Actual per day/shift (MPR main table + chart).
// Reproduces the live /fetchkd-data query (enabled node c3805995a39e7992
// builder 544f202552d42f9b) with parameterized values.
export async function getMprKdData(filters: MprKdQueryFilters): Promise<any[]> {
  const { startDate, endDate, machineLine, product } = filters;

  // machineCondition applies to the OUTER query: plan rows must be line 'KD',
  // actual rows must be Machine_Line '5' (both branches of the legacy builder
  // collapse to the same values for a single-line map).
  const machineCondition = `(p.Line = 'KD' OR a.Line = '${machineLine}')`;

  // Product condition applies to BOTH plan (Ppt_ProductCode) and actual
  // (Pth_ProductCode) — same as the legacy builder.
  const productCondition = product
    ? `(p.ProductCode = @product OR a.ProductCode = @product)`
    : '';

  const query = `
WITH PlanData AS (
    SELECT
        CONVERT(DATE, Ppt_PlanDate) AS PlanDate,
        Ppt_ProductCode AS ProductCode,
        Ppt_Line AS Line,
        MAX(Ppt_CostCenterCode) AS CostCenterCode,
        SUM(Ppt_PlanQty) AS PlanQty
    FROM T_ProductionPlanning
    WHERE
        Ppt_Status IN ('A', 'F')
        AND CONVERT(DATE, Ppt_PlanDate) BETWEEN @startDate AND @endDate
    GROUP BY
        CONVERT(DATE, Ppt_PlanDate),
        Ppt_ProductCode,
        Ppt_Line
),
ActualData AS (
    SELECT
        CONVERT(DATE, Pth_ReqInputDate) AS ActualDate,
        Pth_ProductCode AS ProductCode,
        Machine_Line AS Line,
        Scm_ShiftCode AS ShiftCode,
        SUM(Ng_Stat + Fg_Stat) AS Total_WIP,
        SUM(Ng_Stat) AS Total_NG,
        SUM(Fg_Stat) AS Total_FG,
        SUBSTRING(Pth_ProductLotNo, 13, 1) AS DieNo,
        MAX(Dfm_DefectDesc) AS Dfm_DefectDesc,
        MAX(Dfm_status) AS Dfm_status
    FROM V_ActualProductionDetail
    WHERE
        CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
        AND Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')
    GROUP BY
        CONVERT(DATE, Pth_ReqInputDate),
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        SUBSTRING(Pth_ProductLotNo, 13, 1)
),
PlanDataCheck AS (
    SELECT
        COUNT(*) AS PlanRecordCount,
        CASE
            WHEN COUNT(*) = 0 THEN 'No planned data for this period'
            ELSE STRING_AGG(CONVERT(VARCHAR, PlanDate, 120), ', ')
        END AS PlanDates,
        STRING_AGG(ProductCode, ', ') AS PlanProductCodes,
        STRING_AGG(Line, ', ') AS PlanLines
    FROM PlanData
)
SELECT
    pm.Pmt_InternalProdCode AS title,
    COALESCE(p.ProductCode, a.ProductCode) AS prodcode,
    COALESCE(p.PlanDate, a.ActualDate) AS plandate,
    ISNULL(p.PlanQty, 0) AS planqty,
    ISNULL(a.Total_WIP, 0) AS Total_WIP,
    ISNULL(a.Total_NG, 0) AS Total_NG,
    ISNULL(a.Total_FG, 0) AS Total_FG,
    ISNULL(a.DieNo, '') AS DieNo,
    COALESCE(
        CASE
            WHEN a.ShiftCode = 'Shift01' THEN 'Shift 1'
            WHEN a.ShiftCode = 'Shift02' THEN 'Shift 2'
            WHEN a.ShiftCode = 'Shift03' THEN 'Shift 3'
            WHEN p.CostCenterCode = '010109' THEN 'Shift 1'
            WHEN p.CostCenterCode = '010110' THEN 'Shift 2'
            WHEN p.CostCenterCode = '010111' THEN 'Shift 3'
            ELSE 'Unknown'
        END, 'Unknown'
    ) AS ShiftName,
    ISNULL(a.Dfm_DefectDesc, '') AS Dfm_DefectDesc,
    ISNULL(a.Dfm_status, '') AS Dfm_status,
    (SELECT PlanRecordCount FROM PlanDataCheck) AS plan_record_count,
    (SELECT PlanDates FROM PlanDataCheck) AS plan_dates,
    (SELECT PlanProductCodes FROM PlanDataCheck) AS plan_product_codes,
    (SELECT PlanLines FROM PlanDataCheck) AS plan_lines
FROM PlanData p
FULL OUTER JOIN ActualData a
    ON p.ProductCode = a.ProductCode
    AND p.PlanDate = a.ActualDate
    AND p.Line =
        CASE
            WHEN a.Line = '${machineLine}' THEN 'KD'
            ELSE NULL
        END
LEFT JOIN T_ProductMaster pm
    ON pm.Pmt_Productcode = COALESCE(p.ProductCode, a.ProductCode)
WHERE ${machineCondition}${productCondition ? ' AND ' + productCondition : ''}
ORDER BY
    COALESCE(p.PlanDate, a.ActualDate) ASC,
    title ASC,
    ShiftName ASC;
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('startDate', sql.NVarChar(10), startDate);
  request.input('endDate', sql.NVarChar(10), endDate);
  if (product) {
    request.input('product', sql.NVarChar(50), product);
  }

  const result = await request.query(query);
  return result.recordset ?? [];
}

// POST /mpr-kd/ng-data — NG details table (rows where Ng_Stat > 0).
// Same query as the legacy /fetchkd-ng-data endpoint.
export async function getMprKdNgData(filters: MprKdNgQueryFilters): Promise<any[]> {
  const { startDate, endDate, machine, product } = filters;

  // Legacy mapping: 'KD' → '5', else Machine_Line IN ('5'). Both end up on
  // line 5 — replicate exactly.
  const machineCondition =
    machine === 'KD'
      ? `Machine_Line = '5'`
      : `Machine_Line IN ('5')`;

  const conditions: string[] = [
    `CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate`,
    `Ng_Stat > 0`,
    machineCondition,
  ];

  if (product) {
    conditions.push(`Pth_ProductCode = @product`);
  }

  const query = `
SELECT
    pm.Pmt_InternalProdCode AS title,
    a.Pth_ProductCode AS prodcode,
    CONVERT(DATE, a.Pth_ReqInputDate) AS plandate,
    SUM(a.Ng_Stat) AS Total_NG,
    a.DieNo,
    CASE
        WHEN a.Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
        WHEN a.Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
        WHEN a.Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
        ELSE 'Unknown'
    END AS ShiftName,
    a.Dfm_DefectDesc,
    a.Dfm_status
FROM (
    SELECT
        Pth_ReqInputDate,
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        Ng_Stat,
        SUBSTRING(Pth_ProductLotNo, 13, 1) AS DieNo,
        Dfm_DefectDesc,
        Dfm_status
    FROM V_ActualProductionDetail
    WHERE
        CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
        AND Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')
        AND Ng_Stat > 0
) a
LEFT JOIN T_ProductMaster pm
    ON pm.Pmt_Productcode = a.Pth_ProductCode
WHERE ${conditions.join(' AND ')}
GROUP BY
    CONVERT(DATE, a.Pth_ReqInputDate),
    a.Pth_ProductCode,
    pm.Pmt_InternalProdCode,
    a.Machine_Line,
    a.Scm_ShiftCode,
    a.DieNo,
    a.Dfm_DefectDesc,
    a.Dfm_status
ORDER BY
    CONVERT(DATE, a.Pth_ReqInputDate) ASC,
    pm.Pmt_InternalProdCode ASC,
    ShiftName ASC;
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('startDate', sql.NVarChar(10), startDate);
  request.input('endDate', sql.NVarChar(10), endDate);
  if (product) {
    request.input('product', sql.NVarChar(50), product);
  }

  const result = await request.query(query);
  return result.recordset ?? [];
}
