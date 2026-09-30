import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for Pallet Master.
// Responsible for database access only — all SQL Server queries for Pallet
// Master live in this file. No HTTP concerns, no business rules.
// Business logic belongs in palletMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════

export interface PalletListParams {
  size: number;
  offset: number;
  search: string;
  category: string;
  status: string;
}

/**
 * List pallet records with filters + pagination.
 * Replicates legacy getPalletMaster24 (86a99904bb8bc4c2 / 2d3177631ad1c64c)
 * and getPalletMasterWithPara24 (e6cd931dc970de89 / f2bcbdce1f49843a):
 * base WHERE Ptm_PalletCode IS NOT NULL, prefix-LIKE on pallet code, equality
 * on category (R/K) and status (A/F/N), ORDER BY Ptm_PalletCode desc,
 * OFFSET/FETCH pagination.
 */
export async function listRecords(
  params: PalletListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, search, category, status } = params;

  // ── WHERE building (same builder logic as the legacy getKBFunction_query) ─
  const conditions: string[] = [`Ptm_PalletCode IS NOT NULL`];
  if (search) conditions.push(`Ptm_PalletCode LIKE @search + '%'`);
  if (category) conditions.push(`Ptm_Category = @category`);
  if (status) conditions.push(`Ptm_Status = @status`);

  const where = conditions.join(' AND ');

  const query = `
SELECT *,'false' AS selected
FROM E_PalletMaster
WHERE ${where}
ORDER BY Ptm_PalletCode DESC
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM E_PalletMaster
WHERE ${where};
`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('size', sql.Int, size);
  listRequest.input('offset', sql.Int, offset);
  if (search) listRequest.input('search', sql.VarChar, search);
  if (category) listRequest.input('category', sql.Char, category);
  if (status) listRequest.input('status', sql.Char, status);
  const listResult = await listRequest.query(query);
  const rows = listResult.recordset ?? [];

  const totalRequest = pool.request();
  if (search) totalRequest.input('search', sql.VarChar, search);
  if (category) totalRequest.input('category', sql.Char, category);
  if (status) totalRequest.input('status', sql.Char, status);
  const totalResult = await totalRequest.query(totalQuery);
  const totalItems = totalResult.recordset?.[0]?.TotalCount ?? 0;

  return { rows, totalItems };
}

/**
 * Duplicate pallet code check.
 * Replicates legacy checkifCodeExists24 (type=palletmaster). Returns true if
 * a pallet with that code exists.
 */
export async function checkCodeExists(code: string): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, code);
  const result = await request.query(`
SELECT COUNT(*) AS count
FROM E_PalletMaster
WHERE Ptm_PalletCode = @code;
`);
  return Number(result.recordset?.[0]?.count ?? 0) > 0;
}

/**
 * Insert a new pallet.
 * Replicates legacy addPalletMaster24: INSERT with CURRENT_TIMESTAMP and the
 * logged-in user in user_Login.
 */
export async function insertRecord(params: {
  palletcode: string;
  desc: string | null;
  color: string | null;
  category: string;
  status: string;
  userlogin: string;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('palletcode', sql.VarChar, params.palletcode);
  request.input('desc', sql.VarChar, params.desc);
  request.input('color', sql.VarChar, params.color);
  request.input('category', sql.Char, params.category || null);
  request.input('status', sql.Char, params.status || null);
  request.input('userlogin', sql.Char, params.userlogin);

  const query = `
INSERT INTO E_PalletMaster
([Ptm_PalletCode], [Ptm_PalletDesc], [Ptm_PalletColor], [Ptm_Category], [Ptm_Status],
 [user_Login], [ludatetime])
VALUES
(@palletcode, @desc, @color, @category, @status, @userlogin, CURRENT_TIMESTAMP);
`;

  const result = await request.query(query);
  return result.rowsAffected?.[0] ?? 0;
}

/**
 * Update the editable fields of an existing pallet, keyed on Ptm_PalletCode.
 * The pallet code itself is never changed. ludatetime = GETDATE().
 */
export async function updateRecord(params: {
  palletcode: string;
  desc: string | null;
  color: string | null;
  category: string;
  status: string;
  userlogin: string;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('palletcode', sql.VarChar, params.palletcode);
  request.input('desc', sql.VarChar, params.desc);
  request.input('color', sql.VarChar, params.color);
  request.input('category', sql.Char, params.category || null);
  request.input('status', sql.Char, params.status || null);
  request.input('userlogin', sql.Char, params.userlogin);

  const query = `
UPDATE E_PalletMaster
SET [Ptm_PalletDesc] = @desc,
    [Ptm_PalletColor] = @color,
    [Ptm_Category] = @category,
    [Ptm_Status] = @status,
    [user_Login] = @userlogin,
    [ludatetime] = GETDATE()
WHERE [Ptm_PalletCode] = @palletcode;
`;

  const result = await request.query(query);
  return result.rowsAffected?.[0] ?? 0;
}

// Tables that reference a pallet code — used by the delete safety guard so
// historical/transactional data is never orphaned.
const REFERENCE_TABLES: Array<[string, string]> = [
  ['T_TraceabilityDetail', 'Tbd_PalletCode'],
  ['T_TraceabilityDetailTRIAL', 'Tbd_PalletCode'],
  ['E_PalletLoadingHeader', 'Plh_PalletCode'],
];

/**
 * Check every referencing table for the pallet code.
 * Returns the names of tables that still reference it (non-empty → block delete).
 */
export async function findReferences(palletcode: string): Promise<string[]> {
  const pool = await getPool();
  const refRequest = pool.request();
  refRequest.input('palletcode', sql.VarChar, palletcode);
  const refUnion = REFERENCE_TABLES.map(
    ([tbl, col], i) =>
      `SELECT ${i} AS refIdx, COUNT(*) AS refCount FROM ${tbl} WHERE CAST(${col} AS VARCHAR(MAX)) = @palletcode`,
  ).join(' UNION ALL ');
  const refResult = await refRequest.query(refUnion);
  return (refResult.recordset ?? [])
    .filter((r: any) => Number(r.refCount) > 0)
    .map((r: any) => REFERENCE_TABLES[Number(r.refIdx)][0]);
}

/** Hard-delete a pallet keyed on Ptm_PalletCode. */
export async function deleteRecord(palletcode: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('palletcode', sql.VarChar, palletcode);
  const result = await request.query(`
DELETE FROM E_PalletMaster WHERE Ptm_PalletCode = @palletcode;
`);
  return result.rowsAffected?.[0] ?? 0;
}
