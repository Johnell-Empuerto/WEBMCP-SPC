// Repository for MPR C4 database access.
// Contains the SQL Server queries for the Monthly Production Record (C4)
// module. These queries reproduce the LIVE legacy Node-RED /fetchc4-data
// variant (node d5c98e4e430e95e1 — UNION ALL, Total_WIP = WIP + NG + FG) and
// /fetchc4-ng-data (node 0b349fc933be58f1) exactly. Business logic (month
// parsing, machine mapping) belongs in the service; HTTP concerns belong in
// the controller.
//
// Everything is parameterized — no SQL string concatenation of user input.
// The only interpolation is the fixed C4 machine line '4' (whitelist value).

import sql, { getPool } from '../config/database';
import { ACTUAL_PRODUCTION_CTE } from '../config/actualProductionCte';

export interface MprC4QueryFilters {
  startDate: string;
  endDate: string;
  /** Always '4' (C4 is a single line). */
  machineLine: string;
  /** Exact product code (optional). */
  product?: string;
}

export interface MprC4NgQueryFilters {
  startDate: string;
  endDate: string;
  /** Raw selected machine ('C4' or empty) — decides the = vs IN condition. */
  machine: string;
  /** Exact product code (optional). */
  product?: string;
}

// POST /mpr-c4/data — Plan vs Actual per day/shift (MPR main table + chart).
// Reproduces the live /fetchc4-data query (Variant B, 7f35b953b4f8a3dc) with
// parameterized values. machineCondition is ALWAYS 'Machine_Line = 4' in the
// live C4 builder — both branches produce the same value, so we replicate that.
export async function getMprC4Data(filters: MprC4QueryFilters): Promise<any[]> {
  const { startDate, endDate, machineLine, product } = filters;

  const machineCondition = `AND Machine_Line = '${machineLine}'`;

  // Product condition applies to BOTH plan (Ppt_ProductCode) and actual
  // (Pth_ProductCode) — same as the legacy builder.
  const planProductCondition = product ? `AND Ppt_ProductCode = @product` : '';
  const actualProductCondition = product ? `AND Pth_ProductCode = @product` : '';

  const query = `
${ACTUAL_PRODUCTION_CTE}
, PlanData AS (
    SELECT
        CONVERT(DATE, Ppt_PlanDate) AS PlanDate,
        Ppt_ProductCode AS ProductCode,
        Ppt_Line AS Line,
        Ppt_CostCenterCode AS CostCenterCode,
        SUM(Ppt_PlanQty) AS PlanQty
    FROM T_ProductionPlanning
    WHERE
        Ppt_Status IN ('A', 'F')
        AND Ppt_Line = 'C4'
        AND CONVERT(DATE, Ppt_PlanDate) BETWEEN @startDate AND @endDate
        ${planProductCondition}
    GROUP BY
        CONVERT(DATE, Ppt_PlanDate),
        Ppt_ProductCode,
        Ppt_Line,
        Ppt_CostCenterCode
),
ActualData AS (
    SELECT
        Pth_ReqInputDate AS ActualDate,
        Pth_ProductCode AS ProductCode,
        Machine_Line AS Line,
        Scm_ShiftCode AS ShiftCode,
        SUM(Wip_Stat + Ng_Stat) AS Total_WIP,
        SUM(Ng_Stat) AS Total_NG,
        SUM(Fg_Stat) AS Total_FG,
        SUBSTRING(Pth_ProductLotNo, 12, 1) AS DieNo,
        MAX(Dfm_DefectDesc) AS Dfm_DefectDesc,
        MAX(Dfm_status) AS Dfm_status
    FROM (
        SELECT * FROM ADC_Line
        UNION ALL
        SELECT * FROM C4_Line
        UNION ALL
        SELECT * FROM KD_Line
    ) AllLines
    WHERE
        Pth_ReqInputDate BETWEEN @startDate AND @endDate
        AND Machine_Line = '${machineLine}'
        ${actualProductCondition}
    GROUP BY
        Pth_ReqInputDate,
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        SUBSTRING(Pth_ProductLotNo, 12, 1)
),
PlanWithShift AS (
    SELECT
        PlanDate,
        ProductCode,
        Line,
        PlanQty,
        CASE
            WHEN CostCenterCode = '010109' THEN 'Shift 1'
            WHEN CostCenterCode = '010110' THEN 'Shift 2'
            WHEN CostCenterCode = '010111' THEN 'Shift 3'
            ELSE 'Shift 1'
        END AS ShiftName
    FROM PlanData
    WHERE PlanQty > 0
),
ActualWithShift AS (
    SELECT
        ActualDate,
        ProductCode,
        Line,
        Total_WIP,
        Total_NG,
        Total_FG,
        DieNo,
        Dfm_DefectDesc,
        Dfm_status,
        CASE
            WHEN ShiftCode = 'Shift01' THEN 'Shift 1'
            WHEN ShiftCode = 'Shift02' THEN 'Shift 2'
            WHEN ShiftCode = 'Shift03' THEN 'Shift 3'
            ELSE 'Shift 1'
        END AS ShiftName
    FROM ActualData
    WHERE (Total_WIP > 0 OR Total_NG > 0 OR Total_FG > 0)
),
ProductTitles AS (
    SELECT
        Pmt_ProductCode,
        Pmt_InternalProdCode AS Title
    FROM T_ProductMaster
    WHERE Pmt_ProductCode IN (
        SELECT DISTINCT ProductCode FROM PlanWithShift
        UNION
        SELECT DISTINCT ProductCode FROM ActualWithShift
    )
),
CombinedData AS (
    SELECT
        p.PlanDate AS plandate,
        p.ProductCode AS prodcode,
        pt.Title,
        p.PlanQty AS planqty,
        0 AS Total_WIP,
        0 AS Total_NG,
        0 AS Total_FG,
        '' AS DieNo,
        p.ShiftName,
        '' AS Dfm_DefectDesc,
        '' AS Dfm_status
    FROM PlanWithShift p
    LEFT JOIN ProductTitles pt ON p.ProductCode = pt.Pmt_ProductCode

    UNION ALL

    SELECT
        a.ActualDate AS plandate,
        a.ProductCode AS prodcode,
        pt.Title,
        0 AS planqty,
        a.Total_WIP,
        a.Total_NG,
        a.Total_FG,
        a.DieNo,
        a.ShiftName,
        a.Dfm_DefectDesc,
        a.Dfm_status
    FROM ActualWithShift a
    LEFT JOIN ProductTitles pt ON a.ProductCode = pt.Pmt_ProductCode
)
SELECT
    c.plandate,
    c.prodcode,
    COALESCE(c.Title, '') AS title,
    c.planqty,
    c.Total_WIP,
    c.Total_NG,
    c.Total_FG,
    c.DieNo,
    c.ShiftName,
    c.Dfm_DefectDesc,
    c.Dfm_status,
    (SELECT COUNT(*) FROM PlanData) AS plan_record_count,
    (SELECT STRING_AGG(CONVERT(VARCHAR(MAX), PlanDate, 120), ', ') FROM PlanData) AS plan_dates,
    (SELECT STRING_AGG(CONVERT(VARCHAR(MAX), ProductCode), ', ') FROM PlanData) AS plan_product_codes,
    (SELECT STRING_AGG(CONVERT(VARCHAR(MAX), Line), ', ') FROM PlanData) AS plan_lines
FROM CombinedData c
ORDER BY
    c.plandate ASC,
    c.ShiftName ASC,
    c.prodcode ASC;
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

// POST /mpr-c4/ng-data — NG details table (rows where Ng_Stat > 0).
// Same query as the legacy /fetchc4-ng-data endpoint.
export async function getMprC4NgData(filters: MprC4NgQueryFilters): Promise<any[]> {
  const { startDate, endDate, machine, product } = filters;

  // Legacy mapping: 'C4' → '4', else Machine_Line IN ('4'). Both end up on
  // line 4 — replicate exactly.
  const machineCondition =
    machine === 'C4'
      ? `Machine_Line = '4'`
      : `Machine_Line IN ('4')`;

  const conditions: string[] = [
    `CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate`,
    `Ng_Stat > 0`,
    machineCondition,
  ];

  if (product) {
    conditions.push(`Pth_ProductCode = @product`);
  }

  const query = `
${ACTUAL_PRODUCTION_CTE}
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
        SUBSTRING(Pth_ProductLotNo, 12, 1) AS DieNo,
        Dfm_DefectDesc,
        Dfm_status
    FROM (
        SELECT * FROM ADC_Line
        UNION ALL
        SELECT * FROM C4_Line
        UNION ALL
        SELECT * FROM KD_Line
    ) AllLines
    WHERE Ng_Stat > 0
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
