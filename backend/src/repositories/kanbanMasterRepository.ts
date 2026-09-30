import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for Kanban Master.
// Responsible for database access only — all SQL Server queries for Kanban
// Master live in this file. No HTTP concerns, no business rules.
// Business logic belongs in kanbanMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════

export interface KanbanListParams {
  size: number;
  offset: number;
  kanban: string;
  partno: string;
  capacity: string;
  rem: string;
}

/**
 * List kanban records with filters + pagination.
 * Replicates legacy getKanbanMaster (node a7275d1cff61acd5):
 * base WHERE Kbm_KanbanID IS NOT NULL, prefix-LIKE on kanban / partno /
 * remarks, equality on capacity, ORDER BY Kbm_RegDate desc, OFFSET/FETCH.
 */
export async function listRecords(
  params: KanbanListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, kanban, partno, capacity, rem } = params;

  // ── WHERE building (same builder logic as the legacy getKBFunction_query) ─
  const conditions: string[] = [`Kbm_KanbanID IS NOT NULL`];
  if (kanban) conditions.push(`Kbm_KanbanID LIKE @kanban + '%'`);
  if (partno && partno !== 'undefined') conditions.push(`Kbm_PartNo LIKE @partno + '%'`);
  if (capacity) conditions.push(`Kbm_Qty = @capacity`);
  if (rem) conditions.push(`Kbm_Remarks LIKE @rem + '%'`);

  const where = conditions.join(' AND ');

  const query = `
SELECT *,'false' AS selected
FROM E_KanbanMaster
WHERE ${where}
ORDER BY Kbm_RegDate DESC
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM E_KanbanMaster
WHERE ${where};
`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('size', sql.Int, size);
  listRequest.input('offset', sql.Int, offset);
  if (kanban) listRequest.input('kanban', sql.VarChar, kanban);
  if (partno && partno !== 'undefined') listRequest.input('partno', sql.VarChar, partno);
  if (capacity) listRequest.input('capacity', sql.Decimal(18, 6), Number(capacity));
  if (rem) listRequest.input('rem', sql.VarChar, rem);
  const listResult = await listRequest.query(query);
  const rows = listResult.recordset ?? [];

  const totalRequest = pool.request();
  if (kanban) totalRequest.input('kanban', sql.VarChar, kanban);
  if (partno && partno !== 'undefined') totalRequest.input('partno', sql.VarChar, partno);
  if (capacity) totalRequest.input('capacity', sql.Decimal(18, 6), Number(capacity));
  if (rem) totalRequest.input('rem', sql.VarChar, rem);
  const totalResult = await totalRequest.query(totalQuery);
  const totalItems = totalResult.recordset?.[0]?.TotalCount ?? 0;

  return { rows, totalItems };
}

/**
 * Step 1 of add: seq = total row count + 1.
 * Replicates legacy node 24c96140b73d575e → 6a41920a65149e9f (ROW_NUMBER
 * query returns the last row number = row count).
 */
export async function getNextSeq(): Promise<number> {
  const pool = await getPool();
  const seqResult = await pool.request().query(`
SELECT TOP 1 CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS INTEGER) AS kanbanNo
FROM E_KanbanMaster
ORDER BY CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS INTEGER) DESC;
`);
  return seqResult.recordset?.[0]?.kanbanNo ?? 0;
}

/**
 * Insert a new kanban with the auto-generated Kanban ID.
 * Replicates legacy node 9e97067bd44e37a8 → a5f5a282fad9e252.
 */
export async function insertRecord(params: {
  partno: string;
  desc: string;
  userlogin: string;
  capacity: number;
  loc: string;
  rem: string;
  kbID3: string;
}): Promise<number> {
  const pool = await getPool();
  const insertRequest = pool.request();
  insertRequest.input('partno', sql.VarChar, params.partno);
  insertRequest.input('desc', sql.VarChar, params.desc);
  insertRequest.input('regby', sql.VarChar, params.userlogin || params.partno);
  insertRequest.input('capacity', sql.Decimal(18, 6), params.capacity);
  insertRequest.input('loc', sql.VarChar, params.loc);
  insertRequest.input('rem', sql.VarChar, params.rem);
  insertRequest.input('kbid3', sql.VarChar, params.kbID3);

  const insertQuery = `
DECLARE @internalCode VARCHAR(5);
SELECT @internalCode = Pmt_InternalProdCode
FROM T_ProductMaster
WHERE Pmt_Productcode = @partno;

INSERT INTO E_KanbanMaster
([Kbm_KanbanID], [Kbm_PartNo], [Kbm_Description], [Kbm_RegDate], [Kbm_RegBy],
 [Kbm_Qty], [Kbm_DefaultLocator], [Kbm_Remarks], [Kbm_Status], [User_login], [ludatetime])
VALUES
(CONCAT('KB-', TRIM(@internalCode), @kbid3),
 @partno, @desc, CURRENT_TIMESTAMP, @regby,
 @capacity, @loc, @rem, '1', @regby, CURRENT_TIMESTAMP);
`;

  const result = await insertRequest.query(insertQuery);
  return result.rowsAffected?.[0] ?? 0;
}

/** Update the editable fields of an existing kanban, keyed on Kbm_KanbanID. */
export async function updateRecord(params: {
  kanbanid: string;
  partno: string;
  desc: string;
  capacity: number;
  loc: string;
  rem: string;
  userlogin: string;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('kanbanid', sql.VarChar, params.kanbanid);
  request.input('partno', sql.VarChar, params.partno);
  request.input('desc', sql.VarChar, params.desc);
  request.input('capacity', sql.Decimal(18, 6), params.capacity);
  request.input('loc', sql.VarChar, params.loc);
  request.input('rem', sql.VarChar, params.rem);
  request.input('userlogin', sql.VarChar, params.userlogin);

  const query = `
UPDATE E_KanbanMaster
SET [Kbm_PartNo] = @partno,
    [Kbm_Description] = @desc,
    [Kbm_Qty] = @capacity,
    [Kbm_DefaultLocator] = @loc,
    [Kbm_Remarks] = @rem,
    [User_login] = @userlogin,
    [ludatetime] = GETDATE()
WHERE [Kbm_KanbanID] = @kanbanid;
`;

  const result = await request.query(query);
  return result.rowsAffected?.[0] ?? 0;
}

// Tables that reference a kanban ID — used by the delete safety guard so
// historical/transactional data is never orphaned.
const REFERENCE_TABLES: Array<[string, string]> = [
  ['E_KanbanTaggingHeader', 'Kth_KanbanID'],
  ['E_DPRDetail', 'Dpd_KanbanNo'],
  ['E_DPRDetail', 'Dpd_KanbanNo2'],
  ['E_DPRDetail', 'Dph_KanbanControlNo'],
  ['E_PalletLoadingDetail', 'Pld_KanBanID'],
  ['T_DailyProductionDetail', 'Dpd_KanbanNo'],
  ['T_DailyProductionReport', 'Dpr_KanbanNo'],
  ['T_HourlyReportDetail', 'Hrd_KanbanNo'],
];

/**
 * Check every referencing table for the kanban ID.
 * Returns the names of tables that still reference it (non-empty → block delete).
 */
export async function findReferences(kanbanid: string): Promise<string[]> {
  const pool = await getPool();
  const refRequest = pool.request();
  refRequest.input('kanbanid', sql.VarChar, kanbanid);
  const refUnion = REFERENCE_TABLES.map(
    ([tbl, col], i) =>
      `SELECT ${i} AS refIdx, COUNT(*) AS refCount FROM ${tbl} WHERE CAST(${col} AS VARCHAR(MAX)) = @kanbanid`,
  ).join(' UNION ALL ');
  const refResult = await refRequest.query(refUnion);
  return (refResult.recordset ?? [])
    .filter((r: any) => Number(r.refCount) > 0)
    .map((r: any) => REFERENCE_TABLES[Number(r.refIdx)][0]);
}

/** Hard-delete a kanban keyed on Kbm_KanbanID. */
export async function deleteRecord(kanbanid: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('kanbanid', sql.VarChar, kanbanid);
  const result = await request.query(`
DELETE FROM E_KanbanMaster WHERE Kbm_KanbanID = @kanbanid;
`);
  return result.rowsAffected?.[0] ?? 0;
}

/** Dropdown lookups: active products with internal codes + active locators. */
export async function getLookups(): Promise<{ partNos: any[]; locators: any[] }> {
  const queries: Record<string, string> = {
    partNos: `
SELECT TRIM(Pmt_Productcode) AS Pmt_Productcode,
       TRIM(Pmt_Productname) AS Pmt_Productname,
       TRIM(Pmt_InternalProdCode) AS Pmt_InternalProdCode
FROM T_ProductMaster
WHERE Pmt_status = 'A'
  AND Pmt_InternalProdCode IS NOT NULL
  AND LTRIM(RTRIM(Pmt_InternalProdCode)) <> ''
ORDER BY Pmt_Productcode ASC;`,
    locators: `
SELECT TRIM(Lmt_Locatorcode) AS Lmt_Locatorcode,
       TRIM(Lmt_Locatordesc) AS Lmt_Locatordesc
FROM T_LocatorMaster
WHERE Lmt_status = 'A'
ORDER BY Lmt_Locatorcode ASC;`,
  };

  const pool = await getPool();
  const out: Record<string, any[]> = {};
  for (const [key, q] of Object.entries(queries)) {
    const result = await pool.request().query(q);
    out[key] = result.recordset ?? [];
  }
  return { partNos: out.partNos ?? [], locators: out.locators ?? [] };
}
