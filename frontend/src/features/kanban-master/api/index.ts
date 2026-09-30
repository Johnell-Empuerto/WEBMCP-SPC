import apiClient from "@/api/client"
import type {
  AddKanbanPayload,
  KanbanMasterFilter,
  KanbanMasterLookups,
  KanbanMasterRow,
  UpdateKanbanPayload,
} from "../types"

// Legacy endpoint mapping:
//   GET /getKanbanMaster   → GET  /kanban-master
//   GET /addKanbanMaster   → POST /kanban-master
//   (dropdown lookups)     → GET  /kanban-master/lookups
//   (edit/delete added)    → PUT / DELETE /kanban-master

interface LegacyResponse<T> {
  status: string
  result: T
  totalItems?: number
}

// List with filters + pagination (legacy getKanbanMaster).
export async function fetchKanbanMasters(
  filter: KanbanMasterFilter,
): Promise<{ rows: KanbanMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<LegacyResponse<KanbanMasterRow[]>>("/kanban-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      kanban: filter.kanban || undefined,
      partno: filter.partno || undefined,
      capacity: filter.capacity || undefined,
      rem: filter.rem || undefined,
    },
  })
  return { rows: res.data.result ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Add kanban (legacy addKanbanMaster).
export async function addKanban(
  payload: AddKanbanPayload,
): Promise<{ status: "success" | "error" }> {
  const res = await apiClient.post<{ status: string }>("/kanban-master", payload)
  return { status: (res.data.status as "success") ?? "error" }
}

// Update kanban (new — legacy has no update endpoint).
export async function updateKanban(payload: UpdateKanbanPayload): Promise<void> {
  await apiClient.put("/kanban-master", payload)
}

// Delete kanban with reference safety guard (new — legacy has no delete endpoint).
export async function deleteKanban(
  kanbanid: string,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>("/kanban-master", {
    params: { kanbanid },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}

// All dropdown lookups in one call (part numbers + locators).
export async function fetchKanbanLookups(): Promise<KanbanMasterLookups> {
  const res = await apiClient.get<LegacyResponse<KanbanMasterLookups>>("/kanban-master/lookups")
  const result = res.data.result ?? ({} as KanbanMasterLookups)
  return {
    partNos: result.partNos ?? [],
    locators: result.locators ?? [],
  }
}
