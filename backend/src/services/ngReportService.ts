// Service for NG Report business/use-case logic.
// Resolves the selected period, parses the structured field filters, builds
// the filter-option dropdowns and maps raw records into the report rows + KPI
// summary. All SQL lives in the repository; HTTP concerns live in the
// controller.
//
// The five production lines and three shifts are FIXED dropdown options (the
// same machine/line and shift mapping the MPR routes use).

import * as repo from '../repositories/ngReportRepository';

const LINE_LABELS: Record<string, string> = {
  '1': 'ADC 1',
  '2': 'ADC 2',
  '3': 'ADC 3',
  '4': 'C4',
  '5': 'KD',
};

function shiftName(code: string): string {
  switch (code) {
    case 'Shift01':
      return 'Shift 1';
    case 'Shift02':
      return 'Shift 2';
    case 'Shift03':
      return 'Shift 3';
    default:
      return 'Unknown';
  }
}

// The five production lines are FIXED dropdown options (ADC 1-3, C4, KD).
const ALL_LINE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1', label: 'ADC 1' },
  { value: '2', label: 'ADC 2' },
  { value: '3', label: 'ADC 3' },
  { value: '4', label: 'C4' },
  { value: '5', label: 'KD' },
];

const STANDARD_SHIFT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Shift01', label: 'Shift 1' },
  { value: 'Shift02', label: 'Shift 2' },
  { value: 'Shift03', label: 'Shift 3' },
];

function resolveYearMonth(rawYear: unknown, rawMonth: unknown): { year: number; month: number } {
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const validYear = Number.isInteger(year) && year >= 2000 && year <= 2099;
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  return {
    year: validYear ? year : new Date().getFullYear(),
    month: validMonth ? month : new Date().getMonth() + 1,
  };
}

function lastDayOfMonth(year: number, month: number): string {
  return String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0');
}

// Parse the structured `filters` query parameter: a JSON array of
// { field, value } pairs. Only known fields are accepted (validated against
// the repository's SEARCH_FIELD_MAP); malformed input yields no filters.
function parseSearchFilters(raw: unknown): Array<{ field: string; value: string }> {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    const result: Array<{ field: string; value: string }> = [];
    for (const f of parsed) {
      const field = String(f?.field ?? '').trim();
      const value = String(f?.value ?? '').trim();
      if (field && value && repo.SEARCH_FIELD_MAP[field]) result.push({ field, value });
    }
    return result;
  } catch {
    return [];
  }
}

// GET /ng-report/options — filter dropdown options for the selected period.
export async function getOptions(rawYear: unknown, rawMonth: unknown) {
  const { year, month } = resolveYearMonth(rawYear, rawMonth);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth(year, month)}`;

  const { years, models: rawModels, statuses: rawStatuses } = await repo.getFilterOptions({ startDate, endDate });

  const lines = ALL_LINE_OPTIONS;

  const models = rawModels
    .map((r: any) => {
      const value = String(r.value ?? '').trim();
      const title = String(r.title ?? '').trim().toUpperCase();
      return { value, label: title ? `${title} (${value})` : value };
    })
    .filter((m: any) => m.value);

  const statuses = rawStatuses
    .map((r: any) => String(r.status ?? '').trim())
    .filter(Boolean);
  // Status is a small, known domain (A = Active, I = Inactive). When the
  // selected period has no NG rows the DISTINCT query returns nothing, so
  // fall back to the standard statuses instead of an empty dropdown.
  if (statuses.length === 0) statuses.push('A', 'I');

  const shifts = STANDARD_SHIFT_OPTIONS;

  return { startDate, endDate, years, lines, models, shifts, statuses };
}

export interface NgReportRecordsQuery {
  year: unknown;
  month: unknown;
  line?: unknown;
  model?: unknown;
  shift?: unknown;
  status?: unknown;
  search?: unknown;
  filters?: unknown;
  size: number;
  offset: number;
}

// GET /ng-report — paginated NG records + summary KPIs.
export async function getRecords(query: NgReportRecordsQuery) {
  const { year, month } = resolveYearMonth(query.year, query.month);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth(year, month)}`;

  const line = String(query.line ?? '').trim();
  const model = String(query.model ?? '').trim();
  const shift = String(query.shift ?? '').trim();
  const status = String(query.status ?? '').trim();
  // Free-text `search` is kept for API backward compatibility; the new UI uses
  // the structured `filters` parameter (field + value pairs) instead.
  const search = String(query.search ?? '').trim();
  const searchFilters = parseSearchFilters(query.filters);

  const result = await repo.getRecords({
    startDate,
    endDate,
    line,
    model,
    shift,
    status,
    search,
    searchFilters,
    size: query.size,
    offset: query.offset,
  });

  // Same field mapping as MPR's NG details (buildNgDetailRows). Total_NG is
  // exposed as `totalNg`; Cause / Action / Countermeasures / Down Time are not
  // stored in the MPR NG source, so they stay empty — exactly as MPR itself
  // returns them. PIC is the resolved user NAME; Travelog No. and Process come
  // from T_TravelogDefectsDetail.
  const rows = result.rows.map((r: any) => ({
    line: String(r.line ?? '').trim(),
    model: String(r.model ?? '').trim(),
    prodcode: String(r.prodcode ?? '').trim(),
    plandate: r.plandate ?? null,
    shift: String(r.shift ?? '').trim(),
    dieNo: String(r.dieNo ?? '').trim(),
    problem: String(r.problem ?? '').trim(),
    cause: '',
    action: '',
    countermeasures: '',
    pic: String(r.pic ?? '').trim(),
    travelogNo: String(r.travelogNo ?? '').trim(),
    process: String(r.process ?? '').trim(),
    downTime: '',
    status: String(r.status ?? '').trim(),
    totalNg: Number(r.totalNg) || 0,
    recordCount: Number(r.recordCount) || 0,
  }));

  return {
    startDate,
    endDate,
    searchFilterCount: searchFilters.length,
    rows,
    totalItems: result.totalItems,
    summary: {
      totalRecords: result.totalItems,
      totalNgQty: result.totalNgQty,
      topCause: result.topCause,
      mostAffectedLine: result.mostAffectedLine,
    },
  };
}
