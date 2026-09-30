import * as repo from '../repositories/preferenceMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for Preference Master.
// Contains business/use-case logic:
//   - Reads and trims request values
//   - Validates required fields + legacy length rules
//   - Normalizes '' → NULL for the stored value
//   - Orchestrates the duplicate check and CRUD calls
// SQL belongs in preferenceMasterRepository.ts; HTTP concerns belong in
// preferenceMasterController.ts.
// ════════════════════════════════════════════════════════════════════════════

type ServiceError = { ok: false; statusCode: number; message: string };

type ListResult =
  | ServiceError
  | { ok: true; rows: any[]; totalItems: number };

type GroupsResult =
  | ServiceError
  | { ok: true; groups: string[] };

type CheckResult =
  | ServiceError
  | { ok: true; exists: boolean };

type AddResult =
  | ServiceError
  | { ok: true; blocked: boolean; parameterid: string; seq: number; message?: string };

type UpdateResult =
  | ServiceError
  | { ok: true; parameterid: string; seq: number };

type DeleteResult =
  | ServiceError
  | { ok: true; parameterid: string; seq: number };

// Preserve the exact row shape the frontend depends on.
function mapRow(row: any): any {
  return {
    parameterid: (row.Pmt_ParameterID ?? '').trim(),
    seq: row.Pmt_ParameterSeq,
    desc: (row.Pmt_ParameterDesc ?? '').trim(),
    value: row.Pmt_StringValue == null ? '' : String(row.Pmt_StringValue).trim(),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /preference-master — list (filters + pagination)
// Query: { size, pageno, search, group }
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(query: any): Promise<ListResult> {
  const size = Math.max(1, Number(query.size) || 10);
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const search = String(query.search ?? '').trim();
  const group = String(query.group ?? '').trim();

  const { rows, totalItems } = await repo.listRecords({ size, offset, search, group });

  const records = rows.map(mapRow);
  return { ok: true, rows: records, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /preference-master/groups — distinct parameter groups for the filter
// ════════════════════════════════════════════════════════════════════════════
export async function getGroups(): Promise<GroupsResult> {
  const groups = await repo.getGroups();
  return { ok: true, groups };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /preference-master/check — duplicate (group, seq) check
// ════════════════════════════════════════════════════════════════════════════
export async function checkKey(query: any): Promise<CheckResult> {
  const parameterid = String(query.parameterid ?? '').trim();
  const seq = Number(query.seq);

  if (!parameterid || Number.isNaN(seq)) {
    return { ok: false, statusCode: 400, message: 'Group and Sequence are required' };
  }

  const exists = await repo.checkKeyExists(parameterid, seq);
  return { ok: true, exists };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /preference-master — add
// Body: { parameterid, seq, desc, value }
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const parameterid = String(body.parameterid ?? '').trim();
  const seq = Number(body.seq);
  const desc = String(body.desc ?? '').trim();
  const value = String(body.value ?? '').trim();

  if (!parameterid) {
    return { ok: false, statusCode: 400, message: 'Parameter Group is required' };
  }
  if (parameterid.length > 20) {
    return { ok: false, statusCode: 400, message: 'Parameter Group must be 20 characters or less' };
  }
  if (Number.isNaN(seq)) {
    return { ok: false, statusCode: 400, message: 'Sequence is required' };
  }
  if (!desc) {
    return { ok: false, statusCode: 400, message: 'Description is required' };
  }
  if (value.length > 50) {
    return { ok: false, statusCode: 400, message: 'Value must be 50 characters or less' };
  }

  const storeValue = value === '' ? null : value;

  // ── Duplicate (group, seq) guard ─────────────────────────────────────────
  const exists = await repo.checkKeyExists(parameterid, seq);
  if (exists) {
    return {
      ok: true,
      blocked: true,
      parameterid,
      seq,
      message: `Preference "${parameterid}" (seq ${seq}) already exists`,
    };
  }

  await repo.insertRecord({ parameterid, seq, desc, value: storeValue });

  return { ok: true, blocked: false, parameterid, seq };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /preference-master — update
// Body: { parameterid (immutable key), seq (immutable key), desc, value }
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const parameterid = String(body.parameterid ?? '').trim();
  const seq = Number(body.seq);
  const desc = String(body.desc ?? '').trim();
  const value = String(body.value ?? '').trim();

  if (!parameterid || Number.isNaN(seq)) {
    return { ok: false, statusCode: 400, message: 'Group and Sequence are required' };
  }
  if (!desc) {
    return { ok: false, statusCode: 400, message: 'Description is required' };
  }

  const storeValue = value === '' ? null : value;

  const affected = await repo.updateRecord({ parameterid, seq, desc, value: storeValue });

  if (affected === 0) {
    return {
      ok: false,
      statusCode: 404,
      message: `Preference "${parameterid}" (seq ${seq}) not found`,
    };
  }

  return { ok: true, parameterid, seq };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /preference-master — delete
// Query: { parameterid, seq }
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const parameterid = String(query.parameterid ?? '').trim();
  const seq = Number(query.seq);

  if (!parameterid || Number.isNaN(seq)) {
    return { ok: false, statusCode: 400, message: 'Group and Sequence are required' };
  }

  const affected = await repo.deleteRecord(parameterid, seq);
  if (affected === 0) {
    return {
      ok: false,
      statusCode: 404,
      message: `Preference "${parameterid}" (seq ${seq}) not found`,
    };
  }

  return { ok: true, parameterid, seq };
}
