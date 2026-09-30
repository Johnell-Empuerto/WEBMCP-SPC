import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type { MonthlyTrendPoint, YearlyAnalyticsData } from "../types"
import { MONTH_LABELS } from "../types"

export async function fetchYearlyAnalytics(
  year: number,
  filters: { line: string; product: string },
  signal?: AbortSignal,
): Promise<YearlyAnalyticsData> {
  const res = await apiClient.post<ApiResponse<YearlyAnalyticsData>>(
    "/production-charts/yearly",
    { year, filters },
    { signal },
  )
  return res.data.data ?? {
    year,
    summary: {
      totalPlan: 0,
      totalActual: 0,
      achievement: 0,
      variance: 0,
      wip: 0,
      ng: 0,
      fg: 0,
      lineCount: 0,
      productCount: 0,
    },
    byLine: [],
    byProduct: [],
    planVsActual: [],
    linePerformance: [],
    status: { wip: 0, ng: 0, fg: 0, total: 0 },
  }
}

interface MonthlySummaryRow {
  month: number
  planqty: number
  actqty: number
}

/**
 * Fetches the 12-month (Jan..Dec) Planned vs Actual trend for a year.
 *
 * Reuses the existing /production-management/monthly-summary endpoint — no
 * backend changes. Note that endpoint's line filter treats "0" as ADC lines
 * 1–3 only, so "All Lines" (ADC 1–3 + C4 + KD) requires summing the line
 * groups: 0 (ADC), 4 (C4) and 5 (KD).
 */
export async function fetchMonthlyTrend(
  year: number,
  line: string,
  product: string,
  signal?: AbortSignal,
): Promise<MonthlyTrendPoint[]> {
  const date = `${year}-01-01`
  const groups = line === "all" ? ["0", "4", "5"] : [line]

  const results = await Promise.all(
    groups.map(async (lineKey) => {
      const res = await apiClient.post<ApiResponse<MonthlySummaryRow[]>>(
        "/production-management/monthly-summary",
        { date, filters: { line: lineKey, machine: product } },
        { signal },
      )
      return res.data.data ?? []
    }),
  )

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    let plan = 0
    let actual = 0
    for (const rows of results) {
      const row = rows.find((r) => Number(r.month) === month)
      if (row) {
        plan += Number(row.planqty) || 0
        actual += Number(row.actqty) || 0
      }
    }
    return {
      month,
      label: MONTH_LABELS[i],
      plan,
      actual,
      achievement: plan > 0 ? Number(((actual / plan) * 100).toFixed(1)) : 0,
    }
  })
}
