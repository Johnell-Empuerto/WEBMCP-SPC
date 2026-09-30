import apiClient from "@/api/client"
import type {
  AddPalletPayload,
  PalletMasterFilter,
  PalletMasterRow,
  UpdatePalletPayload,
} from "../types"

// Legacy endpoint mapping:
//   GET /getPalletMaster24        → GET /pallet-master
//   GET /getPalletMasterWithPara24→ GET /pallet-master (with filter params)
//   GET /addPalletMaster24        → POST /pallet-master
//   GET /updatePalletMaster24     → PUT /pallet-master
//   GET /checkifCodeExists24      → GET /pallet-master/check
//   (delete added)               → DELETE /pallet-master

interface LegacyResponse<T> {
  status: string
  result: T
  totalItems?: number
}

// List with filters + pagination (legacy getPalletMaster24 / getPalletMasterWithPara24).
export async function fetchPallets(
  filter: PalletMasterFilter,
): Promise<{ rows: PalletMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<LegacyResponse<PalletMasterRow[]>>("/pallet-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      category: filter.category || undefined,
      status: filter.status || undefined,
    },
  })
  return { rows: res.data.result ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Check if a pallet code already exists (legacy checkifCodeExists24).
export async function checkPalletCode(
  code: string,
): Promise<{ exists: boolean }> {
  const res = await apiClient.get<{ status: string; result: number }>("/pallet-master/check", {
    params: { code },
  })
  return { exists: Number(res.data.result) > 0 }
}

// Add pallet (legacy addPalletMaster24).
export async function addPallet(
  payload: AddPalletPayload,
): Promise<{ status: "success" | "blocked" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/pallet-master", payload)
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    message: res.data.message,
  }
}

// Update pallet (legacy updatePalletMaster24).
export async function updatePallet(payload: UpdatePalletPayload): Promise<void> {
  await apiClient.put("/pallet-master", payload)
}

// Delete pallet with reference safety guard (new — legacy has no delete endpoint).
export async function deletePallet(
  palletcode: string,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>("/pallet-master", {
    params: { palletcode },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}