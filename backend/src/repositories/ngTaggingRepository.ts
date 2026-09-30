// Repository for NG Tagging database access.
// Contains the SQL Server queries and the spHandyNGTagging call for the
// Handy NG Tagging module. Business logic (process → category mapping,
// validation) belongs in the service; HTTP concerns belong in the controller.
//
// All user input is bound as T-SQL parameters — never concatenated.

import sql, { getPool } from '../config/database';

// GET /ng-tagging/processes — active process codes.
export async function getProcesses(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
SELECT LTRIM(RTRIM(Pcm_Processcode)) AS code,
       LTRIM(RTRIM(Pcm_ProcessDesc)) AS descr
FROM T_ProcessCodeMaster
WHERE LTRIM(RTRIM(Pcm_status)) = 'A'
ORDER BY LTRIM(RTRIM(Pcm_Processcode));
`);
  return result.recordset;
}

// GET /ng-tagging/defects — active defects, optionally filtered by the NG
// Master category resolved from the selected process code ('1' Casting,
// '2' Machining, '3' Pallet).
export async function getDefects(category?: string): Promise<any[]> {
  const where = [`LTRIM(RTRIM(Dfm_status)) = 'A'`];
  if (category) {
    where.push(`LTRIM(RTRIM(ISNULL(Dfm_DefectCategory, ''))) = @category`);
  }

  const pool = await getPool();
  const request = pool.request();
  if (category) request.input('category', sql.Char, category);
  const result = await request.query(`
SELECT LTRIM(RTRIM(Dfm_DefectCode)) AS code,
       LTRIM(RTRIM(Dfm_DefectShortName)) AS shortName,
       LTRIM(RTRIM(Dfm_DefectDesc)) AS descr
FROM T_DefectMaster
WHERE ${where.join(' AND ')}
ORDER BY Dfm_DefectCode;
`);
  return result.recordset;
}

// GET /ng-tagging/lookup — the travelog header row for a scanned parts ID
// (null when not found).
export async function lookupPart(partsId: string): Promise<any | null> {
  const pool = await getPool();
  const request = pool.request();
  request.input('partsId', sql.VarChar, partsId);
  const part = await request.query(`
SELECT TOP 1
       LTRIM(RTRIM(PTH.Pth_ProductLotNo)) AS partsId,
       LTRIM(RTRIM(PTH.Pth_ProductCode)) AS productCode,
       LTRIM(RTRIM(PTH.Pth_Status)) AS status,
       LTRIM(RTRIM(COALESCE(NULLIF(PM.Pmt_InternalProdCode, ''), PM.Pmt_Productcode))) AS model,
       LTRIM(RTRIM(PM.Pmt_Productname)) AS productName
FROM T_TravelogHeader PTH
LEFT JOIN T_ProductMaster PM
  ON PTH.Pth_ProductCode = PM.Pmt_Productcode
WHERE LTRIM(RTRIM(PTH.Pth_ProductLotNo)) = @partsId;
`);
  return part.recordset?.[0] ?? null;
}

// GET /ng-tagging/lookup — how many active NG entries exist for the parts ID.
export async function countActiveNg(partsId: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('partsId', sql.VarChar, partsId);
  const ng = await request.query(`
SELECT COUNT(*) AS n
FROM T_TravelogDefectsDetail PDD
INNER JOIN T_TravelogHeader PTH
  ON PDD.Pdd_TravelogNo = PTH.Pth_TravelogNo
WHERE LTRIM(RTRIM(PTH.Pth_ProductLotNo)) = @partsId
  AND LTRIM(RTRIM(PDD.Pdd_Status)) = 'A';
`);
  return Number(ng.recordset?.[0]?.n ?? 0);
}

// POST /ng-tagging — run spHandyNGTagging (the stored procedure is the source
// of truth for the tagging side-effects). Returns true when the SP reports
// 'TRUE' for the tagged part.
export async function tagNg(params: {
  partsId: string;
  processCode: string;
  defectCode: string;
  userCode: string;
}): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();
  request.input('PartsID', sql.Char, params.partsId);
  request.input('ProcessCode', sql.Char, params.processCode);
  request.input('DefectCode', sql.Char, params.defectCode);
  request.input('UserCode', sql.Char, params.userCode);
  const result = await request.execute('spHandyNGTagging');

  const first = result.recordset?.[0] as { Result?: string } | undefined;
  return first ? String(first.Result ?? '').toUpperCase() === 'TRUE' : false;
}

export interface NgHistoryFilters {
  size: number;
  offset: number;
  search?: string;
  processCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

// GET /ng-tagging — paginated NG history (mirrors the legacy GetNG report:
// defect detail joined to travelog/process/defect/user masters), newest first.
export async function getHistory(filters: NgHistoryFilters): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, search, processCode, dateFrom, dateTo } = filters;

  const conditions: string[] = [`LTRIM(RTRIM(PDD.Pdd_Status)) = 'A'`];
  if (search) {
    conditions.push(`(
      LTRIM(RTRIM(PTD.Ptd_PartNumber)) LIKE @search + '%'
      OR LTRIM(RTRIM(PDD.Pdd_DefectCode)) LIKE @search + '%'
      OR LTRIM(RTRIM(DM.Dfm_DefectDesc)) LIKE '%' + @search + '%'
    )`);
  }
  if (processCode) {
    conditions.push(`LTRIM(RTRIM(PTD.Ptd_ProcessCode)) = @processCode`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom ?? '')) {
    conditions.push(`CAST(PDD.ludatetime AS date) >= CAST(@dateFrom AS date)`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo ?? '')) {
    conditions.push(`CAST(PDD.ludatetime AS date) <= CAST(@dateTo AS date)`);
  }

  const where = conditions.join(' AND ');

  const from =
    'FROM T_TravelogDefectsDetail PDD\n' +
    'INNER JOIN T_TravelogDetail PTD\n' +
    '  ON PTD.Ptd_TravelogNo = PDD.Pdd_TravelogNo\n' +
    '  AND PTD.Ptd_ProcessSeqNo = PDD.Pdd_ProcessSeqNo\n' +
    '  AND PTD.Ptd_ProcessCode = PDD.Pdd_ProcessCode\n' +
    'INNER JOIN T_DefectMaster DM\n' +
    '  ON DM.Dfm_DefectCode = PDD.Pdd_DefectCode\n' +
    'INNER JOIN T_ProcessCodeMaster PCM\n' +
    '  ON PCM.Pcm_Processcode = PTD.Ptd_ProcessCode\n' +
    'LEFT JOIN T_UserMaster UM\n' +
    '  ON UM.Umt_Usercode = PDD.User_login\n' +
    `WHERE ${where}`;

  const query = `
SELECT PDD.Pdd_TravelogNo AS travelogNo,
       LTRIM(RTRIM(PTD.Ptd_PartNumber)) AS partId,
       LTRIM(RTRIM(PTD.Ptd_ProcessCode)) AS processCode,
       LTRIM(RTRIM(PCM.Pcm_ProcessDesc)) AS processDesc,
       LTRIM(RTRIM(PDD.Pdd_DefectCode)) AS defectCode,
       LTRIM(RTRIM(DM.Dfm_DefectDesc)) AS defectDesc,
       LTRIM(RTRIM(DM.Dfm_DefectShortName)) AS defectShortName,
       LTRIM(RTRIM(PDD.User_login)) AS operatorId,
       LTRIM(RTRIM(COALESCE(NULLIF(UM.Umt_userfname, ''), '') + ' ' + NULLIF(UM.Umt_userlname, ''))) AS operatorName,
       PDD.ludatetime AS scannedAt
${from}
ORDER BY PDD.ludatetime DESC
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
${from};`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('offset', sql.Int, offset);
  listRequest.input('size', sql.Int, size);
  if (search) listRequest.input('search', sql.VarChar, search);
  if (processCode) listRequest.input('processCode', sql.Char, processCode);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom ?? '')) listRequest.input('dateFrom', sql.Date, dateFrom);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo ?? '')) listRequest.input('dateTo', sql.Date, dateTo);
  const dataResult = await listRequest.query(query);

  const totalRequest = pool.request();
  if (search) totalRequest.input('search', sql.VarChar, search);
  if (processCode) totalRequest.input('processCode', sql.Char, processCode);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom ?? '')) totalRequest.input('dateFrom', sql.Date, dateFrom);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo ?? '')) totalRequest.input('dateTo', sql.Date, dateTo);
  const totalResult = await totalRequest.query(totalQuery);

  const rows = dataResult.recordset ?? [];
  const totalItems = Number(totalResult.recordset?.[0]?.TotalCount ?? 0);

  return { rows, totalItems };
}
