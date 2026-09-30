import * as repo from '../repositories/ngMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for NG (Defect) Master.
// Contains business/use-case logic:
//   - Reads and trims request values
//   - Validates field presence + legacy length rules + category/status values
//   - Normalizes '' → null for optional stored columns
//   - Orchestrates the duplicate check, reference guard and CRUD calls
// SQL belongs in ngMasterRepository.ts; HTTP concerns belong in
// ngMasterController.ts.
// ════════════════════════════════════════════════════════════════════════════

const CATEGORY_VALUES = ['1', '2', '3'];

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
    code: (row.Dfm_DefectCode ?? '').trim(),
    shortName: (row.Dfm_DefectShortName ?? '').trim(),
    desc: (row.Dfm_DefectDesc ?? '').trim(),
    definition1: (row.Dfm_DefectDefinition1 ?? '').trim(),
    definition2: (row.Dfm_DefectDefinition2 ?? '').trim(),
    category: (row.Dfm_DefectCategory ?? '').trim(),
    status: (row.Dfm_status ?? '').trim(),
    userLogin: (row.User_login ?? '').trim(),
    updatedAt: row.ludatetime ?? null,
  };
}

// Shared validation for add + update (add also enforces the code rules).
interface NgPayload {
  code: string;
  shortName: string;
  desc: string;
  definition1: string;
  definition2: string | null;
  status: string;
  category: string | null;
  userlogin: string;
}

function parsePayload(
  body: any,
  opts: { requireCode: boolean },
): ServiceError | { ok: true; data: NgPayload } {
  const b = body ?? {};
  const code = String(b.code ?? '').trim();
  const shortName = String(b.shortName ?? '').trim();
  const desc = String(b.desc ?? '').trim();
  const definition1 = String(b.definition1 ?? '').trim();
  const definition2 = String(b.definition2 ?? '').trim();
  const category = String(b.category ?? '').trim();
  const status = String(b.status ?? 'A').trim();
  const userlogin = String(b.userlogin ?? '').trim();

  if (opts.requireCode) {
    if (!code) {
      return { ok: false, statusCode: 400, message: 'Defect Code is required' };
    }
    if (code.length > 3) {
      return { ok: false, statusCode: 400, message: 'Defect Code must be 3 characters or less' };
    }
  } else if (!code) {
    return { ok: false, statusCode: 400, message: 'Defect Code is required' };
  }
  if (!shortName) {
    return { ok: false, statusCode: 400, message: 'Short Name is required' };
  }
  if (shortName.length > 5) {
    return { ok: false, statusCode: 400, message: 'Short Name must be 5 characters or less' };
  }
  if (!desc) {
    return { ok: false, statusCode: 400, message: 'Description is required' };
  }
  if (desc.length > 30) {
    return { ok: false, statusCode: 400, message: 'Description must be 30 characters or less' };
  }
  if (definition1.length > 50) {
    return { ok: false, statusCode: 400, message: 'Definition 1 must be 50 characters or less' };
  }
  if (definition2.length > 50) {
    return { ok: false, statusCode: 400, message: 'Definition 2 must be 50 characters or less' };
  }
  if (category && !CATEGORY_VALUES.includes(category)) {
    return { ok: false, statusCode: 400, message: 'Invalid category' };
  }
  if (!['A', 'I'].includes(status)) {
    return { ok: false, statusCode: 400, message: 'Status must be Active or Inactive' };
  }

  return {
    ok: true,
    data: {
      code,
      shortName,
      desc,
      definition1,
      definition2: definition2 === '' ? null : definition2,
      category: category === '' ? null : category,
      status,
      userlogin,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /ng-master — list (filters + pagination)
// Query: { size, pageno, search, category, status }
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(query: any): Promise<ListResult> {
  const size = Math.max(1, Number(query.size) || 10);
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const search = String(query.search ?? '').trim();
  const category = String(query.category ?? '').trim();
  const status = String(query.status ?? '').trim();

  const { rows, totalItems } = await repo.listRecords({ size, offset, search, category, status });

  const records = rows.map(mapRow);
  return { ok: true, rows: records, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /ng-master/check — duplicate defect code check
// ════════════════════════════════════════════════════════════════════════════
export async function checkCode(query: any): Promise<CheckResult> {
  const code = String(query.code ?? '').trim();
  if (!code) {
    return { ok: false, statusCode: 400, message: 'Defect Code is required' };
  }

  const exists = await repo.checkCodeExists(code);
  return { ok: true, exists };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /ng-master — add
// Body: { code, shortName, desc, definition1, definition2, category, status,
//         userlogin }
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const payloadResult = parsePayload(body, { requireCode: true });
  if (!payloadResult.ok) return payloadResult;

  // ── Duplicate guard (legacy checkifCodeExists24) ─────────────────────────
  const exists = await repo.checkCodeExists(payloadResult.data.code);
  if (exists) {
    return {
      ok: true,
      blocked: true,
      code: payloadResult.data.code,
      message: `Defect "${payloadResult.data.code}" already exists`,
    };
  }

  await repo.insertRecord(payloadResult.data);
  return { ok: true, blocked: false, code: payloadResult.data.code };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /ng-master — update
// Body: { code (immutable key), shortName, desc, definition1, definition2,
//         category, status, userlogin }
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const payloadResult = parsePayload(body, { requireCode: false });
  if (!payloadResult.ok) return payloadResult;

  const affected = await repo.updateRecord(payloadResult.data);

  if (affected === 0) {
    return {
      ok: false,
      statusCode: 404,
      message: `Defect "${payloadResult.data.code}" not found`,
    };
  }

  return { ok: true, code: payloadResult.data.code };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /ng-master — delete (with reference safety guard)
// Query: { code } — hard deletes the T_DefectMaster row.
// SAFETY GUARD: if any table still references the code, the delete is
// blocked ({ status: 'blocked', references }).
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const code = String(query.code ?? '').trim();
  if (!code) {
    return { ok: false, statusCode: 400, message: 'Defect Code is required' };
  }

  // ── Safety guard: block delete if the code is referenced anywhere ────────
  const references = await repo.findReferences(code);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      code,
      references,
      message: `Defect "${code}" cannot be deleted because it is referenced by other records.`,
    };
  }

  const affected = await repo.deleteRecord(code);
  if (affected === 0) {
    return { ok: false, statusCode: 404, message: `Defect "${code}" not found` };
  }

  return {
    ok: true,
    blocked: false,
    code,
    references: [],
    message: `Defect "${code}" deleted successfully.`,
  };
}
