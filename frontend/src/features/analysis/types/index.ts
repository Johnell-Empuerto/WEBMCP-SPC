export interface MachineInfo {
  machineCode: string
  machineDesc: string
}

export interface MonthlyMachineChart {
  machineName: string
  monthYear: string
  dayno: number[]
  travelSheetCount: number[]
  fg: number[]
  total: number[]
  ng: number[]
  maxTravelSheet: number
  greatestTotal: number
  overallTravelSheetCount: number
}

export interface MachineSummaryRow {
  machineName: string
  machineDesc: string
  travelSheetCount: number
  totalOKQty: number
  totalNGQty: number
  totalOutputQty: number
}

export interface DashboardSummary {
  totalTravelSheets: number
  totalFG: number
  totalProduction: number
  totalNG: number
  machineCount: number
}

export interface PlanVsActualRow {
  title: string
  prodcode: string
  plandate: string
  planqty: number
  totalWIP: number
  totalNG: number
  totalFG: number
  dieNo: string
  shiftName: string
}

export interface NGSummaryRow {
  title: string
  prodcode: string
  plandate: string
  totalNG: number
  dieNo: string
  shiftName: string
  defectDesc: string
  defectStatus: string
}

export interface ProductionTrendPoint {
  date: string
  totalQty: number
  totalFG: number
  totalNG: number
}

export interface AnalysisFilters {
  selmonth: number
  selyears: number
  machine: string
  chartType: "simple" | "adv"
}
