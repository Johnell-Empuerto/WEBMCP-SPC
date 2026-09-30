import apiClient from "@/api/client"
import type {
  AddUserPayload,
  UpdateUserPayload,
  UserMasterFilter,
  UserMasterRow,
} from "../types"

// Modern endpoints for the User Master module (legacy getUsermaster24 /
// getUsermasterWithParam24 / addUsermaster24 / updateUsermaster24 /
// checkifCodeExists24). Delete with a reference safety guard is added to match
// the modern SETTINGS master pattern.

interface UserListResponse {
  status: string
  rows: UserMasterRow[]
  totalItems: number
}

// List with filters + pagination.
export async function fetchUsersMaster(
  filter: UserMasterFilter,
): Promise<{ rows: UserMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<UserListResponse>("/user-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      status: filter.status || undefined,
    },
  })
  return { rows: res.data.rows ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Check if a user code already exists.
export async function checkUserCode(
  usercode: string,
): Promise<{ exists: boolean }> {
  const res = await apiClient.get<{ status: string; exists: boolean }>("/user-master/check", {
    params: { usercode },
  })
  return { exists: Boolean(res.data.exists) }
}

// Add user.
export async function addUser(
  payload: AddUserPayload,
): Promise<{ status: "success" | "blocked" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/user-master", payload)
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    message: res.data.message,
  }
}

// Update user (password reset when password is provided).
export async function updateUser(payload: UpdateUserPayload): Promise<void> {
  await apiClient.put("/user-master", payload)
}

// Delete user with reference safety guard.
export async function deleteUser(
  usercode: string,
  curuser?: string,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>("/user-master", {
    params: { usercode, curuser },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}