import crypto from 'crypto';
import * as repo from '../repositories/userMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for User Master.
// Contains business/use-case logic:
//   - Reads and trims request values
//   - Validates required fields + legacy length rules + status values
//   - Applies the legacy md5Prefix password-hashing scheme
//   - Derives role bit flags from the role string (SA | A | U)
//   - Orchestrates the duplicate check, reference guard and CRUD calls
// SQL belongs in userMasterRepository.ts; HTTP concerns belong in
// userMasterController.ts.
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
  | { ok: true; blocked: boolean; usercode: string; message?: string };

type UpdateResult =
  | ServiceError
  | { ok: true; usercode: string };

type DeleteResult =
  | ServiceError
  | { ok: true; blocked: boolean; usercode: string; references: string[]; message: string };

// ── Password hashing (legacy md5Prefix) ─────────────────────────────────────
// Legacy scheme: uppercase HEX MD5 of the raw password truncated to the first
// 14 characters (stored in Umt_Userpswd, a varchar(15)). Must NOT be changed
// without approval — existing credentials depend on it.
function md5Prefix(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex').toUpperCase().slice(0, 14);
}

// Role is derived from two bit flags: Umt_usermnt = Super Admin,
// Umt_usersupv = Admin (both false = regular User).
function toRoleFlags(role: string): { usermnt: boolean; usersupv: boolean } {
  const r = String(role ?? '').toUpperCase();
  if (r === 'SA') return { usermnt: true, usersupv: true };
  if (r === 'A') return { usermnt: false, usersupv: true };
  return { usermnt: false, usersupv: false };
}

function statusIsValid(status: string): boolean {
  return status === 'A' || status === 'I';
}

// Preserve the exact row shape the frontend depends on.
function mapRow(row: any): any {
  return {
    usercode: row.Umt_Usercode,
    fname: row.fn,
    mi: row.mi,
    lname: row.ln,
    name: [row.fn, row.mi, row.ln].filter(Boolean).join(' ') || row.Umt_Usercode,
    email: row.Umt_Email ?? '',
    position: row.Umt_Position ?? '',
    costcenter: (row.Umt_UserCostCenter ?? '').trim(),
    usernumber: (row.Umt_Usernumber ?? '').trim(),
    status: row.Umt_status ?? 'A',
    usersupv: row.Umt_usersupv === true || row.Umt_usersupv === 1,
    usermnt: row.Umt_usermnt === true || row.Umt_usermnt === 1,
    isLocked: row.Umt_IsLocked === true || row.Umt_IsLocked === 1,
    isSystemAccount: row.Umt_IsSystemAccount === true || row.Umt_IsSystemAccount === 1,
    passwordExpired: row.Umt_PasswordExpired === true || row.Umt_PasswordExpired === 1,
    loginAttempts: row.Umt_LoginAttempts ?? 0,
    lastLogin: row.user_login ?? '',
    updatedAt: row.ludatetime ?? null,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /user-master — list (filters + pagination)
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
// GET /user-master/check — duplicate user code check
// ════════════════════════════════════════════════════════════════════════════
export async function checkCode(query: any): Promise<CheckResult> {
  const usercode = String(query.usercode ?? '').trim();
  if (!usercode) {
    return { ok: false, statusCode: 400, message: 'User Code is required' };
  }

  const exists = await repo.checkCodeExists(usercode);
  return { ok: true, exists };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /user-master — add
// Body: { usercode, fname, mi, lname, email, position, costcenter, usernumber,
//         password, role (SA|A|U), status (A|I), userlogin }
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const usercode = String(body.usercode ?? '').trim();
  const password = String(body.password ?? '');
  const status = String(body.status ?? 'A').toUpperCase();

  if (!usercode) {
    return { ok: false, statusCode: 400, message: 'User Code is required' };
  }
  if (usercode.length > 15) {
    return { ok: false, statusCode: 400, message: 'User Code must be 15 characters or less' };
  }
  if (!password) {
    return { ok: false, statusCode: 400, message: 'Password is required' };
  }
  if (!statusIsValid(status)) {
    return { ok: false, statusCode: 400, message: 'Status must be A or I' };
  }

  const { usermnt, usersupv } = toRoleFlags(body.role);

  // ── Duplicate guard ──────────────────────────────────────────────────────
  const exists = await repo.checkCodeExists(usercode);
  if (exists) {
    return {
      ok: true,
      blocked: true,
      usercode,
      message: `User "${usercode}" already exists`,
    };
  }

  await repo.insertRecord({
    usercode,
    passwordHash: md5Prefix(password),
    fname: String(body.fname ?? '').trim(),
    mi: String(body.mi ?? '').trim(),
    lname: String(body.lname ?? '').trim(),
    email: String(body.email ?? '').trim(),
    position: String(body.position ?? '').trim(),
    costcenter: String(body.costcenter ?? '').trim() || null,
    usernumber: String(body.usernumber ?? '').trim() || null,
    status,
    usermnt,
    usersupv,
    userlogin: String(body.userlogin ?? usercode).trim() || usercode,
  });

  return { ok: true, blocked: false, usercode };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /user-master — update
// Body: { usercode (immutable key), fname, mi, lname, email, position,
//         costcenter, usernumber, role (SA|A|U), status (A|I),
//         password?, userlogin }
// password is optional — when provided it resets the password hash.
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const usercode = String(body.usercode ?? '').trim();
  if (!usercode) {
    return { ok: false, statusCode: 400, message: 'User Code is required' };
  }

  const status = String(body.status ?? 'A').toUpperCase();
  if (!statusIsValid(status)) {
    return { ok: false, statusCode: 400, message: 'Status must be A or I' };
  }

  const { usermnt, usersupv } = toRoleFlags(body.role);
  const password = String(body.password ?? '');

  const affected = await repo.updateRecord({
    usercode,
    fname: String(body.fname ?? '').trim(),
    mi: String(body.mi ?? '').trim(),
    lname: String(body.lname ?? '').trim(),
    email: String(body.email ?? '').trim(),
    position: String(body.position ?? '').trim(),
    costcenter: String(body.costcenter ?? '').trim() || null,
    usernumber: String(body.usernumber ?? '').trim() || null,
    status,
    usermnt,
    usersupv,
    userlogin: String(body.userlogin ?? usercode).trim() || usercode,
    passwordHash: password ? md5Prefix(password) : null,
  });

  if (affected === 0) {
    return { ok: false, statusCode: 404, message: `User "${usercode}" not found` };
  }

  return { ok: true, usercode };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /user-master — delete (with safety guard)
// Query: { usercode, curuser } — hard deletes the T_UserMaster row.
// SAFETY GUARD: blocked when the user is the currently logged-in user, is a
// system account, or is referenced by any table.
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const usercode = String(query.usercode ?? '').trim();
  const curuser = String(query.curuser ?? '').trim();

  if (!usercode) {
    return { ok: false, statusCode: 400, message: 'User Code is required' };
  }

  if (curuser && usercode === curuser) {
    return {
      ok: true,
      blocked: true,
      usercode,
      references: [],
      message: 'You cannot delete the account you are currently logged in with.',
    };
  }

  // ── System account guard ──────────────────────────────────────────────────
  const sysRow = await repo.getSystemAccountFlag(usercode);
  if (!sysRow) {
    return { ok: false, statusCode: 404, message: `User "${usercode}" not found` };
  }
  if (sysRow.Umt_IsSystemAccount === true || sysRow.Umt_IsSystemAccount === 1) {
    return {
      ok: true,
      blocked: true,
      usercode,
      references: [],
      message: `User "${usercode}" is a system account and cannot be deleted.`,
    };
  }

  // ── Safety guard: block delete if the user is referenced anywhere ───────
  const references = await repo.findReferences(usercode);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      usercode,
      references,
      message: `User "${usercode}" cannot be deleted because it is referenced by other records.`,
    };
  }

  await repo.deleteRecord(usercode);

  return {
    ok: true,
    blocked: false,
    usercode,
    references: [],
    message: `User "${usercode}" deleted successfully.`,
  };
}
