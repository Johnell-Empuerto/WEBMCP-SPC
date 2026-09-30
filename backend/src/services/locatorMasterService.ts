import * as repo from '../repositories/locatorMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for Locator Master.
// Contains business/use-case logic:
//   - Reads and trims request values
//   - Validates required fields
//   - Applies the legacy locator-code length rule
//   - Orchestrates the duplicate check, reference guard and CRUD calls
// SQL belongs in locatorMasterRepository.ts; HTTP concerns belong in
// locatorMasterController.ts.
// ════════════════════════════════════════════════════════════════════════════

type ServiceError = { ok: false; statusCode: number; message: string };

type ListResult =
  | ServiceError
  | { ok: true; result: any[]; totalItems: number };

type CheckResult =
  | ServiceError
  | { ok: true; result: number };

type AddResult =
  | ServiceError
  | { ok: true; blocked: true; locatorcode: string; references: string[]; message: string }
  | { ok: true; blocked: false; locatorcode: string };

type UpdateResult =
  | ServiceError
  | { ok: true; locatorcode: string };

type DeleteResult =
  | ServiceError
  | { ok: true; blocked: boolean; locatorcode: string; references: string[]; message: string };

// Trim helper — the locator key column is char(6) so SQL Server pads it with
// spaces; trim it so the front-end keys/display are clean.
function LTRIM_TRIM(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// ════════════════════════════════════════════════════════════════════════════
// GET /locator-master — list (filters + pagination)
// Query: { size, pageno, search, type, area, occupancy, status, warehouse }
// Replicates legacy getLocatorMaster24 / getLocatorMasterWithPara24.
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(query: any): Promise<ListResult> {
  const size = Math.max(1, Number(query.size) || 10);
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const search = String(query.search ?? '').trim();
  const type = String(query.type ?? '').trim();
  const area = String(query.area ?? '').trim();
  const occupancy = String(query.occupancy ?? '').trim();
  const status = String(query.status ?? '').trim();
  const warehouse = String(query.warehouse ?? '').trim();

  const { rows, totalItems } = await repo.listRecords({
    size,
    offset,
    search,
    type,
    area,
    occupancy,
    status,
    warehouse,
  });

  // Legacy LoopDataArrangementEvents — same projected row shape.
  const result = rows.map((row: any) => ({
    Lmt_Locatorcode: LTRIM_TRIM(row.Lmt_Locatorcode),
    Lmt_Locatordesc: row.Lmt_Locatordesc,
    Lmt_LocatorType: row.Lmt_LocatorType,
    Lmt_LocatorArea: row.Lmt_LocatorArea,
    Lmt_OccupancyStatus: row.Lmt_OccupancyStatus,
    Lmt_EffectivityDate: row.Lmt_EffectivityDate,
    Lmt_status: row.Lmt_status,
    Lmt_WarehouseCode: row.Lmt_WarehouseCode,
    User_login: row.User_login,
    ludatetime: row.ludatetime,
    selected: false,
  }));

  return { ok: true, result, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /locator-master/check — duplicate locator code check
// Query: { code } — returns result 1 if a locator with that code exists.
// Replicates legacy checkifCodeExists24 (type=locatormaster).
// ════════════════════════════════════════════════════════════════════════════
export async function checkCode(query: any): Promise<CheckResult> {
  const code = String(query.code ?? '').trim();
  if (!code) {
    return { ok: false, statusCode: 400, message: 'Locator Code is required' };
  }

  const exists = await repo.checkCodeExists(code);
  return { ok: true, result: exists ? 1 : 0 };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /locator-master — add
// Body: { locatorcode, desc, type, area, occupancy, status, warehouse, userlogin }
// Replicates legacy addLocatorMaster24: INSERT with CURRENT_TIMESTAMP for
// Lmt_EffectivityDate and ludatetime. Rejects a duplicate Lmt_Locatorcode.
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const b = body ?? {};
  const locatorcode = String(b.locatorcode ?? '').trim();
  const desc = String(b.desc ?? '').trim();
  const type = String(b.type ?? '').trim();
  const area = String(b.area ?? '').trim();
  const occupancy = String(b.occupancy ?? '').trim();
  const status = String(b.status ?? '').trim();
  const warehouse = String(b.warehouse ?? '').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (!locatorcode) {
    return { ok: false, statusCode: 400, message: 'Locator Code is required' };
  }
  if (locatorcode.length > 6) {
    return { ok: false, statusCode: 400, message: 'Locator Code must be 6 characters or fewer' };
  }

  // ── Duplicate check (legacy checkifCodeExists24) ────────────────────────
  const exists = await repo.checkCodeExists(locatorcode);
  if (exists) {
    return {
      ok: true,
      blocked: true,
      locatorcode,
      references: [],
      message: `Locator "${locatorcode}" already exists.`,
    };
  }

  await repo.insertRecord({ locatorcode, desc, type, area, occupancy, status, warehouse, userlogin });

  return { ok: true, blocked: false, locatorcode };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /locator-master — update
// Body: { locatorcode, desc, type, area, occupancy, status, warehouse,
//         effectivitydate, userlogin }
// Updates the editable fields of an existing locator, keyed on Lmt_Locatorcode.
// The locator code itself is never changed. ludatetime = GETDATE().
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const b = body ?? {};
  const locatorcode = String(b.locatorcode ?? '').trim();
  const desc = b.desc === null || b.desc === undefined ? null : String(b.desc);
  const type = b.type === null || b.type === undefined ? null : String(b.type);
  const area = b.area === null || b.area === undefined ? null : String(b.area);
  const occupancy = b.occupancy === null || b.occupancy === undefined ? null : String(b.occupancy);
  const status = b.status === null || b.status === undefined ? null : String(b.status);
  const warehouse = b.warehouse === null || b.warehouse === undefined ? null : String(b.warehouse);
  const effectivitydate = String(b.effectivitydate ?? '').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (!locatorcode) {
    return { ok: false, statusCode: 400, message: 'Locator Code is required' };
  }

  await repo.updateRecord({
    locatorcode,
    desc,
    type,
    area,
    occupancy,
    status,
    warehouse,
    effectivitydate,
    userlogin,
  });

  return { ok: true, locatorcode };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /locator-master — delete (with reference safety guard)
// Query: { locatorcode } — hard deletes the T_LocatorMaster row.
// SAFETY GUARD: if any table still references the locator, the delete is
// blocked ({ status: 'blocked', references: [...] }).
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const locatorcode = String(query.locatorcode ?? '').trim();

  if (!locatorcode) {
    return { ok: false, statusCode: 400, message: 'Locator Code is required' };
  }

  // ── Safety guard: block delete if the locator is referenced anywhere ────
  const references = await repo.findReferences(locatorcode);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      locatorcode,
      references,
      message: `Locator "${locatorcode}" cannot be deleted because it is referenced by other records.`,
    };
  }

  await repo.deleteRecord(locatorcode);

  return {
    ok: true,
    blocked: false,
    locatorcode,
    references: [],
    message: `Locator "${locatorcode}" deleted successfully.`,
  };
}
