import sql, { getPool } from '../config/database';

export async function getMachineList(): Promise<{ machineCode: string; machineDesc: string }[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT DISTINCT
      CASE
        WHEN Machine_Line = '1' THEN 'ADC 1'
        WHEN Machine_Line = '2' THEN 'ADC 2'
        WHEN Machine_Line = '3' THEN 'ADC 3'
        WHEN Machine_Line = '4' THEN 'C4'
        WHEN Machine_Line = '5' THEN 'KD'
      END AS machineCode,
      CASE
        WHEN Machine_Line = '1' THEN 'ADC Line 1'
        WHEN Machine_Line = '2' THEN 'ADC Line 2'
        WHEN Machine_Line = '3' THEN 'ADC Line 3'
        WHEN Machine_Line = '4' THEN 'C4 Line'
        WHEN Machine_Line = '5' THEN 'KD Line'
      END AS machineDesc
    FROM V_ActualProductionDetail
    WHERE Machine_Line IN ('1', '2', '3', '4', '5')
    ORDER BY machineCode
  `);
  return result.recordset;
}

export async function getMonthlyReport(
  selmonth: number,
  selyears: number,
  machineFilter?: string
): Promise<any[]> {
  const pool = await getPool();

  const startDate = `${selyears}-${String(selmonth).padStart(2, '0')}-01`;
  const endDate = new Date(selyears, selmonth, 0).toISOString().split('T')[0];

  const request = pool.request();
  request.input('startDate', sql.Date, startDate);
  request.input('endDate', sql.Date, endDate);
  request.input('machineFilter', sql.NVarChar(50), machineFilter || '');

  const result = await request.query(`
    WITH DailyProduction AS (
      SELECT
        CONVERT(DATE, Pth_ReqInputDate) AS prodDate,
        DAY(Pth_ReqInputDate) AS dayNo,
        Pth_ProductCode,
        Machine_Line,
        SUM(Wip_Stat) AS totalWIP,
        SUM(Ng_Stat) AS totalNG,
        SUM(Fg_Stat) AS totalFG,
        COUNT(DISTINCT Pth_TravelogNo) AS travelSheetCount
      FROM V_ActualProductionDetail
      WHERE CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
        AND Machine_Line IN ('1', '2', '3', '4', '5')
        AND (@machineFilter = '' OR Machine_Line = @machineFilter)
      GROUP BY
        CONVERT(DATE, Pth_ReqInputDate),
        DAY(Pth_ReqInputDate),
        Pth_ProductCode,
        Machine_Line
    ),
    DailyPlan AS (
      SELECT
        CONVERT(DATE, Ppt_PlanDate) AS planDate,
        DAY(Ppt_PlanDate) AS dayNo,
        Ppt_ProductCode,
        Ppt_Line,
        SUM(Ppt_PlanQty) AS planQty
      FROM T_ProductionPlanning
      WHERE CONVERT(DATE, Ppt_PlanDate) BETWEEN @startDate AND @endDate
        AND Ppt_Status IN ('A', 'F')
        AND (@machineFilter = '' OR Ppt_Line = @machineFilter)
      GROUP BY
        CONVERT(DATE, Ppt_PlanDate),
        DAY(Ppt_PlanDate),
        Ppt_ProductCode,
        Ppt_Line
    ),
    Combined AS (
      SELECT
        COALESCE(p.prodDate, pl.planDate) AS dateVal,
        COALESCE(p.dayNo, pl.dayNo) AS dayNo,
        COALESCE(p.Machine_Line,
          CASE
            WHEN pl.Ppt_Line = 'ADC 1' THEN '1'
            WHEN pl.Ppt_Line = 'ADC 2' THEN '2'
            WHEN pl.Ppt_Line = 'ADC 3' THEN '3'
            WHEN pl.Ppt_Line = 'C4' THEN '4'
            WHEN pl.Ppt_Line = 'KD' THEN '5'
          END
        ) AS machineLine,
        ISNULL(p.travelSheetCount, 0) AS travelSheetCount,
        ISNULL(p.totalWIP, 0) AS totalWIP,
        ISNULL(p.totalNG, 0) AS totalNG,
        ISNULL(p.totalFG, 0) AS totalFG,
        ISNULL(pl.planQty, 0) AS planQty
      FROM DailyProduction p
      FULL OUTER JOIN DailyPlan pl
        ON p.prodDate = pl.planDate
        AND p.Pth_ProductCode = pl.Ppt_ProductCode
        AND p.Machine_Line = CASE
          WHEN pl.Ppt_Line = 'ADC 1' THEN '1'
          WHEN pl.Ppt_Line = 'ADC 2' THEN '2'
          WHEN pl.Ppt_Line = 'ADC 3' THEN '3'
          WHEN pl.Ppt_Line = 'C4' THEN '4'
          WHEN pl.Ppt_Line = 'KD' THEN '5'
        END
    )
    SELECT
      cm.dayNo,
      SUM(cm.travelSheetCount) AS travelSheetCount,
      SUM(cm.totalWIP) AS total,
      SUM(cm.totalNG) AS ng,
      SUM(cm.totalFG) AS fg,
      SUM(cm.planQty) AS planQty,
      cm.machineLine
    FROM Combined cm
    GROUP BY cm.dayNo, cm.machineLine
    ORDER BY cm.machineLine, cm.dayNo
  `);

  return result.recordset;
}

export async function getMonthlyReportPerMachine(
  selmonth: number,
  selyears: number,
  machineFilter?: string
): Promise<any[]> {
  const pool = await getPool();

  const startDate = `${selyears}-${String(selmonth).padStart(2, '0')}-01`;
  const endDate = new Date(selyears, selmonth, 0).toISOString().split('T')[0];

  const request = pool.request();
  request.input('startDate', sql.Date, startDate);
  request.input('endDate', sql.Date, endDate);
  request.input('machineFilter', sql.NVarChar(50), machineFilter || '');

  const result = await request.query(`
    WITH DailyProd AS (
      SELECT
        CONVERT(DATE, Pth_ReqInputDate) AS prodDate,
        DAY(Pth_ReqInputDate) AS dayNo,
        Machine_Line,
        SUM(Wip_Stat) AS totalWIP,
        SUM(Ng_Stat) AS totalNG,
        SUM(Fg_Stat) AS totalFG,
        COUNT(DISTINCT Pth_TravelogNo) AS travelSheetCount
      FROM V_ActualProductionDetail
      WHERE CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
        AND Machine_Line IN ('1', '2', '3', '4', '5')
        AND (@machineFilter = '' OR Machine_Line = @machineFilter)
      GROUP BY
        CONVERT(DATE, Pth_ReqInputDate),
        DAY(Pth_ReqInputDate),
        Machine_Line
    ),
    MachineAgg AS (
      SELECT
        Machine_Line,
        MAX(travelSheetCount) AS maxTravelSheet,
        MAX(totalWIP) AS greatestTotal,
        SUM(travelSheetCount) AS overallTravelSheetCount
      FROM DailyProd
      GROUP BY Machine_Line
    )
    SELECT
      dp.Machine_Line AS machineLine,
      CASE
        WHEN dp.Machine_Line = '1' THEN 'ADC 1'
        WHEN dp.Machine_Line = '2' THEN 'ADC 2'
        WHEN dp.Machine_Line = '3' THEN 'ADC 3'
        WHEN dp.Machine_Line = '4' THEN 'C4'
        WHEN dp.Machine_Line = '5' THEN 'KD'
      END AS machineName,
      '${selyears}-${String(selmonth).padStart(2, '0')}' AS monthYear,
      dp.dayNo,
      dp.travelSheetCount,
      dp.totalWIP AS total,
      dp.totalNG AS ng,
      dp.totalFG AS fg,
      ma.maxTravelSheet,
      ma.greatestTotal,
      ma.overallTravelSheetCount
    FROM DailyProd dp
    JOIN MachineAgg ma ON dp.Machine_Line = ma.Machine_Line
    ORDER BY dp.Machine_Line, dp.dayNo
  `);

  return result.recordset;
}

export async function getDashboardTotals(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      CASE
        WHEN Machine_Line = '1' THEN 'ADC 1'
        WHEN Machine_Line = '2' THEN 'ADC 2'
        WHEN Machine_Line = '3' THEN 'ADC 3'
        WHEN Machine_Line = '4' THEN 'C4'
        WHEN Machine_Line = '5' THEN 'KD'
      END AS machineName,
      COUNT(DISTINCT Pth_TravelogNo) AS travelSheetCount,
      SUM(Fg_Stat) AS totalOKQty,
      SUM(Ng_Stat) AS totalNGQty,
      SUM(Wip_Stat) AS totalOutputQty
    FROM V_ActualProductionDetail
    WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, GETDATE())
      AND Machine_Line IN ('1', '2', '3', '4', '5')
    GROUP BY Machine_Line
    ORDER BY Machine_Line
  `);
  return result.recordset;
}

export async function getDashboardSummary(): Promise<{
  totalTravelSheets: number;
  totalFG: number;
  totalProduction: number;
  totalNG: number;
  machineCount: number;
}> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      COUNT(DISTINCT Pth_TravelogNo) AS totalTravelSheets,
      ISNULL(SUM(Fg_Stat), 0) AS totalFG,
      ISNULL(SUM(Wip_Stat), 0) AS totalProduction,
      ISNULL(SUM(Ng_Stat), 0) AS totalNG,
      COUNT(DISTINCT Machine_Line) AS machineCount
    FROM V_ActualProductionDetail
    WHERE CONVERT(DATE, Pth_ReqInputDate) = CONVERT(DATE, GETDATE())
      AND Machine_Line IN ('1', '2', '3', '4', '5')
  `);
  return result.recordset[0];
}

export async function getProductionTrend(days: number = 30): Promise<any[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input('days', sql.Int, days);

  const result = await request.query(`
    SELECT
      CONVERT(DATE, Pth_ReqInputDate) AS date,
      ISNULL(SUM(Wip_Stat), 0) AS totalQty,
      ISNULL(SUM(Fg_Stat), 0) AS totalFG,
      ISNULL(SUM(Ng_Stat), 0) AS totalNG
    FROM V_ActualProductionDetail
    WHERE CONVERT(DATE, Pth_ReqInputDate) >= CONVERT(DATE, DATEADD(DAY, -@days, GETDATE()))
      AND Machine_Line IN ('1', '2', '3', '4', '5')
    GROUP BY CONVERT(DATE, Pth_ReqInputDate)
    ORDER BY CONVERT(DATE, Pth_ReqInputDate)
  `);
  return result.recordset;
}

export async function getPlanVsActual(
  startDate: string,
  endDate: string,
  machine?: string
): Promise<any[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input('startDate', sql.Date, startDate);
  request.input('endDate', sql.Date, endDate);
  request.input('machineFilter', sql.NVarChar(50), machine || '');

  const result = await request.query(`
    SELECT
      ISNULL(pm.Pmt_InternalProdCode, a.Pth_ProductCode) AS title,
      ISNULL(a.Pth_ProductCode, p.Ppt_ProductCode) AS prodcode,
      CONVERT(VARCHAR(10), ISNULL(p.Ppt_PlanDate, a.Pth_ReqInputDate), 120) AS plandate,
      ISNULL(p.Ppt_PlanQty, 0) AS planqty,
      ISNULL(a.Total_WIP, 0) AS totalWIP,
      ISNULL(a.Total_NG, 0) AS totalNG,
      ISNULL(a.Total_FG, 0) AS totalFG,
      ISNULL(a.DieNo, '') AS dieNo,
      CASE
        WHEN a.Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
        WHEN a.Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
        WHEN a.Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
        WHEN p.Ppt_CostCenterCode = '010109' THEN 'Shift 1'
        WHEN p.Ppt_CostCenterCode = '010110' THEN 'Shift 2'
        WHEN p.Ppt_CostCenterCode = '010111' THEN 'Shift 3'
        ELSE 'Unknown'
      END AS shiftName
    FROM (
      SELECT
        CONVERT(DATE, Ppt_PlanDate) AS Ppt_PlanDate,
        Ppt_ProductCode,
        Ppt_Line,
        MAX(Ppt_CostCenterCode) AS Ppt_CostCenterCode,
        SUM(Ppt_PlanQty) AS Ppt_PlanQty
      FROM T_ProductionPlanning
      WHERE Ppt_Status IN ('A', 'F')
        AND CONVERT(DATE, Ppt_PlanDate) BETWEEN @startDate AND @endDate
        AND (@machineFilter = '' OR Ppt_Line LIKE '%' + @machineFilter + '%')
      GROUP BY CONVERT(DATE, Ppt_PlanDate), Ppt_ProductCode, Ppt_Line
    ) p
    FULL OUTER JOIN (
      SELECT
        CONVERT(DATE, Pth_ReqInputDate) AS Pth_ReqInputDate,
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        SUM(Wip_Stat) AS Total_WIP,
        SUM(Ng_Stat) AS Total_NG,
        SUM(Fg_Stat) AS Total_FG,
        SUBSTRING(MAX(Pth_ProductLotNo), 13, 1) AS DieNo
      FROM V_ActualProductionDetail
      WHERE CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
        AND Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')
        AND Machine_Line IN ('1', '2', '3', '4', '5')
        AND (@machineFilter = '' OR Machine_Line = @machineFilter)
      GROUP BY
        CONVERT(DATE, Pth_ReqInputDate),
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode
    ) a ON p.Ppt_ProductCode = a.Pth_ProductCode
      AND p.Ppt_PlanDate = a.Pth_ReqInputDate
      AND p.Ppt_Line = CASE
        WHEN a.Machine_Line = '1' THEN 'ADC 1'
        WHEN a.Machine_Line = '2' THEN 'ADC 2'
        WHEN a.Machine_Line = '3' THEN 'ADC 3'
        WHEN a.Machine_Line = '4' THEN 'C4'
        WHEN a.Machine_Line = '5' THEN 'KD'
      END
    LEFT JOIN T_ProductMaster pm
      ON pm.Pmt_Productcode = ISNULL(p.Ppt_ProductCode, a.Pth_ProductCode)
    WHERE (@machineFilter = ''
      OR p.Ppt_Line LIKE '%' + @machineFilter + '%'
      OR a.Machine_Line = @machineFilter)
    ORDER BY
      ISNULL(p.Ppt_PlanDate, a.Pth_ReqInputDate) ASC,
      ISNULL(pm.Pmt_InternalProdCode, a.Pth_ProductCode) ASC
  `);
  return result.recordset;
}

export async function getNGSummary(
  startDate: string,
  endDate: string,
  machine?: string
): Promise<any[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input('startDate', sql.Date, startDate);
  request.input('endDate', sql.Date, endDate);
  request.input('machineFilter', sql.NVarChar(50), machine || '');

  const result = await request.query(`
    SELECT
      ISNULL(pm.Pmt_InternalProdCode, a.Pth_ProductCode) AS title,
      a.Pth_ProductCode AS prodcode,
      CONVERT(VARCHAR(10), a.Pth_ReqInputDate, 120) AS plandate,
      SUM(a.Ng_Stat) AS totalNG,
      a.DieNo,
      CASE
        WHEN a.Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
        WHEN a.Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
        WHEN a.Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
        ELSE 'Unknown'
      END AS shiftName,
      a.Dfm_DefectDesc AS defectDesc,
      a.Dfm_status AS defectStatus
    FROM (
      SELECT
        CONVERT(DATE, Pth_ReqInputDate) AS Pth_ReqInputDate,
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        Ng_Stat,
        SUBSTRING(Pth_ProductLotNo, 13, 1) AS DieNo,
        Dfm_DefectDesc,
        Dfm_status
      FROM V_ActualProductionDetail
      WHERE CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
        AND Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')
        AND Ng_Stat > 0
        AND Machine_Line IN ('1', '2', '3', '4', '5')
        AND (@machineFilter = '' OR Machine_Line = @machineFilter)
    ) a
    LEFT JOIN T_ProductMaster pm ON pm.Pmt_Productcode = a.Pth_ProductCode
    GROUP BY
      a.Pth_ReqInputDate,
      a.Pth_ProductCode,
      pm.Pmt_InternalProdCode,
      a.Machine_Line,
      a.Scm_ShiftCode,
      a.DieNo,
      a.Dfm_DefectDesc,
      a.Dfm_status
    ORDER BY
      a.Pth_ReqInputDate ASC,
      ISNULL(pm.Pmt_InternalProdCode, a.Pth_ProductCode) ASC
  `);
  return result.recordset;
}

export async function getDailyProduction(
  date: string,
  machine?: string
): Promise<any[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input('prodDate', sql.Date, date);
  request.input('machineFilter', sql.NVarChar(50), machine || '');

  const result = await request.query(`
    SELECT
      CONVERT(VARCHAR(10), Pth_ReqInputDate, 120) AS productionDate,
      Pth_ProductCode AS woNumber,
      CASE
        WHEN Machine_Line = '1' THEN 'ADC 1'
        WHEN Machine_Line = '2' THEN 'ADC 2'
        WHEN Machine_Line = '3' THEN 'ADC 3'
        WHEN Machine_Line = '4' THEN 'C4'
        WHEN Machine_Line = '5' THEN 'KD'
      END AS machine,
      SUM(Wip_Stat) AS prodQty
    FROM V_ActualProductionDetail
    WHERE CONVERT(DATE, Pth_ReqInputDate) = @prodDate
      AND Machine_Line IN ('1', '2', '3', '4', '5')
      AND (@machineFilter = '' OR Machine_Line = @machineFilter)
    GROUP BY
      CONVERT(DATE, Pth_ReqInputDate),
      Pth_ProductCode,
      Machine_Line
    ORDER BY Pth_ProductCode
  `);
  return result.recordset;
}
