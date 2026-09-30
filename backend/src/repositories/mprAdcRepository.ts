// Repository for MPR ADC database access.
// Contains the SQL Server queries for the Monthly Production Record (ADC)
// module. These queries reproduce the legacy Node-RED /fetch-data and
// /fetch-ng-data behavior exactly (V_ActualProductionDetail,
// T_ProductionPlanning, T_ProductMaster). Business logic (month parsing,
// machine mapping) belongs in the service; HTTP concerns belong in the
// controller.
//
// Everything is parameterized — no SQL string concatenation of user input.
// The only interpolations are the MACHINE_LINE whitelist values ('1'|'2'|'3')
// resolved by the service.

import sql, { getPool } from '../config/database';
import { ACTUAL_PRODUCTION_CTE } from '../config/actualProductionCte';

export interface MprAdcQueryFilters {
  startDate: string;
  endDate: string;
  /** '1' | '2' | '3' from the MACHINE_LINE map; undefined = all ADC lines. */
  machineLine?: string;
  /** Exact product code (optional). */
  product?: string;
}

// POST /mpr-adc/data — Plan vs Actual per day/shift (MPR main table + chart).
// Reproduces the legacy /fetch-data FULL OUTER JOIN query (live variant
// 0987a28cf071fc60) with parameterized values.
export async function getMprData(filters: MprAdcQueryFilters): Promise<any[]> {
  const { startDate, endDate, machineLine, product } = filters;

  // Dynamic WHERE conditions (identical logic to the legacy builder).
  const conditions: string[] = [
    `(p.Ppt_PlanDate BETWEEN @startDate AND @endDate OR a.Pth_ReqInputDate BETWEEN @startDate AND @endDate)`,
  ];

  if (machineLine) {
    conditions.push(`(p.Ppt_Line = 'ADC ${machineLine}' OR a.Machine_Line = '${machineLine}')`);
  } else {
    conditions.push(`(p.Ppt_Line IN ('ADC 1', 'ADC 2', 'ADC 3') OR a.Machine_Line IN ('1', '2', '3'))`);
  }

  if (product) {
    conditions.push(`(p.Ppt_ProductCode = @product OR a.Pth_ProductCode = @product)`);
  }

  const query = `
${ACTUAL_PRODUCTION_CTE}
, PlanData AS (
    SELECT
        CONVERT(DATE, Ppt_PlanDate) AS Ppt_PlanDate,
        Ppt_ProductCode,
        Ppt_Line,
        Ppt_CostCenterCode,
        SUM(Ppt_PlanQty) AS Ppt_PlanQty
    FROM T_ProductionPlanning
    WHERE
        Ppt_Status IN ('A', 'F')
        AND CONVERT(DATE, Ppt_PlanDate) BETWEEN @startDate AND @endDate
    GROUP BY
        CONVERT(DATE, Ppt_PlanDate),
        Ppt_ProductCode,
        Ppt_Line,
        Ppt_CostCenterCode
),
ActualData AS (
    SELECT
        Pth_ReqInputDate,
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        SUM(Wip_Stat + Ng_Stat + Fg_Stat) AS Total_WIP,
        SUM(Ng_Stat) AS Total_NG,
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
    WHERE Pth_ReqInputDate BETWEEN @startDate AND @endDate
    GROUP BY
        Pth_ReqInputDate,
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        SUBSTRING(Pth_ProductLotNo, 12, 1)
),
PlanDataCheck AS (
    SELECT
        COUNT(*) AS PlanRecordCount,
        CASE
            WHEN COUNT(*) = 0 THEN 'No planned data for this period'
            ELSE STRING_AGG(CONVERT(VARCHAR, Ppt_PlanDate, 120), ', ')
        END AS PlanDates,
        STRING_AGG(Ppt_ProductCode, ', ') AS PlanProductCodes,
        STRING_AGG(Ppt_Line, ', ') AS PlanLines
    FROM PlanData
)
SELECT
    pm.Pmt_InternalProdCode AS title,
    COALESCE(p.Ppt_ProductCode, a.Pth_ProductCode) AS prodcode,
    COALESCE(p.Ppt_PlanDate, a.Pth_ReqInputDate) AS plandate,
    ISNULL(p.Ppt_PlanQty, 0) AS planqty,
    ISNULL(a.Total_WIP, 0) AS Total_WIP,
    ISNULL(a.Total_NG, 0) AS Total_NG,
    ISNULL(a.DieNo, '') AS DieNo,
    COALESCE(
        CASE
            WHEN a.Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
            WHEN a.Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
            WHEN a.Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
            WHEN p.Ppt_CostCenterCode = '010109' THEN 'Shift 1'
            WHEN p.Ppt_CostCenterCode = '010110' THEN 'Shift 2'
            WHEN p.Ppt_CostCenterCode = '010111' THEN 'Shift 3'
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
    ON p.Ppt_ProductCode = a.Pth_ProductCode
    AND p.Ppt_PlanDate = a.Pth_ReqInputDate
    AND p.Ppt_Line =
        CASE
            WHEN a.Machine_Line = '1' THEN 'ADC 1'
            WHEN a.Machine_Line = '2' THEN 'ADC 2'
            WHEN a.Machine_Line = '3' THEN 'ADC 3'
            WHEN a.Machine_Line = '4' THEN 'C4'
            WHEN a.Machine_Line = '5' THEN 'KD'
            ELSE NULL
        END
    AND (
        (p.Ppt_CostCenterCode = '010109' AND a.Scm_ShiftCode = 'Shift01')
        OR (p.Ppt_CostCenterCode = '010110' AND a.Scm_ShiftCode = 'Shift02')
        OR (p.Ppt_CostCenterCode = '010111' AND a.Scm_ShiftCode = 'Shift03')
    )
LEFT JOIN T_ProductMaster pm
    ON pm.Pmt_Productcode = COALESCE(p.Ppt_ProductCode, a.Pth_ProductCode)
WHERE ${conditions.join(' AND ')}
ORDER BY
    COALESCE(p.Ppt_PlanDate, a.Pth_ReqInputDate) ASC,
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

// POST /mpr-adc/ng-data — NG details table (rows where Total_NG > 0).
// Same query as the legacy /fetch-ng-data endpoint.
export async function getMprNgData(filters: MprAdcQueryFilters): Promise<any[]> {
  const { startDate, endDate, machineLine, product } = filters;

  // Dynamic WHERE conditions (identical logic to the legacy buildNGQuery).
  const conditions: string[] = [
    `CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate`,
    `Ng_Stat > 0`,
  ];

  if (machineLine) {
    conditions.push(`Machine_Line = '${machineLine}'`);
  } else {
    conditions.push(`Machine_Line IN ('1', '2', '3')`);
  }

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
