import apiClient from "@/api/client"
import type { ApiResponse, PaginatedData } from "@/types"
import type { UserItem } from "../types"

export async function fetchUsers(
  page: number,
  size: number,
  search?: string
): Promise<PaginatedData<UserItem>> {
  const res = await apiClient.get<ApiResponse<PaginatedData<UserItem>>>(
    `/tamiya/eon/users?pageno=${page}&size=${size}&search=${search ?? ""}`
  )
  return res.data.data ?? { items: [], total: 0, page, size, totalPages: 0 }
}
