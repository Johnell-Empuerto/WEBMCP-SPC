import apiClient from "./client"
import type { ApiResponse, User } from "@/types"
import { setTokens, clearTokens } from "@/lib/tokenStorage"

interface LoginResponse {
  token: string
  refreshToken: string
  user: User
}

export async function loginApi(
  userCode: string,
  password: string,
  rememberMe = false
): Promise<LoginResponse> {
  const res = await apiClient.post<ApiResponse<LoginResponse>>("/auth/login", {
    userCode,
    password,
  })
  const data = res.data.data!
  // persist according to Remember Me: localStorage (persistent) or sessionStorage (session-only)
  setTokens(data.token, data.refreshToken, rememberMe)
  return data
}

export async function logoutApi(): Promise<void> {
  try {
    await apiClient.post("/auth/logout")
  } finally {
    clearTokens()
  }
}

export async function fetchMe(): Promise<User | null> {
  try {
    const res = await apiClient.get<ApiResponse<User>>("/auth/me")
    return res.data.data ?? null
  } catch {
    return null
  }
}

