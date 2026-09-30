// Repository for NG Report database access.
// Contains the SQL Server queries for the centralized, read-only NG report.
// The retrieval logic reuses the EXACT NG business rules already proven
// working in MPR ADC / C4 / KD:
//   - Source           : V_ActualProductionDetail joined to T_ProductMaster
//   - NG rows          : Ng_Stat > 0 AND Scm_ShiftCode IN ('Shift01'..'03')
//   - NG quantity      : SUM(Ng_Stat)
//   - Die no.          : SUBSTRING(Pth_ProductLotNo, 13, 1)
//   - Area mapping     : Machine_Line '1'..'3' = ADC, '4' = C4, '5' = KD
// READ-ONLY: every query is a SELECT. All user input is bound as parameters.
//
// Report-only enrichment (PIC / Travelog No / Process) is attached with the
// TOP 1 by Pdd_DefectSeqNo rule the view itself uses for its Dfm columns — it
// does NOT change NG grouping or NG quantities.

import sql, { getPool } from '../config/database';

// ── NG record enrichment fragments ──────────────────────────────────────────
// Representative defect-detail row (TOP 1 ORDER BY Pdd_DefectSeqNo, the exact
// rule the view uses for Dfm_DefectDesc / Dfm_status).
const DEFECT_PROCESS_EXPR = `(SELECT TOP 1 CONCAT(LTRIM(RTRIM(PDD.Pdd_ProcessSeqNo)), '/', LTRIM(RTRIM(PDD.Pdd_ProcessCode)))
FROM T_TravelogDefectsDetail PDD
WHERE PDD.Pdd_TravelogNo = Pth_TravelogNo
ORDER BY PDD.Pdd_DefectSeqNo)`;

// Resolve T_TravelogDefectsDetail.User_login → the user's display name using
// the SAME user/name mapping the authentication/login implementation uses.
// A login can map either as a user code (Umt_Usercode) or as the shared login
// column (T_UserMaster.User_login). When no user matches, the raw login value
// is kept so the record never breaks.
const DEFECT_PIC_EXPR = `(SELECT TOP 1 COALESCE(
    NULLIF(
      LTRIM(RTRIM(ISNULL(UU.Umt_userfname, ''))) +
      CASE WHEN LTRIM(RTRIM(ISNULL(UU.Umt_usermi, ''))) <> '' THEN ' ' + LTRIM(RTRIM(UU.Umt_usermi)) ELSE '' END +
      CASE WHEN LTRIM(RTRIM(ISNULL(UU.Umt_userlname, ''))) <> '' THEN ' ' + LTRIM(RTRIM(UU.Umt_userlname)) ELSE '' END,
      ''),
    LTRIM(RTRIM(ISNULL(PDD.User_login, ''))))
FROM T_TravelogDefectsDetail PDD
OUTER APPLY (
    SELECT TOP 1 UU.*
    FROM T_UserMaster UU
    WHERE (LTRIM(RTRIM(ISNULL(UU.Umt_Usercode, ''))) <> ''
           AND LTRIM(RTRIM(UU.Umt_Usercode)) = LTRIM(RTRIM(ISNULL(PDD.User_login, ''))))
       OR (LTRIM(RTRIM(ISNULL(UU.User_login, ''))) <> ''
           AND LTRIM(RTRIM(UU.User_login)) = LTRIM(RTRIM(ISNULL(PDD.User_login, ''))))
    ORDER BY UU.Umt_Usercode
) UU
WHERE PDD.Pdd_TravelogNo = Pth_TravelogNo
ORDER BY PDD.Pdd_DefectSeqNo)`;

// ── Field-based search filters (the compact Filter control on the NG Report) ──
// The frontend sends `filters` as a JSON array of { field, value }. Each field
// maps to a parameterized LIKE condition over the exact column/expression the
// report displays. Every value is bound via its own parameter (sf_0, sf_1, ...)
// — never concatenated. Multiple filters combine with AND.
export const SEARCH_FIELD_MAP: Record<string, (param: string) => string> = {
  travelogNo: (param) => `LTRIM(RTRIM(Pth_TravelogNo)) LIKE '%' + @${param} + '%'`,
  model: (param) =>
    `(LTRIM(RTRIM(Pth_ProductCode)) LIKE '%' + @${param} + '%' OR LTRIM(RTRIM((SELECT TOP 1 LTRIM(RTRIM(ISNULL(pm2.Pmt_InternalProdCode, ''))) FROM T_ProductMaster pm2 WHERE pm2.Pmt_Productcode = Pth_ProductCode))) LIKE '%' + @${param} + '%')`,
  dieNo: (param) =>
    `(LTRIM(RTRIM(SUBSTRING(Pth_ProductLotNo, 13, 1))) LIKE '%' + @${param} + '%' OR LTRIM(RTRIM(Pth_ProductCode)) LIKE '%' + @${param} + '%')`,
  problem: (param) => `LTRIM(RTRIM(Dfm_DefectDesc)) LIKE '%' + @${param} + '%'`,
  pic: (param) => `${DEFECT_PIC_EXPR} LIKE '%' + @${param} + '%'`,
  process: (param) => `${DEFECT_PROCESS_EXPR} LIKE '%' + @${param} + '%'`,
};

export interface NgReportRecordsFilters {
  startDate: string;
  endDate: string;
  line?: string;
  model?: string;
  shift?: string;
  status?: string;
  search?: string;
  searchFilters: Array<{ field: string; value: string }>;
  size: number;
  offset: number;
}

// GET /ng-report/options — years (all time) + model/status options computed
// from the SAME MPR NG source for the selected period.
export async function getFilterOptions(period: { startDate: string; endDate: string }): Promise<{
  years: number[];
  models: any[];
  statuses: string[];
}> {
  const pool = await getPool();

  const yearsResult = await pool.request().query(`
SELECT DISTINCT YEAR(Pth_ReqInputDate) AS yr
FROM V_ActualProductionDetail
WHERE Ng_Stat > 0
ORDER BY yr DESC;
`);
  const years = (yearsResult.recordset ?? [])
    .map((r: any) => Number(r.yr))
    .filter((y: number) => Number.isInteger(y) && y >= 2000);

  const optsRequest = pool.request();
  optsRequest.input('startDate', sql.NVarChar(10), period.startDate);
  optsRequest.input('endDate', sql.NVarChar(10), period.endDate);

  // Model options mirror the MPR/DPR model dropdowns: the union returns
  // (a) every product that had production in the selected period plus (b)
  // every product in T_ProductMaster, so the dropdown is always populated.
  const modelsResult = await optsRequest.query(`
SELECT DISTINCT
    a.Pth_ProductCode AS value,
    LTRIM(RTRIM(ISNULL(pm.Pmt_InternalProdCode, ''))) AS title
FROM (
    SELECT DISTINCT Pth_ProductCode
    FROM V_ActualProductionDetail
    WHERE
        CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
        AND Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')
    UNION
    SELECT DISTINCT Pmt_Productcode
    FROM T_ProductMaster
    WHERE LTRIM(RTRIM(ISNULL(Pmt_Productcode, ''))) <> ''
) a
LEFT JOIN T_ProductMaster pm
    ON pm.Pmt_Productcode = a.Pth_ProductCode
ORDER BY title, a.Pth_ProductCode;
`);

  const statusesResult = await optsRequest.query(`
SELECT DISTINCT LTRIM(RTRIM(Dfm_status)) AS status
FROM V_ActualProductionDetail
WHERE
    CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate
    AND Ng_Stat > 0
    AND Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')
    AND LTRIM(RTRIM(ISNULL(Dfm_status, ''))) <> ''
ORDER BY LTRIM(RTRIM(Dfm_status));
`);

  return {
    years,
    models: modelsResult.recordset ?? [],
    statuses: statusesResult.recordset ?? [],
  };
}

// GET /ng-report — paginated NG records + summary KPIs. Runs the records,
// count, NG-quantity, top-cause and top-line queries against the shared MPR
// NG predicate.
export async function getRecords(filters: NgReportRecordsFilters): Promise<{
  rows: any[];
  totalItems: number;
  totalNgQty: number;
  topCause: string;
  mostAffectedLine: string;
}> {
  const { startDate, endDate, line, model, shift, status, search, searchFilters, size, offset } = filters;

  // ── Dynamic WHERE conditions — every value is bound as a parameter ────────
  // These are the EXACT business rules of the MPR /ng-data queries.
  const conditions: string[] = [];
  if (line) {
    conditions.push(`Machine_Line = @line`);
  } else {
    conditions.push(`Machine_Line IN ('1', '2', '3', '4', '5')`);
  }
  if (model) conditions.push(`Pth_ProductCode = @model`);
  if (shift) conditions.push(`Scm_ShiftCode = @shift`);
  if (status) conditions.push(`LTRIM(RTRIM(Dfm_status)) = @status`);
  if (search) {
    // Search is fully parameterized (@search is bound via request.input) and
    // matches useful NG record info.
    conditions.push(`(
      LTRIM(RTRIM(Pth_ProductCode)) LIKE '%' + @search + '%'
      OR LTRIM(RTRIM((SELECT TOP 1 LTRIM(RTRIM(ISNULL(pm2.Pmt_InternalProdCode, '')))
                      FROM T_ProductMaster pm2
                      WHERE pm2.Pmt_Productcode = Pth_ProductCode))) LIKE '%' + @search + '%'
      OR LTRIM(RTRIM(Pth_TravelogNo)) LIKE '%' + @search + '%'
      OR LTRIM(RTRIM(SUBSTRING(Pth_ProductLotNo, 13, 1))) LIKE @search + '%'
      OR LTRIM(RTRIM(Dfm_DefectDesc)) LIKE '%' + @search + '%'
      OR LTRIM(RTRIM(Dfm_status)) LIKE '%' + @search + '%'
      OR ${DEFECT_PIC_EXPR} LIKE '%' + @search + '%'
      OR ${DEFECT_PROCESS_EXPR} LIKE '%' + @search + '%'
      OR CASE
            WHEN Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
            WHEN Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
            WHEN Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
            ELSE 'Unknown'
          END LIKE @search + '%'
    )`);
  }
  if (searchFilters.length > 0) {
    // One parameterized condition per field filter; all combine with AND.
    searchFilters.forEach((f, i) => {
      conditions.push(SEARCH_FIELD_MAP[f.field](`sf_${i}`));
    });
  }

  // The shared MPR NG source predicate (identical to the MPR /ng-data builder).
  const base =
    'FROM V_ActualProductionDetail\n' +
    'WHERE CONVERT(DATE, Pth_ReqInputDate) BETWEEN @startDate AND @endDate\n' +
    `  AND Scm_ShiftCode IN ('Shift01', 'Shift02', 'Shift03')\n` +
    '  AND Ng_Stat > 0\n' +
    (conditions.length > 0 ? `  AND ${conditions.join('\n  AND ')}\n` : '');

  // ── Records query — the same SELECT shape as MPR /mpr-*/ng-data, exposing
  //    Machine_Line as `line` and aggregating ALL lines (ADC + C4 + KD). ─────
  const recordsQuery = `
SELECT
    LTRIM(RTRIM(ISNULL(pm.Pmt_InternalProdCode, ''))) AS model,
    a.Pth_ProductCode AS prodcode,
    CONVERT(DATE, a.Pth_ReqInputDate) AS plandate,
    LTRIM(RTRIM(a.Machine_Line)) AS line,
    CASE
        WHEN a.Scm_ShiftCode = 'Shift01' THEN 'Shift 1'
        WHEN a.Scm_ShiftCode = 'Shift02' THEN 'Shift 2'
        WHEN a.Scm_ShiftCode = 'Shift03' THEN 'Shift 3'
        ELSE 'Unknown'
    END AS shift,
    LTRIM(RTRIM(a.DieNo)) AS dieNo,
    LTRIM(RTRIM(a.Dfm_DefectDesc)) AS problem,
    LTRIM(RTRIM(a.Dfm_status)) AS status,
    MAX(a.Pth_TravelogNo) AS travelogNo,
    MAX(a.pic) AS pic,
    MAX(a.process) AS process,
    SUM(a.Ng_Stat) AS totalNg,
    COUNT(*) AS recordCount
FROM (
    SELECT
        Pth_ReqInputDate,
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        Ng_Stat,
        Pth_TravelogNo,
        SUBSTRING(Pth_ProductLotNo, 13, 1) AS DieNo,
        Dfm_DefectDesc,
        Dfm_status,
        ${DEFECT_PIC_EXPR} AS pic,
        ${DEFECT_PROCESS_EXPR} AS process
    ${base}
) a
LEFT JOIN T_ProductMaster pm
    ON pm.Pmt_Productcode = a.Pth_ProductCode
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
    CONVERT(DATE, a.Pth_ReqInputDate) DESC,
    pm.Pmt_InternalProdCode ASC,
    a.Machine_Line ASC,
    a.Scm_ShiftCode ASC,
    a.DieNo ASC
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const countQuery = `
SELECT COUNT(*) AS TotalCount
FROM (
    SELECT 1 AS c
    ${base}
    GROUP BY
        CONVERT(DATE, Pth_ReqInputDate),
        Pth_ProductCode,
        Machine_Line,
        Scm_ShiftCode,
        SUBSTRING(Pth_ProductLotNo, 13, 1),
        Dfm_DefectDesc,
        Dfm_status
) g;
`;

  const ngQtyQuery = `
SELECT ISNULL(SUM(Ng_Stat), 0) AS totalNgQty
${base};
`;

  const topCauseQuery = `
SELECT TOP 1 LTRIM(RTRIM(Dfm_DefectDesc)) AS problem
${base}
  AND LTRIM(RTRIM(ISNULL(Dfm_DefectDesc, ''))) <> ''
GROUP BY LTRIM(RTRIM(Dfm_DefectDesc))
ORDER BY SUM(Ng_Stat) DESC, LTRIM(RTRIM(Dfm_DefectDesc)) ASC;
`;

  const topLineQuery = `
SELECT TOP 1 LTRIM(RTRIM(Machine_Line)) AS line
${base}
  AND LTRIM(RTRIM(ISNULL(Machine_Line, ''))) IN ('1', '2', '3', '4', '5')
GROUP BY LTRIM(RTRIM(Machine_Line))
ORDER BY SUM(Ng_Stat) DESC, LTRIM(RTRIM(Machine_Line)) ASC;
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('startDate', sql.NVarChar(10), startDate);
  request.input('endDate', sql.NVarChar(10), endDate);
  request.input('offset', sql.Int, offset);
  request.input('size', sql.Int, size);
  if (line) request.input('line', sql.Char, line);
  if (model) request.input('model', sql.VarChar, model);
  if (shift) request.input('shift', sql.Char, shift);
  if (status) request.input('status', sql.Char, status);
  if (search) request.input('search', sql.VarChar, search);
  searchFilters.forEach((f, i) => request.input(`sf_${i}`, sql.VarChar, f.value));

  const recordsResult = await request.query(recordsQuery);
  const countResult = await request.query(countQuery);
  const ngQtyResult = await request.query(ngQtyQuery);
  const topCauseResult = await request.query(topCauseQuery);
  const topLineResult = await request.query(topLineQuery);

  return {
    rows: recordsResult.recordset ?? [],
    totalItems: Number(countResult.recordset?.[0]?.TotalCount ?? 0),
    totalNgQty: Number(ngQtyResult.recordset?.[0]?.totalNgQty ?? 0),
    topCause: String(topCauseResult.recordset?.[0]?.problem ?? '').trim(),
    mostAffectedLine: String(topLineResult.recordset?.[0]?.line ?? '').trim(),
  };
}
