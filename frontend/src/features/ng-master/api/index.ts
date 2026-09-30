import apiClient from "@/api/client"
import type {
  AddNgPayload,
  NgMasterFilter,
  NgMasterRow,
  UpdateNgPayload,
} from "../types"

// Modern endpoints for the NG Master module (legacy getNgMaster / addNgMaster /
// updateNgMaster / deleteNgMaster / checkifCodeExists24).

interface NgListResponse {
  status: string
  rows: NgMasterRow[]
  totalItems: number
}

// List with filters + pagination.
export async function fetchNgMaster(
  filter: NgMasterFilter,
): Promise<{ rows: NgMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<NgListResponse>("/ng-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      category: filter.category || undefined,
      status: filter.status || undefined,
    },
  })
  return { rows: res.data.rows ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Check if a defect code already exists.
export async function checkNgCode(
  code: string,
): Promise<{ exists: boolean }> {
  const res = await apiClient.get<{ status: string; exists: boolean }>("/ng-master/check", {
    params: { code },
  })
  return { exists: Boolean(res.data.exists) }
}

// Add defect.
export async function addNg(
  payload: AddNgPayload,
): Promise<{ status: "success" | "blocked" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/ng-master", payload)
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    message: res.data.message,
  }
}

// Update defect.
export async function updateNg(payload: UpdateNgPayload): Promise<void> {
  await apiClient.put("/ng-master", payload)
}

// Delete defect with reference safety guard.
export async function deleteNg(
  code: string,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>("/ng-master", {
    params: { code },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}