import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type { MprC4Filter, MprC4NgRow, MprC4Row } from "../types"

// POST /mpr-c4/data — Plan vs Actual per day/shift (main table + chart).
export async function fetchMprC4Data(
  filter: MprC4Filter,
  signal?: AbortSignal,
): Promise<MprC4Row[]> {
  const res = await apiClient.post<ApiResponse<MprC4Row[]>>(
    "/mpr-c4/data",
    filter,
    { signal },
  )
  return res.data.data ?? []
}

// POST /mpr-c4/ng-data — NG details rows (details table).
export async function fetchMprC4NgData(
  filter: MprC4Filter,
  signal?: AbortSignal,
): Promise<MprC4NgRow[]> {
  const res = await apiClient.post<ApiResponse<MprC4NgRow[]>>(
    "/mpr-c4/ng-data",
    filter,
    { signal },
  )
  return res.data.data ?? []
}
