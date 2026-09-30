// Service for MPR ADC business/use-case logic.
// Parses and validates the month filter, maps the selected machine to its
// production line, and applies the legacy status derivation. All SQL lives in
// the repository; HTTP concerns live in the controller.

import * as repo from '../repositories/mprAdcRepository';

// Machine display name → Machine_Line value (same whitelist as the legacy
// MPR ADC machine mapping). Anything else means "all ADC lines".
const MACHINE_LINE: Record<string, string> = {
  'ADC 1': '1',
  'ADC 2': '2',
  'ADC 3': '3',
};

export interface MprAdcFilter {
  selectedDate?: string;
  selectedMachine?: string;
  selectedModel?: string;
}

// The controller logs the resolved filter values (same lines the old route
// printed), so the service returns them alongside the rows.
export interface MprAdcResult {
  rows: any[];
  log: {
    month: string;
    startDate: string;
    endDate: string;
    machine: string;
    machineLine?: string;
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

export async function getData(filter: MprAdcFilter): Promise<MprAdcResult> {
  const month = resolveMonth(filter.selectedDate);
  const startDate = `${month}-01`;
  const endDate = getLastDayOfMonth(month);

  const machine = typeof filter.selectedMachine === 'string' ? filter.selectedMachine.trim() : '';
  const machineLine = MACHINE_LINE[machine];
  const product = typeof filter.selectedModel === 'string' ? filter.selectedModel.trim() : '';

  const rows = await repo.getMprData({ startDate, endDate, machineLine, product });

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

export async function getNgData(filter: MprAdcFilter): Promise<MprAdcResult> {
  const month = resolveMonth(filter.selectedDate);
  const startDate = `${month}-01`;
  const endDate = getLastDayOfMonth(month);

  const machine = typeof filter.selectedMachine === 'string' ? filter.selectedMachine.trim() : '';
  const machineLine = MACHINE_LINE[machine];
  const product = typeof filter.selectedModel === 'string' ? filter.selectedModel.trim() : '';

  const rows = await repo.getMprNgData({ startDate, endDate, machineLine, product });

  return {
    rows,
    log: { month, startDate, endDate, machine, machineLine, product },
  };
}
