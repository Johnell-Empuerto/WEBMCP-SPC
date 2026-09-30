import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for Shift Master.
// Responsible for database access only — all SQL Server queries for Shift
// Master live in this file. No HTTP concerns, no business rules.
// Business logic belongs in shiftMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════
//
// T_ShiftCodeMaster stores the production shift definitions that DPR entry and
// the production calendar depend on.

export interface ShiftListParams {
  size: number;
  offset: number;
  search: string;
  status: string;
}

/** List shift records with filters + pagination. */
export async function listRecords(
  params: ShiftListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, search, status } = params;

  const conditions: string[] = ['Scm_ShiftCode IS NOT NULL'];
  if (search) {
    conditions.push(`(
      LTRIM(RTRIM(Scm_ShiftCode)) LIKE @search + '%'
      OR LTRIM(RTRIM(Scm_ShiftDesc)) LIKE '%' + @search + '%'
    )`);
  }
  if (status) {
    conditions.push(`LTRIM(RTRIM(Scm_Status)) = @status`);
  }

  const where = conditions.join(' AND ');

  const query = `
SELECT Scm_ShiftCode, Scm_ShiftDesc, Scm_ScheduleType, Scm_ShiftTimeIn,
       Scm_ShiftBreakStart, Scm_ShiftBreakEnd, Scm_ShiftTimeOut,
       Scm_ShiftTotalHours, Scm_Status, User_Login, ludatetime
FROM T_ShiftCodeMaster
WHERE ${where}
ORDER BY Scm_ShiftCode
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM T_ShiftCodeMaster
WHERE ${where};
`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('offset', sql.Int, offset);
  listRequest.input('size', sql.Int, size);
  if (search) listRequest.input('search', sql.VarChar, search);
  if (status) listRequest.input('status', sql.Char, status);
  const dataResult = await listRequest.query(query);

  const totalRequest = pool.request();
  if (search) totalRequest.input('search', sql.VarChar, search);
  if (status) totalRequest.input('status', sql.Char, status);
  const totalResult = await totalRequest.query(totalQuery);

  const rows = dataResult.recordset ?? [];
  const totalItems = Number(totalResult.recordset?.[0]?.TotalCount ?? 0);

  return { rows, totalItems };
}

/** Duplicate shift code check. Returns true if the code exists. */
export async function checkCodeExists(code: string): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, code);
  const result = await request.query(`
SELECT COUNT(*) AS n
FROM T_ShiftCodeMaster
WHERE LTRIM(RTRIM(Scm_ShiftCode)) = @code;
`);
  return Number(result.recordset?.[0]?.n ?? 0) > 0;
}

/** Insert a new shift (ludatetime = GETDATE()). */
export async function insertRecord(params: {
  code: string;
  desc: string;
  scheduleType: string;
  timein: string;
  breakStart: string | null;
  breakEnd: string | null;
  timeout: string;
  totalHours: number;
  status: string;
  userlogin: string;
}): Promise<void> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, params.code);
  request.input('desc', sql.VarChar, params.desc);
  request.input('scheduleType', sql.Char, params.scheduleType);
  request.input('timein', sql.Char, params.timein);
  request.input('breakStart', sql.Char, params.breakStart);
  request.input('breakEnd', sql.Char, params.breakEnd);
  request.input('timeout', sql.Char, params.timeout);
  request.input('totalHours', sql.Decimal(5, 1), params.totalHours);
  request.input('status', sql.Char, params.status);
  request.input('userlogin', sql.VarChar, params.userlogin);

  await request.query(`
INSERT INTO T_ShiftCodeMaster
([Scm_ShiftCode], [Scm_ShiftDesc], [Scm_ScheduleType], [Scm_ShiftTimeIn],
 [Scm_ShiftBreakStart], [Scm_ShiftBreakEnd], [Scm_ShiftTimeOut],
 [Scm_ShiftTotalHours], [Scm_Status], [User_login], [ludatetime])
VALUES
(@code, @desc, @scheduleType, @timein,
 @breakStart, @breakEnd, @timeout,
 @totalHours, @status, @userlogin, GETDATE());
`);
}

/**
 * Update a shift keyed on Scm_ShiftCode (code immutable).
 * Returns affected rows (0 → not found).
 */
export async function updateRecord(params: {
  code: string;
  desc: string;
  scheduleType: string;
  timein: string;
  breakStart: string | null;
  breakEnd: string | null;
  timeout: string;
  totalHours: number;
  status: string;
  userlogin: string;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, params.code);
  request.input('desc', sql.VarChar, params.desc);
  request.input('scheduleType', sql.Char, params.scheduleType);
  request.input('timein', sql.Char, params.timein);
  request.input('breakStart', sql.Char, params.breakStart);
  request.input('breakEnd', sql.Char, params.breakEnd);
  request.input('timeout', sql.Char, params.timeout);
  request.input('totalHours', sql.Decimal(5, 1), params.totalHours);
  request.input('status', sql.Char, params.status);
  request.input('userlogin', sql.VarChar, params.userlogin);

  const result = await request.query(`
UPDATE T_ShiftCodeMaster
SET [Scm_ShiftDesc] = @desc,
    [Scm_ScheduleType] = @scheduleType,
    [Scm_ShiftTimeIn] = @timein,
    [Scm_ShiftBreakStart] = @breakStart,
    [Scm_ShiftBreakEnd] = @breakEnd,
    [Scm_ShiftTimeOut] = @timeout,
    [Scm_ShiftTotalHours] = @totalHours,
    [Scm_Status] = @status,
    [User_login] = @userlogin,
    [ludatetime] = GETDATE()
WHERE LTRIM(RTRIM(Scm_ShiftCode)) = @code;
`);
  return result.rowsAffected?.[0] ?? 0;
}

// Tables that reference a shift code — used by the delete safety guard so
// historical/transactional data is never orphaned.
const REFERENCE_TABLES: Array<[string, string]> = [
  ['E_DPRHeader', 'Dph_ShiftCode'],
  ['E_DailyProductionLineMaster', 'Dpm_ShiftCode'],
];

/**
 * Check every referencing table for the shift code.
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
 * Hard-delete a shift keyed on Scm_ShiftCode.
 * Returns affected rows (0 → not found).
 */
export async function deleteRecord(code: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, code);
  const result = await request.query(`
DELETE FROM T_ShiftCodeMaster
WHERE LTRIM(RTRIM(Scm_ShiftCode)) = @code;
`);
  return result.rowsAffected?.[0] ?? 0;
}
