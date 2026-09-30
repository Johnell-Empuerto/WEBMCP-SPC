import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type { MprAdcFilter, MprAdcNgRow, MprAdcRow } from "../types"

// POST /mpr-adc/data — Plan vs Actual per day/shift (main table + chart).
export async function fetchMprAdcData(
  filter: MprAdcFilter,
  signal?: AbortSignal,
): Promise<MprAdcRow[]> {
  const res = await apiClient.post<ApiResponse<MprAdcRow[]>>(
    "/mpr-adc/data",
    filter,
    { signal },
  )
  return res.data.data ?? []
}

// POST /mpr-adc/ng-data — NG details rows (details table).
export async function fetchMprAdcNgData(
  filter: MprAdcFilter,
  signal?: AbortSignal,
): Promise<MprAdcNgRow[]> {
  const res = await apiClient.post<ApiResponse<MprAdcNgRow[]>>(
    "/mpr-adc/ng-data",
    filter,
    { signal },
  )
  return res.data.data ?? []
}
