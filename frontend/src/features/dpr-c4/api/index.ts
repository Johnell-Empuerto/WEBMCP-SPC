import apiClient from "@/api/client"
import type { DprC4Filter, DprC4DetailRow, DprC4Footer, LeaderInfo, ShiftInfo } from "../types"

export async function fetchDistinctDieNo(filter: DprC4Filter): Promise<{ DATA: number; MESSAGE: string; CODE: number }> {
  const res = await apiClient.post("/dpr-c4/distinct-die-no", { filter })
  return res.data.data
}

export async function fetchDieNo(filter: DprC4Filter): Promise<{ DATA: string | null; MESSAGE: string; CODE: number }> {
  const res = await apiClient.post("/dpr-c4/die-no", { filter })
  return res.data.data
}

export async function fetchDPRData(filter: DprC4Filter): Promise<{
  code: number; message: string; header: any[]; detail: DprC4DetailRow[]; status: string
}> {
  const res = await apiClient.post("/dpr-c4/data", { filter })
  return res.data.data
}

export async function fetchDPRDetails(filter: DprC4Filter): Promise<DprC4DetailRow[]> {
  const res = await apiClient.post("/dpr-c4/details", { filter })
  return res.data.data ?? []
}

export async function insertDPRHeader(filter: DprC4Filter, footer: Partial<DprC4Footer>): Promise<{ success: boolean; code: string }> {
  const res = await apiClient.post("/dpr-c4/header/insert", { header: filter, footer })
  return res.data.data
}

export async function updateDPRHeader(dprCode: string, filter: DprC4Filter, footer: Partial<DprC4Footer>): Promise<{ success: boolean; code: string }> {
  const res = await apiClient.post("/dpr-c4/header/update", { header: filter, footer, dprCode })
  return res.data.data
}

export async function insertDPRDetails(details: DprC4DetailRow[]): Promise<{ success: boolean }> {
  const res = await apiClient.post("/dpr-c4/details/insert", details)
  return res.data.data
}

export async function updateDPRDetails(details: DprC4DetailRow[]): Promise<{ success: boolean }> {
  const res = await apiClient.post("/dpr-c4/details/update", details)
  return res.data.data
}

export async function fetchShifts(): Promise<ShiftInfo[]> {
  const res = await apiClient.get("/dpr-c4/shifts")
  return res.data.data?.result ?? []
}

export async function fetchTeamLeaders(): Promise<LeaderInfo[]> {
  const res = await apiClient.get("/dpr-c4/team-leaders")
  return res.data.data ?? []
}

export async function fetchGroupLeaders(): Promise<LeaderInfo[]> {
  const res = await apiClient.get("/dpr-c4/group-leaders")
  return res.data.data ?? []
}

export async function fetchLineCheckers(): Promise<LeaderInfo[]> {
  const res = await apiClient.get("/dpr-c4/line-checkers")
  return res.data.data ?? []
}

export async function checkExistingHeader(filter: DprC4Filter): Promise<{ dprCode: string | null }> {
  const res = await apiClient.post("/dpr-c4/check-header", { filter })
  return res.data.data
}
