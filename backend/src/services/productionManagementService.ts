// Service for Production Management business/use-case logic.
// Resolves the selected date (with the legacy defaulting rules) and maps the
// repository rows into the calendar-event / product-detail / monthly-summary /
// daily-detail response shapes. All SQL lives in the repository; HTTP
// concerns live in the controller.

import * as repo from '../repositories/productionManagementRepository';

export interface PmFilters {
  line?: string;
  machine?: string;
}

// Normalize the date to 'YYYY-MM-DD' using the legacy rules: a missing or
// 'NaN-aN-aN' date defaults to the first of the current month; anything else
// is parsed and rendered in ISO date form.
function resolveQueryDate(date?: unknown): string {
  let queryDate = date;
  if (!queryDate || queryDate === 'NaN-aN-aN') {
    const now = new Date();
    queryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  } else {
    queryDate = new Date(queryDate as string).toISOString().split('T')[0];
  }
  return String(queryDate);
}

// POST /production-management/calendar-events — map each SQL row into the two
// legacy calendar events (Planned + Actual), matching
// LoopDataArrangementEvents.
export async function getCalendarEvents(date: unknown, filters: PmFilters) {
  const queryDate = resolveQueryDate(date);
  const line = filters?.line || '0';
  const machine = filters?.machine || '';

  const rows = await repo.getCalendarEvents({ date: queryDate, line, machine });

  const events: any[] = [];
  for (const row of rows) {
    // Event 1: Planned (dark background, management type, sort=0)
    events.push({
      id: `plan-${row.prodcode}-${row.plandate}-${row.ShiftName}`,
      title: `Planned: ${Number(row.planqty).toFixed(2)}`,
      remarks: String(row.product_alias || row.prodcode || ''),
      prodcode: row.prodcode,
      start: row.plandate,
      date_title: row.plandate,
      end: row.plandate,
      pqty: Number(row.planqty),
      actqty: 0,
      wip_qty: 0,
      ng_qty: 0,
      fg_qty: 0,
      backgroundColor: '#413D46',
      borderColor: '#413D46',
      textColor: '#ffffff',
      type: 'management',
      status: 'APPROVED',
      application: 'management',
      sort: 0,
      shift: row.ShiftName,
      line: row.line,
    });

    // Event 2: Actual (orange background, actual type, sort=1)
    events.push({
      id: `act-${row.prodcode}-${row.plandate}-${row.ShiftName}`,
      title: `Actual: ${Number(row.actqty).toFixed(2)}`,
      remarks: String(row.product_alias || row.prodcode || ''),
      prodcode: row.prodcode,
      start: row.plandate,
      date_title: row.plandate,
      end: row.plandate,
      pqty: Number(row.planqty),
      actqty: Number(row.actqty),
      wip_qty: Number(row.wip_qty),
      ng_qty: Number(row.ng_qty),
      fg_qty: Number(row.fg_qty),
      backgroundColor: '#f57c00',
      borderColor: '#f57c00',
      textColor: '#ffffff',
      type: 'actual',
      status: 'APPROVED',
      application: 'management',
      sort: 1,
      shift: row.ShiftName,
      line: row.line,
    });
  }

  return { events };
}

// POST /production-management/product-details — product rows plus the legacy
// trailing totals row.
export async function getProductDetails(date: unknown, filters: PmFilters) {
  const queryDate = resolveQueryDate(date);
  const line = filters?.line || '0';
  const machine = filters?.machine || '';

  const rows = await repo.getProductDetails({ date: queryDate, line, machine });

  let totplan = 0;
  let totact = 0;

  const details: any[] = rows.map((row: any) => {
    const actqty = Number(row.Total_WIP) + Number(row.Total_NG) + Number(row.Total_FG);
    totplan += Number(row.planqty);
    totact += actqty;
    return {
      remarks: row.title || '',
      prodcode: row.prodcode || '',
      pqty: Number(row.planqty) || 0,
      actqty: actqty || 0,
      wip_qty: Number(row.Total_WIP) || 0,
      ng_qty: Number(row.Total_NG) || 0,
      fg_qty: Number(row.Total_FG) || 0,
    };
  });

  // Append totals row as last element (matching legacy behavior)
  details.push({
    remarks: '',
    prodcode: '',
    pqty: 0,
    actqty: 0,
    totplan,
    totact,
  });

  return details;
}

// POST /production-management/monthly-summary — always return all 12 months
// (0 where no data) so the chart is stable.
export async function getMonthlySummary(date: unknown, filters: PmFilters) {
  const queryDate = resolveQueryDate(date);
  const line = filters?.line || '0';
  const machine = filters?.machine || '';

  const rows = await repo.getMonthlySummary({ date: queryDate, line, machine });

  const byMonth = new Map<number, any>();
  rows.forEach((row: any) => byMonth.set(Number(row.month), row));
  return Array.from({ length: 12 }, (_, i) => {
    const row = byMonth.get(i + 1);
    return {
      month: i + 1,
      planqty: row ? Number(row.planqty) || 0 : 0,
      actqty: row ? Number(row.actqty) || 0 : 0,
    };
  });
}

// POST /production-management/daily-details — shift-by-shift details for a day.
export async function getDailyDetails(date: unknown, filters: PmFilters) {
  const queryDate = resolveQueryDate(date);
  const line = filters?.line || '0';
  const machine = filters?.machine || '';

  const rows = await repo.getDailyDetails({ date: queryDate, line, machine });

  return rows.map((row: any) => ({
    shift: row.ShiftName || 'Unknown',
    prodcode: row.prodcode || '',
    remarks: row.title || '',
    pqty: Number(row.planqty) || 0,
    wip_qty: Number(row.Total_WIP) || 0,
    ng_qty: Number(row.Total_NG) || 0,
    fg_qty: Number(row.Total_FG) || 0,
  }));
}
