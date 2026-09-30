import * as repo from '../repositories/kanbanMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for Kanban Master.
// Contains business/use-case logic:
//   - Reads and trims request filter values
//   - Applies legacy add rules (seq = row count + 1, Kanban ID construction)
//   - Orchestrates the reference guard and CRUD calls
// SQL belongs in kanbanMasterRepository.ts; HTTP concerns belong in
// kanbanMasterController.ts.
// ════════════════════════════════════════════════════════════════════════════

type ServiceError = { ok: false; statusCode: number; message: string };

type ListResult =
  | ServiceError
  | { ok: true; result: any[]; totalItems: number };

type AddResult =
  | ServiceError
  | { ok: true };

type UpdateResult =
  | ServiceError
  | { ok: true; kanbanid: string };

type DeleteResult =
  | ServiceError
  | { ok: true; blocked: boolean; kanbanid: string; references: string[]; message: string };

// ════════════════════════════════════════════════════════════════════════════
// GET /kanban-master — list (filters + pagination)
// Query: { size, pageno, kanban, partno, capacity, rem }
// Replicates legacy getKanbanMaster (node a7275d1cff61acd5).
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(query: any): Promise<ListResult> {
  const size = Math.max(1, Number(query.size) || 10);
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const kanban = String(query.kanban ?? '').trim();
  const partno = String(query.partno ?? '').trim();
  const capacity = String(query.capacity ?? '').trim();
  const rem = String(query.rem ?? '').trim();

  const { rows, totalItems } = await repo.listRecords({ size, offset, kanban, partno, capacity, rem });

  // Legacy LoopDataArrangementEvents — same projected row shape.
  const result = rows.map((row: any) => ({
    Kbm_DefaultLocator: row.Kbm_DefaultLocator,
    Kbm_Description: row.Kbm_Description,
    Kbm_KanbanID: row.Kbm_KanbanID,
    Kbm_PartNo: row.Kbm_PartNo,
    Kbm_Qty: row.Kbm_Qty,
    Kbm_RegBy: row.Kbm_RegBy,
    Kbm_RegDate: row.Kbm_RegDate,
    Kbm_Remarks: row.Kbm_Remarks,
    Kbm_Status: row.Kbm_Status,
    User_login: row.User_login,
    ludatetime: row.ludatetime,
    selected: false,
  }));

  return { ok: true, result, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /kanban-master — add (auto Kanban-ID + INSERT)
// Body: { partno, desc, capacity, loc, rem, userlogin }
// Replicates legacy addKanbanMaster (node bf27251fe321f0b5):
//   1. seq = total E_KanbanMaster row count + 1 (legacy ROW_NUMBER query)
//   2. Kanban ID = 'KB-' + TRIM(Pmt_InternalProdCode) + YYYYMMDD + seq:3
//   3. INSERT with Kbm_Status = '1'
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const b = body ?? {};
  const partno = String(b.partno ?? '').trim();
  const desc = String(b.desc ?? '').trim();
  const capacity = String(b.capacity ?? '').trim();
  const loc = String(b.loc ?? '').trim();
  const rem = String(b.rem ?? '').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (!partno) {
    return { ok: false, statusCode: 400, message: 'Part No is required' };
  }

  // ── 1. Seq = row count + 1 (legacy node 24c96140b73d575e → 6a41920a65149e9f) ──
  const kanbanNo = await repo.getNextSeq();

  // ── 2. Server date YYYYMMDD + seq padded to 3 digits ───────────────────
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const formattedDate = `${year}${month}${day}`;
  const seq = String(Number(kanbanNo) + 1).padStart(3, '0');
  const kbID3 = formattedDate + seq;

  // ── 3. INSERT (legacy node 9e97067bd44e37a8 → a5f5a282fad9e252) ────────
  await repo.insertRecord({
    partno,
    desc,
    userlogin,
    capacity: capacity ? Number(capacity) : 0,
    loc,
    rem,
    kbID3,
  });

  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /kanban-master — update
// Body: { kanbanid, partno, desc, capacity, loc, rem, userlogin }
// Updates the editable fields of an existing kanban, keyed on Kbm_KanbanID.
// The Kanban ID itself is never changed. ludatetime = GETDATE().
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const b = body ?? {};
  const kanbanid = String(b.kanbanid ?? '').trim();
  const partno = String(b.partno ?? '').trim();
  const desc = String(b.desc ?? '').trim();
  const capacity = String(b.capacity ?? '').trim();
  const loc = String(b.loc ?? '').trim();
  const rem = String(b.rem ?? '').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (!kanbanid) {
    return { ok: false, statusCode: 400, message: 'Kanban ID is required' };
  }
  if (!partno) {
    return { ok: false, statusCode: 400, message: 'Part No is required' };
  }

  await repo.updateRecord({
    kanbanid,
    partno,
    desc,
    capacity: capacity ? Number(capacity) : 0,
    loc,
    rem,
    userlogin,
  });

  return { ok: true, kanbanid };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /kanban-master — delete (with reference safety guard)
// Query: { kanbanid } — hard deletes the E_KanbanMaster row.
// SAFETY GUARD: if any table still references the kanban, the delete is
// blocked ({ status: 'blocked', references: [...] }).
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const kanbanid = String(query.kanbanid ?? '').trim();

  if (!kanbanid) {
    return { ok: false, statusCode: 400, message: 'Kanban ID is required' };
  }

  // ── Safety guard: block delete if the kanban is referenced anywhere ─────
  const references = await repo.findReferences(kanbanid);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      kanbanid,
      references,
      message: `Kanban "${kanbanid}" cannot be deleted because it is referenced by other records.`,
    };
  }

  await repo.deleteRecord(kanbanid);

  return {
    ok: true,
    blocked: false,
    kanbanid,
    references: [],
    message: `Kanban "${kanbanid}" deleted successfully.`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /kanban-master/lookups — dropdown data in one call
// ════════════════════════════════════════════════════════════════════════════
export async function getLookups() {
  return repo.getLookups();
}
