// Service for MPR C4 business/use-case logic.
// Parses and validates the month filter, maps the selected machine to its
// production line, and applies the legacy status derivation. All SQL lives in
// the repository; HTTP concerns live in the controller.

import * as repo from '../repositories/mprC4Repository';

// C4 is a single line: Machine_Line = '4'. Kept as a map for parity with the
// legacy C4 machineMapping { 'C4': '4' }.
const MACHINE_LINE: Record<string, string> = {
  C4: '4',
};

export interface MprC4Filter {
  selectedDate?: string;
  selectedMachine?: string;
  selectedModel?: string;
}

// The controller logs the resolved filter values (same lines the old route
// printed), so the service returns them alongside the rows.
export interface MprC4Result {
  rows: any[];
  log: {
    month: string;
    startDate: string;
    endDate: string;
    machine: string;
    machineLine: string;
    product: string;
  };
}

function getLastDayOfMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

// Resolve the month to 'YYYY-MM' using the same defaulting rules as the
// legacy module: missing or malformed input falls back to the current month.
function resolveMonth(selectedDate?: string): string {
  let month = String(selectedDate ?? '');
  if (!/^\d{4}-\d{2}$/.test(month)) {
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const [year, mon] = month.split('-').map(Number);
  if (mon < 1 || mon > 12 || year < 2000 || year > 2099) {
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return month;
}

export async function getData(filter: MprC4Filter): Promise<MprC4Result> {
  const month = resolveMonth(filter.selectedDate);
  const startDate = `${month}-01`;
  const endDate = getLastDayOfMonth(month);

  const machine = typeof filter.selectedMachine === 'string' ? filter.selectedMachine.trim() : '';
  const machineLine = MACHINE_LINE[machine] ?? '4';
  const product = typeof filter.selectedModel === 'string' ? filter.selectedModel.trim() : '';

  const rows = await repo.getMprC4Data({ startDate, endDate, machineLine, product });

  // Legacy LoopDataArrangementDPDetails — the referenced columns are never
  // selected, so the result is always "Pending". Reproduced for parity.
  for (const row of rows) {
    row.status = row.Ppt_ActualQty > 0 ? 'Completed' : 'Pending';
    if (row.Ppt_PlanQty === 0) row.status = 'Not Planned';
    if (row.Ppt_PlanDate && row.Pth_ReqInputDate && new Date(row.Ppt_PlanDate) < new Date(row.Pth_ReqInputDate)) {
      row.status = 'Overdue';
    }
  }

  return {
    rows,
    log: { month, startDate, endDate, machine, machineLine, product },
  };
}

export async function getNgData(filter: MprC4Filter): Promise<MprC4Result> {
  const month = resolveMonth(filter.selectedDate);
  const startDate = `${month}-01`;
  const endDate = getLastDayOfMonth(month);

  // Legacy mapping: 'C4' → '4', else Machine_Line IN ('4'). Both end up on
  // line 4 — the repository replicates the = vs IN distinction exactly.
  const machine = typeof filter.selectedMachine === 'string' ? filter.selectedMachine.trim() : '';
  const product = typeof filter.selectedModel === 'string' ? filter.selectedModel.trim() : '';

  const rows = await repo.getMprC4NgData({ startDate, endDate, machine, product });

  return {
    rows,
    log: { month, startDate, endDate, machine, machineLine: MACHINE_LINE[machine] ?? '4', product },
  };
}
