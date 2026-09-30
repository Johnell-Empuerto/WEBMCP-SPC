// Service for Production Charts business/use-case logic.
// Parses and validates the year, then merges the plan + actual rows from the
// repository into the yearly analytics (byProduct / byLine / summary /
// planVsActual / linePerformance / status). All SQL lives in the repository;
// HTTP concerns live in the controller.

import * as repo from '../repositories/productionChartsRepository';

const LINE_LABELS: Record<string, string> = {
  '1': 'ADC 1',
  '2': 'ADC 2',
  '3': 'ADC 3',
  '4': 'C4',
  '5': 'KD',
};

const KNOWN_LINE_ORDER = ['ADC 1', 'ADC 2', 'ADC 3', 'C4', 'KD'];

function machineLineToLabel(machineLine: string): string {
  return LINE_LABELS[machineLine] ?? `Line ${machineLine}`;
}

export interface ChartsFilters {
  line?: unknown;
  product?: unknown;
}

export type YearlyResult =
  | { ok: true; year: number; data: any }
  | { ok: false; message: string };

// POST /production-charts/yearly — full yearly analytics for all lines.
export async function getYearly(year: unknown, filters: ChartsFilters): Promise<YearlyResult> {
  const parsedYear = Math.floor(Number(year)) || new Date().getFullYear();
  if (parsedYear < 2000 || parsedYear > 2100) {
    return { ok: false, message: 'Invalid year' };
  }

  const line = String(filters?.line ?? 'all');
  const product = String(filters?.product ?? '');

  const { planRows, actualRows } = await repo.getYearlyRows({ year: parsedYear, line, product });

  // ═════════════════════════════════════════════════════════════════════
  // Merge plan + actual in JS (same FULL OUTER JOIN semantics as PM: a
  // record from either side survives even when the other side has no match)
  // ═════════════════════════════════════════════════════════════════════
  interface ProdEntry {
    prodcode: string;
    title: string;
    plan: number;
    actual: number;
    wip: number;
    ng: number;
    fg: number;
    planLine: string;
    lineActual: Map<string, number>;
  }

  const prodAgg = new Map<string, ProdEntry>();
  const getOrCreate = (prodcode: string): ProdEntry => {
    let entry = prodAgg.get(prodcode);
    if (!entry) {
      entry = { prodcode, title: '', plan: 0, actual: 0, wip: 0, ng: 0, fg: 0, planLine: '', lineActual: new Map() };
      prodAgg.set(prodcode, entry);
    }
    return entry;
  };

  for (const row of planRows) {
    const label = String(row.line || '').trim();
    const entry = getOrCreate(String(row.prodcode || ''));
    entry.plan += Number(row.planqty) || 0;
    if (!entry.planLine && label) entry.planLine = label;
  }
  for (const row of actualRows) {
    const ml = String(row.line || '');
    const label = machineLineToLabel(ml);
    const entry = getOrCreate(String(row.prodcode || ''));
    const wip = Number(row.wip) || 0;
    const ng = Number(row.ng) || 0;
    const fg = Number(row.fg) || 0;
    entry.wip += wip;
    entry.ng += ng;
    entry.fg += fg;
    entry.actual += wip + ng + fg;
    if (row.title) entry.title = String(row.title);
    entry.lineActual.set(label, (entry.lineActual.get(label) ?? 0) + wip + ng + fg);
  }

  // ── byProduct (ranked by actual desc, dominant production line) ──────
  const byProduct = [...prodAgg.values()]
    .map((e) => {
      let dominant = e.planLine;
      let maxActual = -1;
      for (const [label, qty] of e.lineActual) {
        if (qty > maxActual) {
          maxActual = qty;
          dominant = label;
        }
      }
      const achievement = e.plan > 0 ? Number(((e.actual / e.plan) * 100).toFixed(2)) : 0;
      return {
        prodcode: e.prodcode,
        title: e.title || e.prodcode,
        line: dominant || '',
        plan: e.plan,
        actual: e.actual,
        wip: e.wip,
        ng: e.ng,
        fg: e.fg,
        achievement,
      };
    })
    .sort((a, b) => b.actual - a.actual);

  // ── byLine (all 5 known lines always present, zero-filled) ───────────
  const lineAgg = new Map<string, { plan: number; actual: number; wip: number; ng: number; fg: number }>();
  for (const e of prodAgg.values()) {
    for (const [label, qty] of e.lineActual) {
      const cur = lineAgg.get(label) ?? { plan: 0, actual: 0, wip: 0, ng: 0, fg: 0 };
      cur.actual += qty;
      lineAgg.set(label, cur);
    }
    if (e.planLine) {
      const cur = lineAgg.get(e.planLine) ?? { plan: 0, actual: 0, wip: 0, ng: 0, fg: 0 };
      cur.plan += e.plan;
      lineAgg.set(e.planLine, cur);
    }
  }
  const extraLines = [...lineAgg.keys()]
    .filter((l) => !KNOWN_LINE_ORDER.includes(l))
    .sort((a, b) => a.localeCompare(b));
  const orderedLines = [...KNOWN_LINE_ORDER, ...extraLines];

  const byLine = orderedLines.map((label) => {
    const d = lineAgg.get(label) ?? { plan: 0, actual: 0, wip: 0, ng: 0, fg: 0 };
    return {
      line: label,
      plan: d.plan,
      actual: d.actual,
      wip: d.wip,
      ng: d.ng,
      fg: d.fg,
      achievement: d.plan > 0 ? Number(((d.actual / d.plan) * 100).toFixed(2)) : 0,
      variance: d.actual - d.plan,
    };
  });

  const totalPlan = byLine.reduce((s, l) => s + l.plan, 0);
  const totalActual = byLine.reduce((s, l) => s + l.actual, 0);
  const totalWip = byLine.reduce((s, l) => s + l.wip, 0);
  const totalNg = byLine.reduce((s, l) => s + l.ng, 0);
  const totalFg = byLine.reduce((s, l) => s + l.fg, 0);

  const summary = {
    totalPlan,
    totalActual,
    achievement: totalPlan > 0 ? Number(((totalActual / totalPlan) * 100).toFixed(2)) : 0,
    variance: totalActual - totalPlan,
    wip: totalWip,
    ng: totalNg,
    fg: totalFg,
    lineCount: byLine.filter((l) => l.plan > 0 || l.actual > 0).length,
    productCount: byProduct.length,
  };

  const planVsActual = byLine.map((l) => ({
    line: l.line,
    plan: l.plan,
    actual: l.actual,
    variance: l.variance,
  }));

  const linePerformance = byLine.map((l) => ({
    line: l.line,
    actual: l.actual,
    plan: l.plan,
    achievement: l.achievement,
  }));

  const status = { wip: totalWip, ng: totalNg, fg: totalFg, total: totalActual };

  return {
    ok: true,
    year: parsedYear,
    data: {
      year: parsedYear,
      summary,
      byLine,
      byProduct,
      planVsActual,
      linePerformance,
      status,
    },
  };
}
