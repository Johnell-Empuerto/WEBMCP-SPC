// Service:
// Coordinates the Logs use case. It validates the request filters, computes
// the pagination values and the log-type decision, then delegates the database
// work to the repository. It does not access SQL directly and never touches
// the HTTP request/response objects.

import * as repo from '../repositories/logsRepository';

// Machine/log-type dropdown values (the legacy Node-RED /logs `machine`
// parameter: Pcm_Color values + the special NG). The service validates the
// incoming `machine` against these and serves them from /options.
const LOG_TYPES = [
  { value: 'ADC', label: 'ADC' },
  { value: 'MACHINING', label: 'Machining' },
  { value: 'KD', label: 'KD' },
  { value: 'NG', label: 'NG (Defects)' },
] as const;

export interface LogsQuery {
  machine?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  search?: unknown;
  size?: unknown;
  pageno?: unknown;
}

export type LogsResult =
  | {
      ok: true;
      rows: any[];
      totalItems: number;
      page: number;
      size: number;
      machine: string;
    }
  | { ok: false; message: string };

// Accepts 'YYYY-MM-DD' (date input) or any parseable date string; returns a
// local-midnight Date (avoiding UTC shifts that could move the calendar date).
// Impossible calendar dates (e.g. '2025-02-31') are REJECTED (round-trip check)
// instead of being silently rolled over by the JS Date parser.
function parseDateInput(raw: unknown): Date | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    // Reject rollovers like 2025-02-31 → 2025-03-03.
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /logs — validate the filters, compute the pagination values and run the
// repository query. Validation failures return { ok: false } with the exact
// legacy error message; the controller maps those to HTTP 400.
export async function getLogs(query: LogsQuery): Promise<LogsResult> {
  const machine = String(query.machine ?? '').trim().toUpperCase();
  if (!LOG_TYPES.some((t) => t.value === machine)) {
    return {
      ok: false,
      message: `machine must be one of ${LOG_TYPES.map((t) => t.value).join(', ')}`,
    };
  }

  const dateFrom = parseDateInput(query.dateFrom);
  const dateTo = parseDateInput(query.dateTo);
  if (!dateFrom || !dateTo) {
    return { ok: false, message: 'dateFrom and dateTo are required and must be valid dates' };
  }
  if (dateFrom.getTime() > dateTo.getTime()) {
    return { ok: false, message: 'dateFrom must not be after dateTo' };
  }

  const search = String(query.search ?? '').trim();
  const size = Math.min(500, Math.max(1, Number(query.size) || 20));
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const isNg = machine === 'NG';

  const { rows, totalItems } = await repo.getLogs({
    machine,
    isNg,
    dateFrom,
    dateTo,
    search,
    offset,
    size,
  });

  return { ok: true, rows, totalItems, page: pageno, size, machine };
}

// GET /logs/options — the fixed machine/log-type dropdown.
export function getOptions() {
  return LOG_TYPES;
}