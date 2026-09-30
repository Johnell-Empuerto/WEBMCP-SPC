import apiClient from "@/api/client"
import type {
  AddDprMasterPayload,
  DprMasterFilter,
  DprMasterRow,
  DprMasterTab,
  UpdateDprMasterPayload,
} from "../types"

// Legacy endpoint mapping (Node-RED POST endpoints):
//   selectTeamLeader / selectGroupLeader / ... → GET  /dpr-master?tab=...
//   saveTeamLeader / saveGroupLeader / ...     → POST /dpr-master
//   updateTeamLeader / updateGroupLeader / ... → PUT  /dpr-master
// The tab name selects the legacy table (T_MasterDprTeamLeader, ...).

interface LegacyResponse<T> {
  status: string
  result: T
  totalItems?: number
  message?: string
}

// List with tab + search/status/sort + pagination (legacy select<Role>).
export async function fetchDprMasters(
  tab: DprMasterTab,
  filter: DprMasterFilter,
): Promise<{ rows: DprMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<LegacyResponse<DprMasterRow[]>>("/dpr-master", {
    params: {
      tab,
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      status: filter.status || undefined,
      sort: filter.sort || undefined,
      order: filter.order || undefined,
    },
  })
  return { rows: res.data.result ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Create a record (legacy save<Role>).
export async function addDprMaster(
  payload: AddDprMasterPayload,
): Promise<{ status: "success" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/dpr-master", payload)
  return { status: (res.data.status as "success") ?? "error", message: res.data.message }
}

// Update a record (legacy update<Role>; the backend keys on `id` when provided
// so one exact row is updated, falling back to md_Usercode for compatibility).
export async function updateDprMaster(
  payload: UpdateDprMasterPayload,
): Promise<{ status: "success" | "error"; message?: string }> {
  const res = await apiClient.put<{ status: string; message?: string }>("/dpr-master", payload)
  return { status: (res.data.status as "success") ?? "error", message: res.data.message }
}

// Delete a record with the reference safety guard (same pattern as Kanban /
// User Master): the backend returns status "blocked" when the usercode is
// still referenced by DPR data, so the row is never orphaned.
export async function deleteDprMaster(
  tab: DprMasterTab,
  id: number,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>(
    "/dpr-master",
    { params: { tab, id } },
  )
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}
