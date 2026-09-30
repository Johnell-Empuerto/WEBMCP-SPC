import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type { HealthStatus, SessionTimeoutSetting } from "../types"

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await apiClient.get<ApiResponse<HealthStatus>>("/health")
  return (
    res.data.data ?? {
      api: { status: "unknown", responseTimeMs: null, uptime: "—", uptimeSeconds: 0, version: "—", environment: "—" },
      database: { status: "unknown", responseTimeMs: null, sizeMb: null, tables: null, connections: null, version: null },
      nodeRed: { status: "not-configured", responseTimeMs: null, endpoint: null },
      overall: "unknown",
      checkedAt: new Date().toISOString(),
    }
  )
}

export async function fetchSessionTimeout(): Promise<SessionTimeoutSetting> {
  const res = await apiClient.get<ApiResponse<SessionTimeoutSetting>>("/settings/session-timeout")
  return res.data.data ?? { minutes: 30 }
}

export async function updateSessionTimeout(minutes: number): Promise<SessionTimeoutSetting> {
  const res = await apiClient.put<ApiResponse<SessionTimeoutSetting>>(
    "/settings/session-timeout",
    { minutes }
  )
  return res.data.data ?? { minutes }
}
