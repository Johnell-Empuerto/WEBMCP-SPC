// Shared inline CTE definitions that replace V_ActualProductionDetail.
// Performance: ~1.3s vs ~2.9s for the original view (September 2026 test data).
// All date filters are pushed down into each process-line CTE for optimal performance.
//
// Usage: prepend this CTE block before your own SELECT ... FROM ADC_Line/C4_Line/KD_Line.
//
// Parameters available: @startDate DATE, @endDate DATE

export const ACTUAL_PRODUCTION_CTE = `
;WITH ShiftTimeCTE AS (
    SELECT Scm_ShiftCode,
           ((Scm_ShiftTimeIn / 100) * 60 + (Scm_ShiftTimeIn % 100)) AS StartHourMin,
           ((Scm_ShiftTimeIn / 100) * 60 + (Scm_ShiftTimeIn % 100) + (60 * Scm_ShiftTotalHours)) AS EndHourMin
    FROM T_ShiftCodeMaster WHERE Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')
),
ADC_Line AS (
    SELECT
        sh.Scm_ShiftCode,
        CAST(h.Pth_ReqInputDate AS DATE) AS Pth_ReqInputDate,
        h.Pth_ProductCode,
        h.Pth_ProductLotNo,
        h.Pth_TravelogNo,
        h.Pth_JobOrderNo,
        CAST(h.Pth_ActualFinishQty AS INT) AS Pth_ActualFinishQty,
        h.Pth_Status,
        CASE WHEN h.Pth_Status IN ('N', 'A') THEN 1 ELSE 0 END AS Wip_Stat,
        CASE WHEN h.Pth_Status = 'F' AND h.Pth_ActualFinishQty = 0 THEN 1 ELSE 0 END AS Ng_Stat,
        CASE WHEN h.Pth_ActualFinishQty >= 1 AND h.Pth_Status IN ('N', 'F') THEN 1 ELSE 0 END AS Fg_Stat,
        SUBSTRING(h.Pth_ProductLotNo, 12, 1) AS Machine_Line,
        '' AS Dfm_DefectDesc,
        '' AS Dfm_status
    FROM T_TravelogHeader h
    LEFT JOIN T_TravelogDetail d ON h.Pth_TravelogNo = d.Ptd_TravelogNo
    LEFT JOIN ShiftTimeCTE sh ON DATEDIFF(MINUTE, h.Pth_ReqInputDate, d.Ptd_InputActualDate) BETWEEN sh.StartHourMin AND sh.EndHourMin - 1
    WHERE d.Ptd_ProcessCode = '00'
        AND d.Ptd_InputActualQty >= 1
        AND h.Pth_ReqInputDate BETWEEN @startDate AND @endDate
    GROUP BY
        sh.Scm_ShiftCode, d.Ptd_InputActualDate, h.Pth_ProductLotNo, h.Pth_ProductCode,
        h.Pth_TravelogNo, h.Pth_JobOrderNo, h.Pth_ReqInputDate, h.Pth_Status, h.Pth_ActualFinishQty
),
C4_Line AS (
    SELECT
        sh.Scm_ShiftCode,
        CAST(h.Pth_ReqInputDate AS DATE) AS Pth_ReqInputDate,
        h.Pth_ProductCode,
        h.Pth_ProductLotNo,
        h.Pth_TravelogNo,
        h.Pth_JobOrderNo,
        CAST(h.Pth_ActualFinishQty AS INT) AS Pth_ActualFinishQty,
        h.Pth_Status,
        CASE WHEN h.Pth_Status IN ('A') THEN 1 ELSE 0 END AS Wip_Stat,
        CASE WHEN h.Pth_Status = 'F' AND h.Pth_ActualFinishQty = 0 THEN 1 ELSE 0 END AS Ng_Stat,
        CASE WHEN h.Pth_ActualFinishQty >= 1 AND h.Pth_Status IN ('N', 'F') THEN 1 ELSE 0 END AS Fg_Stat,
        '4' AS Machine_Line,
        '' AS Dfm_DefectDesc,
        '' AS Dfm_status
    FROM T_TravelogHeader h
    LEFT JOIN T_TravelogDetail d ON h.Pth_TravelogNo = d.Ptd_TravelogNo
    LEFT JOIN ShiftTimeCTE sh ON DATEDIFF(MINUTE, h.Pth_ReqInputDate, d.Ptd_InputActualDate) BETWEEN sh.StartHourMin AND sh.EndHourMin - 1
    WHERE d.Ptd_ProcessCode = '07'
        AND d.Ptd_InputActualQty >= 1
        AND h.Pth_ReqInputDate BETWEEN @startDate AND @endDate
    GROUP BY
        sh.Scm_ShiftCode, d.Ptd_InputActualDate, h.Pth_ProductLotNo, h.Pth_ProductCode,
        h.Pth_TravelogNo, h.Pth_JobOrderNo, h.Pth_ReqInputDate, h.Pth_Status, h.Pth_ActualFinishQty
),
KD_Line AS (
    SELECT
        sh.Scm_ShiftCode,
        CAST(h.Pth_ReqInputDate AS DATE) AS Pth_ReqInputDate,
        h.Pth_ProductCode,
        h.Pth_ProductLotNo,
        h.Pth_TravelogNo,
        h.Pth_JobOrderNo,
        CAST(h.Pth_ActualFinishQty AS INT) AS Pth_ActualFinishQty,
        h.Pth_Status,
        CASE WHEN h.Pth_Status IN ('N') THEN 1 ELSE 0 END AS Wip_Stat,
        CASE WHEN h.Pth_Status = 'F' AND h.Pth_ActualFinishQty = 0 THEN 1 ELSE 0 END AS Ng_Stat,
        CASE WHEN h.Pth_ActualFinishQty >= 1 AND h.Pth_Status IN ('N', 'F') THEN 1 ELSE 0 END AS Fg_Stat,
        '5' AS Machine_Line,
        ISNULL(dm.Dfm_DefectDesc, '') AS Dfm_DefectDesc,
        ISNULL(dm.Dfm_status, '') AS Dfm_status
    FROM T_TravelogHeader h
    LEFT JOIN T_TravelogDetail d ON h.Pth_TravelogNo = d.Ptd_TravelogNo
    LEFT JOIN ShiftTimeCTE sh ON DATEDIFF(MINUTE, h.Pth_ReqInputDate, d.Ptd_InputActualDate) BETWEEN sh.StartHourMin AND sh.EndHourMin - 1
    LEFT JOIN T_TravelogDefectsDetail fd ON d.Ptd_TravelogNo = fd.Pdd_TravelogNo AND fd.Pdd_ProcessCode = '08'
    LEFT JOIN T_DefectMaster dm ON fd.Pdd_DefectCode = dm.Dfm_DefectCode
    WHERE d.Ptd_ProcessCode = '08'
        AND d.Ptd_InputActualQty >= 1
        AND h.Pth_ReqInputDate BETWEEN @startDate AND @endDate
    GROUP BY
        sh.Scm_ShiftCode, d.Ptd_InputActualDate, h.Pth_ProductLotNo, h.Pth_ProductCode,
        h.Pth_TravelogNo, h.Pth_JobOrderNo, h.Pth_ReqInputDate, h.Pth_Status, h.Pth_ActualFinishQty,
        dm.Dfm_DefectDesc, dm.Dfm_status
)
`;
