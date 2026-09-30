import apiClient from "@/api/client"
import type {
  AddShiftPayload,
  ShiftMasterFilter,
  ShiftMasterRow,
  UpdateShiftPayload,
} from "../types"

// Modern endpoints for the Shift Master module (legacy getShiftMaster /
// addShiftMaster / updateShiftMaster / deleteShiftMaster / checkifCodeExists24).

interface ShiftListResponse {
  status: string
  rows: ShiftMasterRow[]
  totalItems: number
}

// List with filters + pagination.
export async function fetchShiftsMaster(
  filter: ShiftMasterFilter,
): Promise<{ rows: ShiftMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<ShiftListResponse>("/shift-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      status: filter.status || undefined,
    },
  })
  return { rows: res.data.rows ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Check if a shift code already exists.
export async function checkShiftCode(
  code: string,
): Promise<{ exists: boolean }> {
  const res = await apiClient.get<{ status: string; exists: boolean }>("/shift-master/check", {
    params: { code },
  })
  return { exists: Boolean(res.data.exists) }
}

// Add shift.
export async function addShift(
  payload: AddShiftPayload,
): Promise<{ status: "success" | "blocked" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/shift-master", payload)
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    message: res.data.message,
  }
}

// Update shift.
export async function updateShift(payload: UpdateShiftPayload): Promise<void> {
  await apiClient.put("/shift-master", payload)
}

// Delete shift with reference safety guard.
export async function deleteShift(
  code: string,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>("/shift-master", {
    params: { code },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}