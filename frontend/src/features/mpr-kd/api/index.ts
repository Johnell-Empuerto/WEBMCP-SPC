import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type { MprKdFilter, MprKdNgRow, MprKdRow } from "../types"

// POST /mpr-kd/data — Plan vs Actual per day/shift (main table + chart).
export async function fetchMprKdData(
  filter: MprKdFilter,
  signal?: AbortSignal,
): Promise<MprKdRow[]> {
  const res = await apiClient.post<ApiResponse<MprKdRow[]>>(
    "/mpr-kd/data",
    filter,
    { signal },
  )
  return res.data.data ?? []
}

// POST /mpr-kd/ng-data — NG details rows (details table).
export async function fetchMprKdNgData(
  filter: MprKdFilter,
  signal?: AbortSignal,
): Promise<MprKdNgRow[]> {
  const res = await apiClient.post<ApiResponse<MprKdNgRow[]>>(
    "/mpr-kd/ng-data",
    filter,
    { signal },
  )
  return res.data.data ?? []
}
