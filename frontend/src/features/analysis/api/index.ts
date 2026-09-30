import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type {
  MachineInfo,
  MonthlyMachineChart,
  MachineSummaryRow,
  DashboardSummary,
  PlanVsActualRow,
  NGSummaryRow,
  ProductionTrendPoint,
} from "../types"

export async function fetchMachineList(): Promise<MachineInfo[]> {
  const res = await apiClient.get<ApiResponse<MachineInfo[]>>("/analysis/machines")
  return res.data.data ?? []
}

export async function fetchMonthlyCharts(
  selmonth: number,
  selyears: number,
  machine?: string
): Promise<MonthlyMachineChart[]> {
  const params: Record<string, string | number> = { selmonth, selyears }
  if (machine) params.machine = machine
  const res = await apiClient.get<ApiResponse<MonthlyMachineChart[]>>("/analysis/monthly-charts", { params })
  return res.data.data ?? []
}

export async function fetchAnalysisTotals(): Promise<MachineSummaryRow[]> {
  const res = await apiClient.get<ApiResponse<MachineSummaryRow[]>>("/analysis/totals")
  return res.data.data ?? []
}

export async function fetchAnalysisSummary(): Promise<DashboardSummary> {
  const res = await apiClient.get<ApiResponse<DashboardSummary>>("/analysis/summary")
  return res.data.data ?? { totalTravelSheets: 0, totalFG: 0, totalProduction: 0, totalNG: 0, machineCount: 0 }
}

export async function fetchProductionTrend(days = 30): Promise<ProductionTrendPoint[]> {
  const res = await apiClient.get<ApiResponse<{ days: number; data: ProductionTrendPoint[] }>>(
    "/analysis/production-trend",
    { params: { days } }
  )
  return res.data.data?.data ?? []
}

export async function fetchPlanVsActual(
  startDate: string,
  endDate: string,
  machine?: string
): Promise<PlanVsActualRow[]> {
  const params: Record<string, string> = { startDate, endDate }
  if (machine) params.machine = machine
  const res = await apiClient.get<ApiResponse<PlanVsActualRow[]>>("/analysis/plan-vs-actual", { params })
  return res.data.data ?? []
}

export async function fetchNGSummary(
  startDate: string,
  endDate: string,
  machine?: string
): Promise<NGSummaryRow[]> {
  const params: Record<string, string> = { startDate, endDate }
  if (machine) params.machine = machine
  const res = await apiClient.get<ApiResponse<NGSummaryRow[]>>("/analysis/ng-summary", { params })
  return res.data.data ?? []
}
