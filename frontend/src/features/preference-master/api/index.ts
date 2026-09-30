import apiClient from "@/api/client"
import type {
  AddPreferencePayload,
  PreferenceMasterFilter,
  PreferenceMasterRow,
  UpdatePreferencePayload,
} from "../types"

// Modern endpoints for the Preference Master module (legacy
// getParameterMaster24 / getParameterMasterWithPara24 / addParameterMaster24 /
// updateParameterMaster24 / deleteParameterMaster24 / checkifCodeExists24).

interface PreferenceListResponse {
  status: string
  rows: PreferenceMasterRow[]
  totalItems: number
}

// List with filters + pagination.
export async function fetchPreferences(
  filter: PreferenceMasterFilter,
): Promise<{ rows: PreferenceMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<PreferenceListResponse>("/preference-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      group: filter.group || undefined,
    },
  })
  return { rows: res.data.rows ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Distinct parameter groups for the filter dropdown.
export async function fetchPreferenceGroups(): Promise<string[]> {
  const res = await apiClient.get<{ status: string; groups: string[] }>("/preference-master/groups")
  return res.data.groups ?? []
}

// Check if a (group, seq) pair already exists.
export async function checkPreference(
  parameterid: string,
  seq: number,
): Promise<{ exists: boolean }> {
  const res = await apiClient.get<{ status: string; exists: boolean }>("/preference-master/check", {
    params: { parameterid, seq },
  })
  return { exists: Boolean(res.data.exists) }
}

// Add preference.
export async function addPreference(
  payload: AddPreferencePayload,
): Promise<{ status: "success" | "blocked" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/preference-master", payload)
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    message: res.data.message,
  }
}

// Update preference.
export async function updatePreference(payload: UpdatePreferencePayload): Promise<void> {
  await apiClient.put("/preference-master", payload)
}

// Delete preference.
export async function deletePreference(
  parameterid: string,
  seq: number,
): Promise<{ status: "success" | "blocked" | "error"; message?: string }> {
  const res = await apiClient.delete<{ status: string; message?: string }>("/preference-master", {
    params: { parameterid, seq },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    message: res.data.message,
  }
}