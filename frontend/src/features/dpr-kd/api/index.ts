import apiClient from "@/api/client"
import type { DprKdFilter, DprKdDetailRow, DprKdFooter, LeaderInfo, ShiftInfo } from "../types"

export async function fetchDistinctDieNo(filter: DprKdFilter): Promise<{ DATA: number; MESSAGE: string; CODE: number }> {
  const res = await apiClient.post("/dpr-kd/distinct-die-no", { filter })
  return res.data.data
}

export async function fetchDieNo(filter: DprKdFilter): Promise<{ DATA: string | null; MESSAGE: string; CODE: number }> {
  const res = await apiClient.post("/dpr-kd/die-no", { filter })
  return res.data.data
}

export async function fetchDPRData(filter: DprKdFilter): Promise<{
  code: number; message: string; header: any[]; detail: DprKdDetailRow[]; status: string
}> {
  const res = await apiClient.post("/dpr-kd/data", { filter })
  return res.data.data
}

export async function fetchDPRDetails(filter: DprKdFilter): Promise<DprKdDetailRow[]> {
  const res = await apiClient.post("/dpr-kd/details", { filter })
  return res.data.data ?? []
}

export async function insertDPRHeader(filter: DprKdFilter, footer: Partial<DprKdFooter>): Promise<{ success: boolean; code: string }> {
  const res = await apiClient.post("/dpr-kd/header/insert", { header: filter, footer })
  return res.data.data
}

export async function updateDPRHeader(dprCode: string, filter: DprKdFilter, footer: Partial<DprKdFooter>): Promise<{ success: boolean; code: string }> {
  const res = await apiClient.post("/dpr-kd/header/update", { header: filter, footer, dprCode })
  return res.data.data
}

export async function insertDPRDetails(details: DprKdDetailRow[]): Promise<{ success: boolean }> {
  const res = await apiClient.post("/dpr-kd/details/insert", details)
  return res.data.data
}

export async function updateDPRDetails(details: DprKdDetailRow[]): Promise<{ success: boolean }> {
  const res = await apiClient.post("/dpr-kd/details/update", details)
  return res.data.data
}

export async function fetchShifts(): Promise<ShiftInfo[]> {
  const res = await apiClient.get("/dpr-kd/shifts")
  return res.data.data?.result ?? []
}

export async function fetchTeamLeaders(): Promise<LeaderInfo[]> {
  const res = await apiClient.get("/dpr-kd/team-leaders")
  return res.data.data ?? []
}

export async function fetchGroupLeaders(): Promise<LeaderInfo[]> {
  const res = await apiClient.get("/dpr-kd/group-leaders")
  return res.data.data ?? []
}

export async function fetchLineCheckers(): Promise<LeaderInfo[]> {
  const res = await apiClient.get("/dpr-kd/line-checkers")
  return res.data.data ?? []
}

export async function checkExistingHeader(filter: DprKdFilter): Promise<{ dprCode: string | null }> {
  const res = await apiClient.post("/dpr-kd/check-header", { filter })
  return res.data.data
}
