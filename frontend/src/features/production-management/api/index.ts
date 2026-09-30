import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type {
  ProductDetail,
  DailyProductionDetail,
  ProductionFilters,
  CalendarEvent,
  MonthlySummary,
} from "../types"

export async function fetchProductDetails(
  date: string,
  filters: ProductionFilters,
): Promise<ProductDetail[]> {
  const res = await apiClient.post<ApiResponse<ProductDetail[]>>(
    "/production-management/product-details",
    { date, filters },
  )
  return res.data.data ?? []
}

export async function fetchDailyProductionDetails(
  date: string,
  filters: ProductionFilters,
): Promise<DailyProductionDetail[]> {
  const res = await apiClient.post<ApiResponse<DailyProductionDetail[]>>(
    "/production-management/daily-details",
    { date, filters },
  )
  return res.data.data ?? []
}

export async function fetchCalendarEvents(
  date: string,
  filters: ProductionFilters,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const res = await apiClient.post<ApiResponse<{ events: CalendarEvent[] }>>(
    "/production-management/calendar-events",
    { date, filters },
    { signal },
  )
  return res.data.data?.events ?? []
}

export async function fetchMonthlySummary(
  date: string,
  filters: ProductionFilters,
): Promise<MonthlySummary[]> {
  const res = await apiClient.post<ApiResponse<MonthlySummary[]>>(
    "/production-management/monthly-summary",
    { date, filters },
  )
  return res.data.data ?? []
}
