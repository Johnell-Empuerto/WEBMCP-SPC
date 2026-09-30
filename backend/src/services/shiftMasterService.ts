import * as repo from '../repositories/shiftMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for Shift Master.
// Contains business/use-case logic:
//   - Reads and trims request values
//   - Validates required fields + HHMM time format + total hours + status
//   - Normalizes '' → NULL for optional break times
//   - Orchestrates the duplicate check, reference guard and CRUD calls
// SQL belongs in shiftMasterRepository.ts; HTTP concerns belong in
// shiftMasterController.ts.
// ════════════════════════════════════════════════════════════════════════════

type ServiceError = { ok: false; statusCode: number; message: string };

type ListResult =
  | ServiceError
  | { ok: true; rows: any[]; totalItems: number };

type CheckResult =
  | ServiceError
  | { ok: true; exists: boolean };

type AddResult =
  | ServiceError
  | { ok: true; blocked: boolean; code: string; message?: string };

type UpdateResult =
  | ServiceError
  | { ok: true; code: string };

type DeleteResult =
  | ServiceError
  | { ok: true; blocked: boolean; code: string; references: string[]; message: string };

// Preserve the exact row shape the frontend depends on.
function mapRow(row: any): any {
  return {
    code: (row.Scm_ShiftCode ?? '').trim(),
    desc: (row.Scm_ShiftDesc ?? '').trim(),
    scheduleType: (row.Scm_ScheduleType ?? '').trim(),
    timein: (row.Scm_ShiftTimeIn ?? '').trim(),
    breakStart: (row.Scm_ShiftBreakStart ?? '').trim(),
    breakEnd: (row.Scm_ShiftBreakEnd ?? '').trim(),
    timeout: (row.Scm_ShiftTimeOut ?? '').trim(),
    totalHours: row.Scm_ShiftTotalHours == null ? 0 : Number(row.Scm_ShiftTotalHours),
    status: (row.Scm_Status ?? '').trim(),
    userLogin: (row.User_Login ?? '').trim(),
    updatedAt: row.ludatetime ?? null,
  };
}

// SHIFT → { status: 'ok' | 'error', message? } for a "HHMM" 24h time string.
function validateTime(value: string, label: string): { status: 'ok' } | { status: 'error'; message: string } {
  if (!/^\d{4}$/.test(value)) {
    return { status: 'error', message: `${label} must be a valid HHMM time` };
  }
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(2, 4));
  if (hours > 23 || minutes > 59) {
    return { status: 'error', message: `${label} must be a valid HHMM time` };
  }
  return { status: 'ok' };
}

// Shared validation for add + update.
interface ShiftPayload {
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
}

function parsePayload(
  body: any,
): ServiceError | { ok: true; data: ShiftPayload } {
  const b = body ?? {};
  const code = String(b.code ?? '').trim();
  const desc = String(b.desc ?? '').trim();
  const scheduleType = String(b.scheduleType ?? '').trim();
  const timein = String(b.timein ?? '').trim();
  const breakStart = String(b.breakStart ?? '').trim();
  const breakEnd = String(b.breakEnd ?? '').trim();
  const timeout = String(b.timeout ?? '').trim();
  const totalHours = Number(b.totalHours);
  const status = String(b.status ?? 'A').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (!code) {
    return { ok: false, statusCode: 400, message: 'Shift Code is required' };
  }
  if (!desc) {
    return { ok: false, statusCode: 400, message: 'Shift Description is required' };
  }
  if (!scheduleType || !['D', 'S', 'G'].includes(scheduleType)) {
    return { ok: false, statusCode: 400, message: 'Schedule Type is required' };
  }
  const timeCheck = validateTime(timein, 'Time In');
  if (timeCheck.status === 'error') {
    return { ok: false, statusCode: 400, message: timeCheck.message };
  }
  if (breakStart) {
    const t = validateTime(breakStart, 'Break Start');
    if (t.status === 'error') return { ok: false, statusCode: 400, message: t.message };
  }
  if (breakEnd) {
    const t = validateTime(breakEnd, 'Break End');
    if (t.status === 'error') return { ok: false, statusCode: 400, message: t.message };
  }
  const outCheck = validateTime(timeout, 'Time Out');
  if (outCheck.status === 'error') {
    return { ok: false, statusCode: 400, message: outCheck.message };
  }
  if (!Number.isFinite(totalHours) || totalHours < 0) {
    return { ok: false, statusCode: 400, message: 'Total Hours must be a valid number' };
  }
  if (!['A', 'I'].includes(status)) {
    return { ok: false, statusCode: 400, message: 'Status must be Active or Inactive' };
  }

  return {
    ok: true,
    data: {
      code,
      desc,
      scheduleType,
      timein,
      breakStart: breakStart === '' ? null : breakStart,
      breakEnd: breakEnd === '' ? null : breakEnd,
      timeout,
      totalHours,
      status,
      userlogin,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /shift-master — list (filters + pagination)
// Query: { size, pageno, search, status }
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(query: any): Promise<ListResult> {
  const size = Math.max(1, Number(query.size) || 10);
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const search = String(query.search ?? '').trim();
  const status = String(query.status ?? '').trim();

  const { rows, totalItems } = await repo.listRecords({ size, offset, search, status });

  const records = rows.map(mapRow);
  return { ok: true, rows: records, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /shift-master/check — duplicate shift code check
// ════════════════════════════════════════════════════════════════════════════
export async function checkCode(query: any): Promise<CheckResult> {
  const code = String(query.code ?? '').trim();
  if (!code) {
    return { ok: false, statusCode: 400, message: 'Shift Code is required' };
  }

  const exists = await repo.checkCodeExists(code);
  return { ok: true, exists };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /shift-master — add
// Body: { code, desc, scheduleType, timein, breakStart, breakEnd, timeout,
//         totalHours, status, userlogin }
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const payloadResult = parsePayload(body);
  if (!payloadResult.ok) return payloadResult;

  // ── Duplicate guard ──────────────────────────────────────────────────────
  const exists = await repo.checkCodeExists(payloadResult.data.code);
  if (exists) {
    return {
      ok: true,
      blocked: true,
      code: payloadResult.data.code,
      message: `Shift "${payloadResult.data.code}" already exists`,
    };
  }

  await repo.insertRecord(payloadResult.data);
  return { ok: true, blocked: false, code: payloadResult.data.code };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /shift-master — update
// Body: { code (immutable key), desc, scheduleType, timein, breakStart,
//         breakEnd, timeout, totalHours, status, userlogin }
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const payloadResult = parsePayload(body);
  if (!payloadResult.ok) return payloadResult;

  const affected = await repo.updateRecord(payloadResult.data);

  if (affected === 0) {
    return {
      ok: false,
      statusCode: 404,
      message: `Shift "${payloadResult.data.code}" not found`,
    };
  }

  return { ok: true, code: payloadResult.data.code };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /shift-master — delete (with reference safety guard)
// Query: { code } — hard deletes the T_ShiftCodeMaster row.
// SAFETY GUARD: if any table still references the shift, the delete is
// blocked ({ status: 'blocked', references }).
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const code = String(query.code ?? '').trim();
  if (!code) {
    return { ok: false, statusCode: 400, message: 'Shift Code is required' };
  }

  // ── Safety guard: block delete if the shift is referenced anywhere ───────
  const references = await repo.findReferences(code);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      code,
      references,
      message: `Shift "${code}" cannot be deleted because it is referenced by other records.`,
    };
  }

  const affected = await repo.deleteRecord(code);
  if (affected === 0) {
    return { ok: false, statusCode: 404, message: `Shift "${code}" not found` };
  }

  return {
    ok: true,
    blocked: false,
    code,
    references: [],
    message: `Shift "${code}" deleted successfully.`,
  };
}
