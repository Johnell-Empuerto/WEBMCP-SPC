import apiClient from "@/api/client"
import type {
  AddLocatorPayload,
  LocatorMasterFilter,
  LocatorMasterRow,
  UpdateLocatorPayload,
} from "../types"

// Legacy endpoint mapping:
//   GET /getLocatorMaster24          → GET /locator-master
//   GET /getLocatorMasterWithPara24  → GET /locator-master (with filter params)
//   GET /addLocatorMaster24          → POST /locator-master
//   GET /updateLocatorMaster24       → PUT /locator-master
//   GET /checkifCodeExists24         → GET /locator-master/check
//   (delete added)                  → DELETE /locator-master

interface LegacyResponse<T> {
  status: string
  result: T
  totalItems?: number
}

// List with filters + pagination (legacy getLocatorMaster24 / getLocatorMasterWithPara24).
export async function fetchLocators(
  filter: LocatorMasterFilter,
): Promise<{ rows: LocatorMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<LegacyResponse<LocatorMasterRow[]>>("/locator-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      type: filter.type || undefined,
      area: filter.area || undefined,
      occupancy: filter.occupancy || undefined,
      status: filter.status || undefined,
      warehouse: filter.warehouse || undefined,
    },
  })
  return { rows: res.data.result ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Check if a locator code already exists (legacy checkifCodeExists24).
export async function checkLocatorCode(
  code: string,
): Promise<{ exists: boolean }> {
  const res = await apiClient.get<{ status: string; result: number }>("/locator-master/check", {
    params: { code },
  })
  return { exists: Number(res.data.result) > 0 }
}

// Add locator (legacy addLocatorMaster24).
export async function addLocator(
  payload: AddLocatorPayload,
): Promise<{ status: "success" | "blocked" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/locator-master", payload)
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    message: res.data.message,
  }
}

// Update locator (legacy updateLocatorMaster24).
export async function updateLocator(payload: UpdateLocatorPayload): Promise<void> {
  await apiClient.put("/locator-master", payload)
}

// Delete locator with reference safety guard (new — legacy has no delete endpoint).
export async function deleteLocator(
  locatorcode: string,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>("/locator-master", {
    params: { locatorcode },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}