import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for Preference Master.
// Responsible for database access only — all SQL Server queries for Preference
// Master live in this file. No HTTP concerns, no business rules.
// Business logic belongs in preferenceMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════
//
// T_ParameterMaster stores site-wide configuration as grouped key/value rows:
//   - Pmt_ParameterID   char(20)  — the group/key (e.g. CURRENCYTO, LCTRTYPE)
//   - Pmt_ParameterSeq  int       — ordering within the group
//   - Pmt_ParameterDesc char(50)  — the display label (NOT NULL)
//   - Pmt_StringValue   char(50)  — the editable value (nullable; '' → NULL)
// The compound key is (Pmt_ParameterID, Pmt_ParameterSeq).

export interface PreferenceListParams {
  size: number;
  offset: number;
  search: string;
  group: string;
}

/**
 * List preference records with filters + pagination.
 * Values are stored as padded char so LTRIM(RTRIM()) is applied on read.
 */
export async function listRecords(
  params: PreferenceListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, search, group } = params;

  const conditions: string[] = ['Pmt_ParameterID IS NOT NULL'];
  const condParams: Array<[string, string]> = [];
  if (search) {
    conditions.push(`(
      LTRIM(RTRIM(Pmt_ParameterID)) LIKE @search0 + '%'
      OR LTRIM(RTRIM(Pmt_ParameterDesc)) LIKE '%' + @search0 + '%'
    )`);
    condParams.push(['search0', search]);
  }
  if (group) {
    conditions.push(`LTRIM(RTRIM(Pmt_ParameterID)) = @paramgroup`);
    condParams.push(['paramgroup', group]);
  }

  const where = conditions.join(' AND ');

  const query = `
SELECT Pmt_ParameterID, Pmt_ParameterSeq, Pmt_ParameterDesc, Pmt_StringValue
FROM T_ParameterMaster
WHERE ${where}
ORDER BY Pmt_ParameterID, Pmt_ParameterSeq
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM T_ParameterMaster
WHERE ${where};
`;

  const pool = await getPool();

  const request = pool.request();
  request.input('offset', sql.Int, offset);
  request.input('size', sql.Int, size);
  for (const [k, v] of condParams) request.input(k, sql.VarChar, v);
  const dataResult = await request.query(query);

  const totalReq = pool.request();
  for (const [k, v] of condParams) totalReq.input(k, sql.VarChar, v);
  const totalResult = await totalReq.query(totalQuery);

  const rows = dataResult.recordset ?? [];
  const totalItems = Number(totalResult.recordset?.[0]?.TotalCount ?? 0);

  return { rows, totalItems };
}

/** Distinct parameter groups for the filter dropdown. */
export async function getGroups(): Promise<string[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
SELECT DISTINCT LTRIM(RTRIM(Pmt_ParameterID)) AS parameterid
FROM T_ParameterMaster
ORDER BY parameterid;
`);
  return (result.recordset ?? []).map((r: any) => r.parameterid);
}

/** Duplicate (group, seq) check. Returns true if the key already exists. */
export async function checkKeyExists(parameterid: string, seq: number): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();
  request.input('parameterid', sql.VarChar, parameterid);
  request.input('seq', sql.Int, seq);
  const result = await request.query(`
SELECT COUNT(*) AS n
FROM T_ParameterMaster
WHERE LTRIM(RTRIM(Pmt_ParameterID)) = @parameterid AND Pmt_ParameterSeq = @seq;
`);
  return Number(result.recordset?.[0]?.n ?? 0) > 0;
}

/** Insert a new preference row (empty value is stored as NULL). */
export async function insertRecord(params: {
  parameterid: string;
  seq: number;
  desc: string;
  value: string | null;
}): Promise<void> {
  const pool = await getPool();
  const request = pool.request();
  request.input('parameterid', sql.Char, params.parameterid);
  request.input('seq', sql.Int, params.seq);
  request.input('desc', sql.Char, params.desc);
  request.input('value', sql.Char, params.value);

  await request.query(`
INSERT INTO T_ParameterMaster (Pmt_ParameterID, Pmt_ParameterSeq, Pmt_ParameterDesc, Pmt_StringValue)
VALUES (@parameterid, @seq, @desc, @value);
`);
}

/**
 * Update a preference keyed on (Pmt_ParameterID, Pmt_ParameterSeq) — both are
 * immutable keys. Returns affected rows (0 → not found).
 */
export async function updateRecord(params: {
  parameterid: string;
  seq: number;
  desc: string;
  value: string | null;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('parameterid', sql.VarChar, params.parameterid);
  request.input('seq', sql.Int, params.seq);
  request.input('desc', sql.Char, params.desc);
  request.input('value', sql.Char, params.value);

  const result = await request.query(`
UPDATE T_ParameterMaster
SET Pmt_ParameterDesc = @desc, Pmt_StringValue = @value
WHERE LTRIM(RTRIM(Pmt_ParameterID)) = @parameterid AND Pmt_ParameterSeq = @seq;
`);
  return result.rowsAffected?.[0] ?? 0;
}

/** Hard-delete a preference keyed on (Pmt_ParameterID, Pmt_ParameterSeq). */
export async function deleteRecord(parameterid: string, seq: number): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('parameterid', sql.VarChar, parameterid);
  request.input('seq', sql.Int, seq);
  const result = await request.query(`
DELETE FROM T_ParameterMaster
WHERE LTRIM(RTRIM(Pmt_ParameterID)) = @parameterid AND Pmt_ParameterSeq = @seq;
`);
  return result.rowsAffected?.[0] ?? 0;
}
