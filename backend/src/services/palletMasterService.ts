import * as repo from '../repositories/palletMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for Pallet Master.
// Contains business/use-case logic:
//   - Reads and trims request values
//   - Validates required fields + legacy length rule
//   - Orchestrates the duplicate check, reference guard and CRUD calls
// SQL belongs in palletMasterRepository.ts; HTTP concerns belong in
// palletMasterController.ts.
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
  | { ok: true; blocked: true; palletcode: string; references: string[]; message: string }
  | { ok: true; blocked: false; palletcode: string };

type UpdateResult =
  | ServiceError
  | { ok: true; palletcode: string };

type DeleteResult =
  | ServiceError
  | { ok: true; blocked: boolean; palletcode: string; references: string[]; message: string };

// ════════════════════════════════════════════════════════════════════════════
// GET /pallet-master — list (filters + pagination)
// Query: { size, pageno, search, category, status }
// Replicates legacy getPalletMaster24 / getPalletMasterWithPara24.
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(query: any): Promise<ListResult> {
  const size = Math.max(1, Number(query.size) || 10);
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const search = String(query.search ?? '').trim();
  const category = String(query.category ?? '').trim();
  const status = String(query.status ?? '').trim();

  const { rows, totalItems } = await repo.listRecords({ size, offset, search, category, status });

  // Legacy LoopDataArrangementEvents — same projected row shape.
  const result = rows.map((row: any) => ({
    Ptm_PalletCode: row.Ptm_PalletCode,
    Ptm_PalletDesc: row.Ptm_PalletDesc,
    Ptm_PalletColor: row.Ptm_PalletColor,
    Ptm_Category: row.Ptm_Category,
    Ptm_Status: row.Ptm_Status,
    user_Login: row.user_Login,
    ludatetime: row.ludatetime,
    selected: false,
  }));

  return { ok: true, result, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /pallet-master/check — duplicate pallet code check
// Query: { code } — returns result 1 if a pallet with that code exists.
// Replicates legacy checkifCodeExists24 (type=palletmaster).
// ════════════════════════════════════════════════════════════════════════════
export async function checkCode(query: any): Promise<CheckResult> {
  const code = String(query.code ?? '').trim();
  if (!code) {
    return { ok: false, statusCode: 400, message: 'Pallet Code is required' };
  }

  const exists = await repo.checkCodeExists(code);
  return { ok: true, result: exists ? 1 : 0 };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /pallet-master — add
// Body: { palletcode, desc, color, category, status, userlogin }
// Replicates legacy addPalletMaster24: INSERT with CURRENT_TIMESTAMP and the
// logged-in user in user_Login. Rejects a duplicate Ptm_PalletCode.
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const b = body ?? {};
  const palletcode = String(b.palletcode ?? '').trim();
  const desc = b.desc === null || b.desc === undefined ? null : String(b.desc);
  const color = b.color === null || b.color === undefined ? null : String(b.color);
  const category = String(b.category ?? '').trim();
  const status = String(b.status ?? '').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (!palletcode) {
    return { ok: false, statusCode: 400, message: 'Pallet Code is required' };
  }
  if (palletcode.length > 35) {
    return { ok: false, statusCode: 400, message: 'Pallet Code must be 35 characters or fewer' };
  }

  // ── Duplicate check (legacy checkifCodeExists24) ────────────────────────
  const exists = await repo.checkCodeExists(palletcode);
  if (exists) {
    return {
      ok: true,
      blocked: true,
      palletcode,
      references: [],
      message: `Pallet "${palletcode}" already exists.`,
    };
  }

  await repo.insertRecord({ palletcode, desc, color, category, status, userlogin });

  return { ok: true, blocked: false, palletcode };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /pallet-master — update
// Body: { palletcode, desc, color, category, status, userlogin }
// Updates the editable fields of an existing pallet, keyed on Ptm_PalletCode.
// The pallet code itself is never changed. ludatetime = GETDATE().
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const b = body ?? {};
  const palletcode = String(b.palletcode ?? '').trim();
  const desc = b.desc === null || b.desc === undefined ? null : String(b.desc);
  const color = b.color === null || b.color === undefined ? null : String(b.color);
  const category = String(b.category ?? '').trim();
  const status = String(b.status ?? '').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (!palletcode) {
    return { ok: false, statusCode: 400, message: 'Pallet Code is required' };
  }

  await repo.updateRecord({ palletcode, desc, color, category, status, userlogin });

  return { ok: true, palletcode };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /pallet-master — delete (with reference safety guard)
// Query: { palletcode } — hard deletes the E_PalletMaster row.
// SAFETY GUARD: if any table still references the pallet, the delete is
// blocked ({ status: 'blocked', references: [...] }).
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const palletcode = String(query.palletcode ?? '').trim();

  if (!palletcode) {
    return { ok: false, statusCode: 400, message: 'Pallet Code is required' };
  }

  // ── Safety guard: block delete if the pallet is referenced anywhere ─────
  const references = await repo.findReferences(palletcode);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      palletcode,
      references,
      message: `Pallet "${palletcode}" cannot be deleted because it is referenced by other records.`,
    };
  }

  await repo.deleteRecord(palletcode);

  return {
    ok: true,
    blocked: false,
    palletcode,
    references: [],
    message: `Pallet "${palletcode}" deleted successfully.`,
  };
}
