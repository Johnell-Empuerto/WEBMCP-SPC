import * as repo from '../repositories/dprMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for DPR Master.
// Contains business/use-case logic:
//   - Validates the tab against the whitelist
//   - Validates the create/update payload
//   - Applies legacy filtering semantics (hide inactive by default)
//   - Orchestrates the duplicate guard, reference guard and CRUD calls
// SQL belongs in dprMasterRepository.ts; HTTP concerns belong in
// dprMasterController.ts.
// ════════════════════════════════════════════════════════════════════════════

const TAB_LABELS: Record<string, string> = {
  'team-leader': 'Team Leader',
  'group-leader': 'Group Leader',
  leadman: 'Leadman',
  inspector: 'Inspector',
  'line-checker': 'Line Checker',
};

type ServiceError = { ok: false; statusCode: number; message: string };

function tabLabel(tab: string): string {
  return TAB_LABELS[tab] ?? tab;
}

// ── Tab resolution ───────────────────────────────────────────────────────────
// Returns a ServiceError (HTTP 400) or a valid (tab, table) pair.
function getTab(rawTab: string): ServiceError | { ok: true; tab: string; table: string } {
  const tab = String(rawTab ?? '').trim();
  const table = repo.TABLES[tab];
  if (!table) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid tab. Expected one of: team-leader, group-leader, leadman, inspector, line-checker',
    };
  }
  return { ok: true, tab, table };
}

// ── Shared payload validation (create + update) ─────────────────────────────
interface DprPayload {
  md_Usercode: number;
  md_firstname: string;
  md_lastname: string;
  md_position: string;
  md_status: string;
}

function parsePayload(body: any): ServiceError | { ok: true; data: DprPayload } {
  // Reject empty/whitespace usercode explicitly — Number("") would otherwise
  // coerce to 0 and pass the integer check below.
  const rawUsercode = String(body?.md_Usercode ?? '').trim();
  if (rawUsercode === '') {
    return {
      ok: false,
      statusCode: 400,
      message: 'User Code is required and must be a non-negative number',
    };
  }
  const usercode = Number(rawUsercode);
  const md_firstname = String(body?.md_firstname ?? '').trim();
  const md_lastname = String(body?.md_lastname ?? '').trim();
  const md_position = String(body?.md_position ?? '').trim();
  const md_status = String(body?.md_status ?? '').trim();

  if (!Number.isInteger(usercode) || usercode < 0) {
    return {
      ok: false,
      statusCode: 400,
      message: 'User Code is required and must be a non-negative number',
    };
  }
  if (!md_firstname) {
    return { ok: false, statusCode: 400, message: 'First Name is required' };
  }
  if (!md_lastname) {
    return { ok: false, statusCode: 400, message: 'Last Name is required' };
  }
  if (!md_position) {
    return { ok: false, statusCode: 400, message: 'Position is required' };
  }
  if (md_status !== 'A' && md_status !== 'I') {
    return { ok: false, statusCode: 400, message: 'Status must be A (Active) or I (Inactive)' };
  }
  return { ok: true, data: { md_Usercode: usercode, md_firstname, md_lastname, md_position, md_status } };
}

// Discriminated union result types: the controller narrows on `ok` (and
// `blocked` for deletes) to build the exact legacy HTTP response.
type ListResult =
  | ServiceError
  | { ok: true; tab: string; result: Array<Record<string, any>>; totalItems: number };

type CreateResult =
  | ServiceError
  | {
      ok: true;
      tabLabel: string;
      result: {
        tab: string;
        md_Usercode: number;
        md_firstname: string;
        md_lastname: string;
        md_position: string;
        md_status: string;
      };
      message: string;
    };

type UpdateResult =
  | ServiceError
  | { ok: true; tabLabel: string; key: string; message: string };

type DeleteResult =
  | ServiceError
  | { ok: true; blocked: true; tabLabel: string; usercode: string; references: string[]; message: string }
  | { ok: true; blocked: false; tabLabel: string; rowId: number; message: string };


// ════════════════════════════════════════════════════════════════════════════
// GET /dpr-master — list (tab + search + status filter + sort + pagination)
// Query: { tab, search?, status?, sort?, order?, size?, pageno? }
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(rawTab: string, query: any): Promise<ListResult> {
  const tabResult = getTab(rawTab);
  if (!tabResult.ok) return tabResult;

  const size = Math.max(1, Math.min(100, Number(query.size) || 10));
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const search = String(query.search ?? '').trim();
  const status = String(query.status ?? '').trim();
  const sort = String(query.sort ?? '').trim();
  const order = String(query.order ?? '').trim();

  const { rows, totalItems } = await repo.listRecords(tabResult.table, {
    size,
    offset,
    status,
    search,
    sort,
    order,
  });

  // Preserve the exact result row shape the frontend depends on.
  const result = rows.map((row: any) => ({
    id: row.id,
    md_Usercode: row.md_Usercode,
    md_firstname: row.md_firstname,
    md_lastname: row.md_lastname,
    md_position: row.md_position,
    md_status: row.md_status,
  }));

  return { ok: true, tab: tabResult.tab, result, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /dpr-master — create (INSERT)
// Body: { tab, md_Usercode, md_firstname, md_lastname, md_position, md_status }
// Replicates legacy save<Role> endpoints. Adds a duplicate-key guard.
// ════════════════════════════════════════════════════════════════════════════
export async function createRecord(rawTab: string, body: any): Promise<CreateResult> {
  const tabResult = getTab(rawTab);
  if (!tabResult.ok) return tabResult;

  const payloadResult = parsePayload(body);
  if (!payloadResult.ok) return payloadResult;
  const { md_Usercode, md_firstname, md_lastname, md_position, md_status } = payloadResult.data;

  // ── Duplicate guard (safety addition; legacy silently inserted dupes) ──
  const dupCount = await repo.countByUsercode(tabResult.table, md_Usercode);
  if (dupCount > 0) {
    return {
      ok: false,
      statusCode: 409,
      message: `User code ${md_Usercode} already exists in the ${tabLabel(tabResult.tab)} master.`,
    } as ServiceError;
  }

  await repo.insertRecord(tabResult.table, payloadResult.data);

  return {
    ok: true,
    tabLabel: tabLabel(tabResult.tab),
    result: { tab: tabResult.tab, md_Usercode, md_firstname, md_lastname, md_position, md_status },
    message: `${tabLabel(tabResult.tab)} record saved successfully.`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /dpr-master — update
// Body: { tab, id?, md_Usercode, md_firstname, md_lastname, md_position, md_status }
// Keying: when `id` is supplied the UPDATE targets exactly that row
// (WHERE id = @id). Without `id` we fall back to the legacy md_Usercode key
// for backward compatibility.
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(rawTab: string, body: any): Promise<UpdateResult> {
  const tabResult = getTab(rawTab);
  if (!tabResult.ok) return tabResult;

  const payloadResult = parsePayload(body);
  if (!payloadResult.ok) return payloadResult;

  const rawId = String(body?.id ?? '').trim();
  const hasId = rawId !== '' && Number.isInteger(Number(rawId));
  const rowId = hasId ? Number(rawId) : null;

  const affected = await repo.updateRecord(tabResult.table, payloadResult.data, rowId);

  if (affected === 0) {
    return {
      ok: false,
      statusCode: 404,
      message: rowId !== null
        ? `No ${tabLabel(tabResult.tab)} record found with id ${rowId}.`
        : `No ${tabLabel(tabResult.tab)} record found with user code ${payloadResult.data.md_Usercode}.`,
    } as ServiceError;
  }

  return {
    ok: true,
    tabLabel: tabLabel(tabResult.tab),
    key: rowId !== null ? `id ${rowId}` : `usercode ${payloadResult.data.md_Usercode}`,
    message: `${tabLabel(tabResult.tab)} record updated successfully.`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /dpr-master — delete (with reference safety guard)
// Query: { tab, id } — hard deletes the row keyed on its `id`.
// SAFETY GUARD: if any DPR data table still references the user code, the
// delete is blocked ({ status: 'blocked', references: [...] }).
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(rawTab: string, query: any): Promise<DeleteResult> {
  const tabResult = getTab(rawTab);
  if (!tabResult.ok) return tabResult;

  const rawId = String(query.id ?? '').trim();
  const rowId = Number(rawId);
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return { ok: false, statusCode: 400, message: 'A valid record id is required' };
  }

  // ── Resolve the row to its md_Usercode (for the reference check) ────────
  const row = await repo.findById(tabResult.table, rowId);
  if (!row) {
    return {
      ok: false,
      statusCode: 404,
      message: `No ${tabLabel(tabResult.tab)} record found with id ${rowId}.`,
    };
  }
  const usercode = String(row.md_Usercode);

  // ── Safety guard: block delete if the usercode is referenced in DPR data ──
  const references = await repo.findReferences(tabResult.tab, usercode);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      tabLabel: tabLabel(tabResult.tab),
      usercode,
      references,
      message: `User code ${usercode} cannot be deleted because it is referenced by existing DPR records.`,
    };
  }

  await repo.deleteRecord(tabResult.table, rowId);

  return {
    ok: true,
    blocked: false,
    tabLabel: tabLabel(tabResult.tab),
    rowId,
    message: `${tabLabel(tabResult.tab)} record deleted successfully.`,
  };
}
