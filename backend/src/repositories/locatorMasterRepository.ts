import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for Locator Master.
// Responsible for database access only — all SQL Server queries for Locator
// Master live in this file. No HTTP concerns, no business rules.
// Business logic belongs in locatorMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════

export interface LocatorListParams {
  size: number;
  offset: number;
  search: string;
  type: string;
  area: string;
  occupancy: string;
  status: string;
  warehouse: string;
}

/**
 * List locator records with filters + pagination.
 * Replicates legacy getLocatorMaster24 (f508e0aa094f0bc4) and
 * getLocatorMasterWithPara24 (db797e1d7a67e552): base WHERE
 * Lmt_Locatorcode IS NOT NULL, prefix-LIKE on code / type / area / occupancy /
 * status, equality on warehouse, ORDER BY Lmt_Locatorcode desc,
 * OFFSET/FETCH pagination.
 */
export async function listRecords(
  params: LocatorListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, search, type, area, occupancy, status, warehouse } = params;

  // ── WHERE building (same builder logic as the legacy getLCRFunction_query) ─
  const conditions: string[] = [`Lmt_Locatorcode IS NOT NULL`];
  if (search) conditions.push(`LTRIM(RTRIM(Lmt_Locatorcode)) LIKE @search + '%'`);
  if (type) conditions.push(`LTRIM(RTRIM(Lmt_LocatorType)) LIKE @type + '%'`);
  if (area) conditions.push(`LTRIM(RTRIM(Lmt_LocatorArea)) LIKE @area + '%'`);
  if (occupancy) conditions.push(`LTRIM(RTRIM(Lmt_OccupancyStatus)) LIKE @occupancy + '%'`);
  if (status) conditions.push(`LTRIM(RTRIM(Lmt_status)) LIKE @status + '%'`);
  if (warehouse) conditions.push(`LTRIM(RTRIM(Lmt_WarehouseCode)) = @warehouse`);

  const where = conditions.join(' AND ');

  const query = `
SELECT *,'false' AS selected
FROM T_LocatorMaster
WHERE ${where}
ORDER BY Lmt_Locatorcode DESC
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM T_LocatorMaster
WHERE ${where};
`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('size', sql.Int, size);
  listRequest.input('offset', sql.Int, offset);
  if (search) listRequest.input('search', sql.VarChar, search);
  if (type) listRequest.input('type', sql.VarChar, type);
  if (area) listRequest.input('area', sql.VarChar, area);
  if (occupancy) listRequest.input('occupancy', sql.VarChar, occupancy);
  if (status) listRequest.input('status', sql.VarChar, status);
  if (warehouse) listRequest.input('warehouse', sql.VarChar, warehouse);
  const listResult = await listRequest.query(query);
  const rows = listResult.recordset ?? [];

  const totalRequest = pool.request();
  if (search) totalRequest.input('search', sql.VarChar, search);
  if (type) totalRequest.input('type', sql.VarChar, type);
  if (area) totalRequest.input('area', sql.VarChar, area);
  if (occupancy) totalRequest.input('occupancy', sql.VarChar, occupancy);
  if (status) totalRequest.input('status', sql.VarChar, status);
  if (warehouse) totalRequest.input('warehouse', sql.VarChar, warehouse);
  const totalResult = await totalRequest.query(totalQuery);
  const totalItems = totalResult.recordset?.[0]?.TotalCount ?? 0;

  return { rows, totalItems };
}

/**
 * Duplicate locator code check.
 * Replicates legacy checkifCodeExists24 (type=locatormaster). Returns 1 if
 * a locator with that code exists.
 */
export async function checkCodeExists(code: string): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request();
  request.input('code', sql.VarChar, code);
  const result = await request.query(`
SELECT COUNT(*) AS count
FROM T_LocatorMaster
WHERE LTRIM(RTRIM(Lmt_Locatorcode)) = @code;
`);
  return Number(result.recordset?.[0]?.count ?? 0) > 0;
}

/**
 * Insert a new locator.
 * Replicates legacy addLocatorMaster24: INSERT with CURRENT_TIMESTAMP for
 * Lmt_EffectivityDate and ludatetime.
 */
export async function insertRecord(params: {
  locatorcode: string;
  desc: string;
  type: string;
  area: string;
  occupancy: string;
  status: string;
  warehouse: string;
  userlogin: string;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('locatorcode', sql.Char, params.locatorcode);
  request.input('desc', sql.Char, params.desc);
  request.input('type', sql.Char, params.type);
  request.input('area', sql.Char, params.area);
  request.input('occupancy', sql.Char, params.occupancy);
  request.input('status', sql.Char, params.status);
  request.input('warehouse', sql.Char, params.warehouse);
  request.input('userlogin', sql.Char, params.userlogin);

  const query = `
INSERT INTO T_LocatorMaster
([Lmt_Locatorcode], [Lmt_Locatordesc], [Lmt_LocatorType], [Lmt_LocatorArea],
 [Lmt_OccupancyStatus], [Lmt_EffectivityDate], [Lmt_status], [User_login],
 [ludatetime], [Lmt_WarehouseCode])
VALUES
(@locatorcode, @desc, @type, @area,
 @occupancy, CURRENT_TIMESTAMP, @status, @userlogin,
 CURRENT_TIMESTAMP, @warehouse);
`;

  const result = await request.query(query);
  return result.rowsAffected?.[0] ?? 0;
}

/**
 * Update the editable fields of an existing locator, keyed on Lmt_Locatorcode.
 * The locator code itself is never changed. ludatetime = GETDATE().
 */
export async function updateRecord(params: {
  locatorcode: string;
  desc: string | null;
  type: string | null;
  area: string | null;
  occupancy: string | null;
  status: string | null;
  warehouse: string | null;
  effectivitydate: string;
  userlogin: string;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('locatorcode', sql.VarChar, params.locatorcode);
  request.input('desc', sql.Char, params.desc);
  request.input('type', sql.Char, params.type);
  request.input('area', sql.Char, params.area);
  request.input('occupancy', sql.Char, params.occupancy);
  request.input('status', sql.Char, params.status);
  request.input('warehouse', sql.Char, params.warehouse);
  request.input('userlogin', sql.Char, params.userlogin);
  if (params.effectivitydate) {
    request.input('effectivitydate', sql.DateTime, new Date(params.effectivitydate));
  }

  const query = `
UPDATE T_LocatorMaster
SET [Lmt_Locatordesc] = @desc,
    [Lmt_LocatorType] = @type,
    [Lmt_LocatorArea] = @area,
    [Lmt_OccupancyStatus] = @occupancy,
    [Lmt_status] = @status,
    [Lmt_WarehouseCode] = @warehouse,
    [Lmt_EffectivityDate] = ${params.effectivitydate ? '@effectivitydate' : 'GETDATE()'},
    [User_login] = @userlogin,
    [ludatetime] = GETDATE()
WHERE LTRIM(RTRIM(Lmt_Locatorcode)) = @locatorcode;
`;

  const result = await request.query(query);
  return result.rowsAffected?.[0] ?? 0;
}

// Tables that reference a locator code — used by the delete safety guard so
// historical/transactional data is never orphaned. Comparisons use
// LTRIM(RTRIM(col)) because the locator key and reference columns are char
// (space-padded).
const REFERENCE_TABLES: Array<[string, string]> = [
  ['E_KanbanMaster', 'Kbm_DefaultLocator'],
  ['E_KanbanTaggingHeader', 'Kth_LocatorCode'],
  ['T_AssetTransferDetail', 'Atd_LocatorCodeFrom'],
  ['T_AssetTransferDetail', 'Atd_LocatorCodeTo'],
  ['T_FGEndorsed', 'Fge_LocatorCode'],
  ['T_MonthlyInventory', 'Mit_locatorcode'],
  ['T_MonthlyInventoryBackup', 'Mit_locatorcode'],
  ['T_MonthlyInventoryHandyStaging', 'Mih_LocatorCode'],
  ['T_MonthlyInventoryHistory', 'Mit_locatorcode'],
  ['T_MonthlyInventoryScannedDetail', 'Mis_LocatorCode'],
  ['T_ReceivingReportCutOff', 'Rrc_locatorcode'],
  ['T_ReceivingReportDetail', 'Rrd_locatorcode'],
  ['T_TempMITNonExisting', 'Mne_locatorcode'],
  ['T_TempScannedLabelIndicator', 'Sli_locatorcode'],
  ['T_WarehouseTransferDetail', 'Wtd_LocatorOld'],
  ['T_WarehouseTransferDetail', 'Wtd_Locator'],
];

/**
 * Check every referencing table for the locator code.
 * Returns the names of tables that still reference it (non-empty → block delete).
 */
export async function findReferences(locatorcode: string): Promise<string[]> {
  const pool = await getPool();
  const refRequest = pool.request();
  refRequest.input('locatorcode', sql.VarChar, locatorcode);
  const refUnion = REFERENCE_TABLES.map(
    ([tbl, col], i) =>
      `SELECT ${i} AS refIdx, COUNT(*) AS refCount FROM ${tbl} WHERE LTRIM(RTRIM(${col})) = @locatorcode`,
  ).join(' UNION ALL ');
  const refResult = await refRequest.query(refUnion);
  return (refResult.recordset ?? [])
    .filter((r: any) => Number(r.refCount) > 0)
    .map((r: any) => REFERENCE_TABLES[Number(r.refIdx)][0]);
}

/** Hard-delete a locator keyed on Lmt_Locatorcode. */
export async function deleteRecord(locatorcode: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('locatorcode', sql.VarChar, locatorcode);
  const result = await request.query(`
DELETE FROM T_LocatorMaster WHERE LTRIM(RTRIM(Lmt_Locatorcode)) = @locatorcode;
`);
  return result.rowsAffected?.[0] ?? 0;
}
