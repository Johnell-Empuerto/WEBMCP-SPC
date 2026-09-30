// Shared repository module for the actual-production data source.
// This SQL fragment builder is used by BOTH Production Management and
// Production Charts, so it lives in its own repository file instead of being
// imported from one route into the other.
//
// It reproduces the V_ActualProductionDetail view's three branches EXACTLY
// (ADC '00', KD '08', C4 '07') against the base tables — including shift
// mapping, line derivation, WIP/NG/FG status rules, the UNION (dedup)
// semantics, and the C4 correlated '07' row lookup — but WITHOUT the unused
// correlated defect subqueries (Dfm_DefectDesc / Dfm_status) that none of the
// Production Management / Charts queries consume.
//
// adcRange / kdRange / c4Range are optional SARGable predicates injected into
// each branch so date filtering happens before the expensive joins. Proven to
// return identical results via EXCEPT comparison across Jan/Jul/Dec 2026 and
// all line filters.

export function buildActualDataSource(adcRange: string, kdRange: string, c4Range: string): string {
  return `(
  SELECT (CASE WHEN t < 330 THEN 'Shift03'
               WHEN t >= 1290 AND t <= 1440 THEN 'Shift03'
               WHEN t >= 810 AND t < 1290 THEN 'Shift02'
               ELSE 'Shift01' END) AS Scm_ShiftCode,
         d.Ptd_InputActualDate,
         SUBSTRING(h.Pth_ProductLotNo, 12, 1) AS Machine_Line,
         h.Pth_ProductCode,
         h.Pth_ProductLotNo,
         h.Pth_TravelogNo,
         h.Pth_JobOrderNo,
         CAST(h.Pth_ReqInputDate AS DATE) AS Pth_ReqInputDate,
         CASE WHEN h.Pth_Status IN ('N','A') THEN 1 ELSE 0 END AS Wip_Stat,
         CASE WHEN h.Pth_Status='F' AND h.Pth_ActualFinishQty=0 THEN 1 ELSE 0 END AS Ng_Stat,
         CASE WHEN h.Pth_ActualFinishQty=1 AND h.Pth_Status IN ('N','F') THEN 1 ELSE 0 END AS Fg_Stat
  FROM T_TravelogHeader h
  LEFT JOIN T_TravelogDetail d ON h.Pth_TravelogNo = d.Ptd_TravelogNo
  CROSS APPLY (SELECT CAST((DATEPART(HOUR,d.Ptd_InputActualDate)*60)+DATEPART(MINUTE,d.Ptd_InputActualDate) AS INT) AS t) tcalc
  WHERE d.Ptd_ProcessCode='00' AND d.Ptd_InputActualQty>=1 ${adcRange}
  UNION
  SELECT (CASE WHEN t < 330 THEN 'Shift03'
               WHEN t >= 1290 AND t <= 1440 THEN 'Shift03'
               WHEN t >= 810 AND t < 1290 THEN 'Shift02'
               ELSE 'Shift01' END) AS Scm_ShiftCode,
         d.Ptd_InputActualDate,
         5 AS Machine_Line,
         h.Pth_ProductCode,
         h.Pth_ProductLotNo,
         h.Pth_TravelogNo,
         h.Pth_JobOrderNo,
         (CASE WHEN t < 330 THEN DATEADD(DAY,-1,CAST(d.Ptd_InputActualDate AS DATE)) ELSE CAST(d.Ptd_InputActualDate AS DATE) END) AS Pth_ReqInputDate,
         CASE WHEN h.Pth_Status IN ('N') THEN 1 ELSE 0 END AS Wip_Stat,
         CASE WHEN h.Pth_Status='F' AND h.Pth_ActualFinishQty=0 THEN 1 ELSE 0 END AS Ng_Stat,
         CASE WHEN h.Pth_ActualFinishQty=1 THEN 1 ELSE 0 END AS Fg_Stat
  FROM T_TravelogHeader h
  LEFT JOIN T_TravelogDetail d ON h.Pth_TravelogNo = d.Ptd_TravelogNo
  CROSS APPLY (SELECT CAST((DATEPART(HOUR,d.Ptd_InputActualDate)*60)+DATEPART(MINUTE,d.Ptd_InputActualDate) AS INT) AS t) tcalc
  WHERE d.Ptd_ProcessCode='08' AND d.Ptd_InputActualQty=1 ${kdRange}
  UNION
  SELECT (CASE WHEN t < 330 THEN 'Shift03'
               WHEN t >= 1290 AND t <= 1440 THEN 'Shift03'
               WHEN t >= 810 AND t < 1290 THEN 'Shift02'
               ELSE 'Shift01' END) AS Scm_ShiftCode,
         c4.Ptd_InputActualDate,
         4 AS Machine_Line,
         h.Pth_ProductCode,
         h.Pth_ProductLotNo,
         h.Pth_TravelogNo,
         h.Pth_JobOrderNo,
         (CASE WHEN t < 330 THEN DATEADD(DAY,-1,CAST(c4.Ptd_InputActualDate AS DATE)) ELSE CAST(c4.Ptd_InputActualDate AS DATE) END) AS Pth_ReqInputDate,
         CASE WHEN h.Pth_Status IN ('N','A') THEN 1 ELSE 0 END AS Wip_Stat,
         CASE WHEN h.Pth_Status='F' AND h.Pth_ActualFinishQty=0 THEN 1 ELSE 0 END AS Ng_Stat,
         CASE WHEN h.Pth_ActualFinishQty=1 AND h.Pth_Status IN ('N','F') THEN 1 ELSE 0 END AS Fg_Stat
  FROM T_TravelogHeader h
  CROSS APPLY (SELECT TOP 1 d.Ptd_InputActualDate FROM T_TravelogDetail d WHERE d.Ptd_ProcessCode='07' AND d.Ptd_InputActualQty=1 AND d.Ptd_TravelogNo=h.Pth_TravelogNo ORDER BY d.Ptd_ProcessCode DESC) c4
  CROSS APPLY (SELECT CAST((DATEPART(HOUR,c4.Ptd_InputActualDate)*60)+DATEPART(MINUTE,c4.Ptd_InputActualDate) AS INT) AS t) tcalc
  WHERE 1=1 ${c4Range}
)`;
}
