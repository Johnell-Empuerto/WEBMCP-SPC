export interface YearlySummary {
  totalPlan: number
  totalActual: number
  achievement: number
  variance: number
  wip: number
  ng: number
  fg: number
  lineCount: number
  productCount: number
}

export interface LineSummary {
  line: string
  plan: number
  actual: number
  wip: number
  ng: number
  fg: number
  achievement: number
  variance: number
}

export interface ProductSummary {
  prodcode: string
  title: string
  line: string
  plan: number
  actual: number
  wip: number
  ng: number
  fg: number
  achievement: number
}

export interface StatusSummary {
  wip: number
  ng: number
  fg: number
  total: number
}

export interface YearlyAnalyticsData {
  year: number
  summary: YearlySummary
  byLine: LineSummary[]
  byProduct: ProductSummary[]
  planVsActual: { line: string; plan: number; actual: number; variance: number }[]
  linePerformance: { line: string; actual: number; plan: number; achievement: number }[]
  status: StatusSummary
}

export interface ProductionChartsFilters {
  line: string // "all" | "1".."5"
  product: string
}

export interface MonthlyTrendPoint {
  month: number
  label: string
  plan: number
  actual: number
  achievement: number
}

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export const CHART_LINES = [
  { value: "all", label: "All Lines" },
  { value: "1", label: "ADC Line 1" },
  { value: "2", label: "ADC Line 2" },
  { value: "3", label: "ADC Line 3" },
  { value: "4", label: "Machining (C4) Line" },
  { value: "5", label: "Palletizing (KD) Line" },
]
