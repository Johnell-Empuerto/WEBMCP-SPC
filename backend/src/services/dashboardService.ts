import * as dashboardRepo from '../repositories/dashboardRepository';
import type {
  MachineInfo,
  MonthlyMachineChart,
  MachineSummaryRow,
  DashboardSummary,
  PlanVsActualRow,
  NGSummaryRow,
  ProductionTrendPoint,
} from '../types/dashboard';

export async function getMachineList(): Promise<MachineInfo[]> {
  return dashboardRepo.getMachineList();
}

export async function getMonthlyCharts(
  selmonth: number,
  selyears: number,
  machine?: string
): Promise<MonthlyMachineChart[]> {
  const rows = await dashboardRepo.getMonthlyReportPerMachine(selmonth, selyears, machine);

  const machineMap = new Map<string, MonthlyMachineChart>();

  for (const row of rows) {
    if (!machineMap.has(row.machineLine)) {
      machineMap.set(row.machineLine, {
        machineName: row.machineName,
        monthYear: row.monthYear,
        dayno: [],
        travelSheetCount: [],
        fg: [],
        total: [],
        ng: [],
        maxTravelSheet: row.maxTravelSheet,
        greatestTotal: row.greatestTotal,
        overallTravelSheetCount: row.overallTravelSheetCount,
      });
    }

    const chart = machineMap.get(row.machineLine)!;
    chart.dayno.push(row.dayNo);
    chart.travelSheetCount.push(row.travelSheetCount);
    chart.total.push(row.total);
    chart.ng.push(row.ng);
    chart.fg.push(row.fg);
  }

  return Array.from(machineMap.values());
}

export async function getDashboardTotals(): Promise<MachineSummaryRow[]> {
  return dashboardRepo.getDashboardTotals();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return dashboardRepo.getDashboardSummary();
}

export async function getProductionTrend(days: number = 30): Promise<ProductionTrendPoint[]> {
  return dashboardRepo.getProductionTrend(days);
}

export async function getPlanVsActual(
  startDate: string,
  endDate: string,
  machine?: string
): Promise<PlanVsActualRow[]> {
  return dashboardRepo.getPlanVsActual(startDate, endDate, machine);
}

export async function getNGSummary(
  startDate: string,
  endDate: string,
  machine?: string
): Promise<NGSummaryRow[]> {
  return dashboardRepo.getNGSummary(startDate, endDate, machine);
}

export async function getDailyProduction(
  date: string,
  machine?: string
): Promise<any[]> {
  return dashboardRepo.getDailyProduction(date, machine);
}
