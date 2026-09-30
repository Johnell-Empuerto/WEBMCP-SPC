export interface User {
  userCode: string
  userName: string
  email: string
  roleId: number
  roleName: string
  status?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  size: number
  totalPages: number
}
