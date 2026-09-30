import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for NG (Defect) Master.
// Responsible for database access only — all SQL Server queries for NG Master
// live in this file. No HTTP concerns, no business rules.
// Business logic belongs in ngMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════

export interface NgListParams {
  size: number;
  offset: number;
  search: string;
  category: string;
  status: string;
}

/**
 * List NG/defect records with filters + pagination.
 * T_DefectMaster stores the defect definitions used across DPR, NG tagging
 * and defect entry.
 */
export async function listRecords(
  params: NgListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, search, category, status } = params;

  const conditions: string[] = ['Dfm_DefectCode IS NOT NULL'];
  if (search) {
    conditions.push(`(
      LTRIM(RTRIM(Dfm_DefectCode)) LIKE @search + '%'
      OR LTRIM(RTRIM(Dfm_DefectShortName)) LIKE @search + '%'
      OR LTRIM(RTRIM(Dfm_DefectDesc)) LIKE '%' + @search + '%'
    )`);
  }
  if (category) {
    conditions.push(`LTRIM(RTRIM(ISNULL(Dfm_DefectCategory, ''))) = @category`);
  }
  if (status) {
    conditions.push(`LTRIM(RTRIM(Dfm_status)) = @status`);
  }

  const where = conditions.join(' AND ');

  const query = `
SELECT Dfm_DefectCode, Dfm_DefectShortName, Dfm_DefectDesc,
       Dfm_DefectDefinition1, Dfm_DefectDefinition2, Dfm_status,
       Dfm_DefectCategory, User_login, ludatetime
FROM T_DefectMaster
WHERE ${where}
ORDER BY Dfm_DefectCode
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM T_DefectMaster
WHERE ${where};
`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('offset', sql.Int, offset);
  listRequest.input('size', sql.Int, size);
  if (search) listRequest.input('search', sql.VarChar, search);
  if (category) listRequest.input('category', sql.Char, category);
  if (status) listRequest.input('status', sql.Char, status);
  const dataResult = await listRequest.query(query);

  const totalRequest = pool.request();
  if (search) totalRequest.input('search', sql.VarChar, search);
  if (category) totalRequest.input('category', sql.Char, category);
  if (status) totalRequest.input('status', sql.Char, status);
  const totalResult = await totalRequest.query(totalQuery);

  const rows = dataResult.recordset ?? [];
  const totalItems = Number(totalResult.recordset?.[0]?.TotalCount ?? 0);

  return { rows, totalItems };
}

/** Duplicate defect code check. Returns true if the code exists. */
export async function checkCodeExists(code: string): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, code);
  const result = await request.query(`
SELECT COUNT(*) AS n
FROM T_DefectMaster
WHERE LTRIM(RTRIM(Dfm_DefectCode)) = @code;
`);
  return Number(result.recordset?.[0]?.n ?? 0) > 0;
}

/** Insert a new defect (ludatetime = GETDATE()). */
export async function insertRecord(params: {
  code: string;
  shortName: string;
  desc: string;
  definition1: string;
  definition2: string | null;
  status: string;
  category: string | null;
  userlogin: string;
}): Promise<void> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.Char, params.code);
  request.input('shortName', sql.Char, params.shortName);
  request.input('desc', sql.Char, params.desc);
  request.input('definition1', sql.Char, params.definition1);
  request.input('definition2', sql.VarChar, params.definition2);
  request.input('status', sql.Char, params.status);
  request.input('category', sql.Char, params.category);
  request.input('userlogin', sql.VarChar, params.userlogin);

  await request.query(`
INSERT INTO T_DefectMaster
([Dfm_DefectCode], [Dfm_DefectShortName], [Dfm_DefectDesc],
 [Dfm_DefectDefinition1], [Dfm_DefectDefinition2], [Dfm_status],
 [Dfm_DefectCategory], [User_login], [ludatetime])
VALUES
(@code, @shortName, @desc,
 @definition1, @definition2, @status,
 @category, @userlogin, GETDATE());
`);
}

/**
 * Update a defect keyed on Dfm_DefectCode (code immutable).
 * Returns the number of affected rows (0 → not found).
 */
export async function updateRecord(params: {
  code: string;
  shortName: string;
  desc: string;
  definition1: string;
  definition2: string | null;
  status: string;
  category: string | null;
  userlogin: string;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, params.code);
  request.input('shortName', sql.Char, params.shortName);
  request.input('desc', sql.Char, params.desc);
  request.input('definition1', sql.Char, params.definition1);
  request.input('definition2', sql.VarChar, params.definition2);
  request.input('status', sql.Char, params.status);
  request.input('category', sql.Char, params.category);
  request.input('userlogin', sql.VarChar, params.userlogin);

  const result = await request.query(`
UPDATE T_DefectMaster
SET [Dfm_DefectShortName] = @shortName,
    [Dfm_DefectDesc] = @desc,
    [Dfm_DefectDefinition1] = @definition1,
    [Dfm_DefectDefinition2] = @definition2,
    [Dfm_status] = @status,
    [Dfm_DefectCategory] = @category,
    [User_login] = @userlogin,
    [ludatetime] = GETDATE()
WHERE LTRIM(RTRIM(Dfm_DefectCode)) = @code;
`);
  return result.rowsAffected?.[0] ?? 0;
}

// Tables that reference a defect code — used by the delete safety guard so
// historical/transactional data is never orphaned.
const REFERENCE_TABLES: Array<[string, string]> = [
  ['T_TravelogDefectsDetail', 'Pdd_DefectCode'],
  ['T_CostCenterDefectMaster', 'Ccd_DefectCode'],
];

/**
 * Check every referencing table for the defect code.
 * Returns the names of tables that still reference it (non-empty → block delete).
 */
export async function findReferences(code: string): Promise<string[]> {
  const pool = await getPool();
  const refRequest = pool.request();
  refRequest.input('code', sql.VarChar, code);
  const refUnion = REFERENCE_TABLES.map(
    ([tbl, col], i) =>
      `SELECT ${i} AS refIdx, COUNT(*) AS refCount FROM ${tbl} WHERE CAST(${col} AS VARCHAR(MAX)) = @code`,
  ).join(' UNION ALL ');
  const refResult = await refRequest.query(refUnion);
  return (refResult.recordset ?? [])
    .filter((r: any) => Number(r.refCount) > 0)
    .map((r: any) => REFERENCE_TABLES[Number(r.refIdx)][0]);
}

/**
 * Hard-delete a defect keyed on Dfm_DefectCode.
 * Returns the number of affected rows (0 → not found).
 */
export async function deleteRecord(code: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, code);
  const result = await request.query(`
DELETE FROM T_DefectMaster
WHERE LTRIM(RTRIM(Dfm_DefectCode)) = @code;
`);
  return result.rowsAffected?.[0] ?? 0;
}
