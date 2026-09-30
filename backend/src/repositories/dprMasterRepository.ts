import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for DPR Master.
// Responsible for database access only — all SQL Server queries for DPR Master
// live in this file. No HTTP concerns, no business rules beyond the query
// building itself. Business logic belongs in dprMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════

// Table names come from a fixed whitelist map (never from user input).
export const TABLES: Record<string, string> = {
  'team-leader': 'T_MasterDprTeamLeader',
  'group-leader': 'T_MasterDprGroupLeader',
  leadman: 'T_MasterDprLeadMan',
  inspector: 'T_MasterDprInspector',
  'line-checker': 'T_MasterDprLineChecker',
};

// Whitelisted sortable columns (id included for stable ordering).
const SORT_COLUMNS = [
  'id',
  'md_Usercode',
  'md_firstname',
  'md_lastname',
  'md_position',
  'md_status',
];

// DPR data tables that reference each role (tab → [[table, column], ...]).
// Used by the delete safety guard so historical/transactional DPR data is
// never orphaned. The DPR columns historically store a mix of usercodes and
// names, so the guard matches exact usercode references (best-effort
// semantics, same as the User Master guard).
const DELETE_REFERENCE_TABLES: Record<string, Array<[string, string]>> = {
  'team-leader': [
    ['E_DPRHeader', 'Dph_TeamLeader'],
    ['T_DailyProductionHeader', 'Dph_TeamLeader'],
    ['T_DailyProductionReport', 'Dpr_TeamLeader'],
    ['T_HourlyReportHeader', 'Hrh_TeamLeader'],
  ],
  'group-leader': [
    ['E_DPRHeader', 'Dph_GroupLeader'],
    ['T_DailyProductionHeader', 'Dph_GroupLeader'],
    ['T_DailyProductionReport', 'Dpr_GroupLeader'],
    ['T_HourlyReportHeader', 'Hrh_GroupLeader'],
  ],
  leadman: [], // no known data-table references for leadman
  inspector: [['E_DPRHeader', 'Dph_Inspector']],
  'line-checker': [['E_DPRHeader', 'Dph_LineChecker']],
};

export interface DprMasterListParams {
  size: number;
  offset: number;
  status: string;
  search: string;
  sort: string;
  order: string;
}

/**
 * List records for a DPR master table with search / status filter / sort /
 * pagination. Runs the list query and the COUNT query.
 *
 * status semantics (preserved from the legacy flow):
 *   '' | 'default' → md_status <> 'I'  (legacy: hide inactive records)
 *   'A' | 'I'      → md_status = @status
 *   'all'          → no status restriction
 */
export async function listRecords(
  table: string,
  params: DprMasterListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, status, search, sort, order } = params;

  const conditions: string[] = [];
  if (status === '' || status === 'default') {
    conditions.push(`md_status <> 'I'`); // legacy: hide inactive records
  } else if (status === 'A' || status === 'I') {
    conditions.push(`md_status = @status`);
  }
  // 'all' → no status restriction

  if (search) {
    conditions.push(
      `(CAST(md_Usercode AS VARCHAR(20)) LIKE '%' + @search + '%'
        OR md_firstname LIKE '%' + @search + '%'
        OR md_lastname LIKE '%' + @search + '%'
        OR md_position LIKE '%' + @search + '%')`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = SORT_COLUMNS.includes(sort) ? sort : 'md_Usercode';
  const orderDir = order === 'desc' ? 'DESC' : 'ASC';

  const query = `
SELECT id, md_Usercode, md_firstname, md_lastname, md_position, md_status
FROM ${table}
${where}
ORDER BY ${sortCol} ${orderDir}, id ASC
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM ${table}
${where};
`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('size', sql.Int, size);
  listRequest.input('offset', sql.Int, offset);
  if (status === 'A' || status === 'I') listRequest.input('status', sql.Char(1), status);
  if (search) listRequest.input('search', sql.NVarChar(100), search);
  const listResult = await listRequest.query(query);
  const rows = listResult.recordset ?? [];

  const totalRequest = pool.request();
  if (status === 'A' || status === 'I') totalRequest.input('status', sql.Char(1), status);
  if (search) totalRequest.input('search', sql.NVarChar(100), search);
  const totalResult = await totalRequest.query(totalQuery);
  const totalItems = totalResult.recordset?.[0]?.TotalCount ?? 0;

  return { rows, totalItems };
}

/** Count how many rows in a master table share the given user code (duplicate guard). */
export async function countByUsercode(table: string, usercode: number): Promise<number> {
  const pool = await getPool();
  const dupRequest = pool.request();
  dupRequest.input('usercode', sql.Int, usercode);
  const dupResult = await dupRequest.query(
    `SELECT COUNT(*) AS c FROM ${table} WHERE md_Usercode = @usercode;`,
  );
  return Number(dupResult.recordset?.[0]?.c) ?? 0;
}

/** Insert a new DPR master record (CREATE — replicates the legacy save endpoints). */
export async function insertRecord(
  table: string,
  payload: {
    md_Usercode: number;
    md_firstname: string;
    md_lastname: string;
    md_position: string;
    md_status: string;
  },
): Promise<number> {
  const pool = await getPool();
  const insertRequest = pool.request();
  insertRequest.input('usercode', sql.Int, payload.md_Usercode);
  insertRequest.input('firstname', sql.NVarChar(100), payload.md_firstname);
  insertRequest.input('lastname', sql.NVarChar(100), payload.md_lastname);
  insertRequest.input('position', sql.NVarChar(100), payload.md_position);
  insertRequest.input('status', sql.Char(1), payload.md_status);

  const insertQuery = `
INSERT INTO ${table} (md_Usercode, md_firstname, md_lastname, md_position, md_status)
VALUES (@usercode, @firstname, @lastname, @position, @status);
`;
  const result = await insertRequest.query(insertQuery);
  return result.rowsAffected?.[0] ?? 0;
}

/**
 * Update the 4 editable fields of a DPR master record.
 * Keying: by id when rowId is supplied (precise, handles legacy duplicates),
 * otherwise falls back to the legacy md_Usercode key.
 */
export async function updateRecord(
  table: string,
  payload: {
    md_Usercode: number;
    md_firstname: string;
    md_lastname: string;
    md_position: string;
    md_status: string;
  },
  rowId: number | null,
): Promise<number> {
  const pool = await getPool();
  const updateRequest = pool.request();
  if (rowId !== null) updateRequest.input('rowid', sql.Int, rowId);
  updateRequest.input('usercode', sql.Int, payload.md_Usercode);
  updateRequest.input('firstname', sql.NVarChar(100), payload.md_firstname);
  updateRequest.input('lastname', sql.NVarChar(100), payload.md_lastname);
  updateRequest.input('position', sql.NVarChar(100), payload.md_position);
  updateRequest.input('status', sql.Char(1), payload.md_status);

  const updateQuery = rowId !== null
    ? `
UPDATE ${table}
SET md_Usercode = @usercode,
    md_firstname = @firstname,
    md_lastname = @lastname,
    md_position = @position,
    md_status = @status
WHERE id = @rowid;
`
    : `
UPDATE ${table}
SET md_firstname = @firstname,
    md_lastname = @lastname,
    md_position = @position,
    md_status = @status
WHERE md_Usercode = @usercode;
`;
  const result = await updateRequest.query(updateQuery);
  return result.rowsAffected?.[0] ?? 0;
}

/** Fetch the md_Usercode for a master row (used by the delete reference guard). */
export async function findById(table: string, rowId: number): Promise<any | undefined> {
  const pool = await getPool();
  const rowRequest = pool.request();
  rowRequest.input('rowid', sql.Int, rowId);
  const rowResult = await rowRequest.query(
    `SELECT md_Usercode FROM ${table} WHERE id = @rowid;`,
  );
  return rowResult.recordset?.[0];
}

/**
 * Check every DPR data table that references this role for the user code.
 * Returns the names of tables that still reference it (non-empty → block delete).
 */
export async function findReferences(tab: string, usercode: string): Promise<string[]> {
  const refTables = DELETE_REFERENCE_TABLES[tab] ?? [];
  if (refTables.length === 0) return [];

  const pool = await getPool();
  const refRequest = pool.request();
  refRequest.input('usercode', sql.VarChar, usercode);
  const refUnion = refTables
    .map(
      ([tbl, col], i) =>
        `SELECT ${i} AS refIdx, COUNT(*) AS refCount FROM ${tbl} WHERE LTRIM(RTRIM(${col})) = @usercode`,
    )
    .join(' UNION ALL ');
  const refResult = await refRequest.query(refUnion);
  return (refResult.recordset ?? [])
    .filter((r: any) => Number(r.refCount) > 0)
    .map((r: any) => refTables[Number(r.refIdx)][0]);
}

/** Hard-delete a master row keyed on its id. */
export async function deleteRecord(table: string, rowId: number): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('rowid', sql.Int, rowId);
  const result = await request.query(`DELETE FROM ${table} WHERE id = @rowid;`);
  return result.rowsAffected?.[0] ?? 0;
}
