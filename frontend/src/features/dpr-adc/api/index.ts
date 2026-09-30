import apiClient from "@/api/client"
import type { DprAdcFilter, DprAdcDetailRow, DprAdcFooter, ShiftInfo } from "../types"

export async function fetchDistinctDieNo(filter: DprAdcFilter): Promise<{ DATA: number; MESSAGE: string; CODE: number }> {
  const res = await apiClient.post("/dpr-adc/distinct-die-no", { filter })
  return res.data.data
}

export async function fetchDieNo(filter: DprAdcFilter): Promise<{ DATA: string | null; MESSAGE: string; CODE: number }> {
  const res = await apiClient.post("/dpr-adc/die-no", { filter })
  return res.data.data
}

export async function fetchDPRData(filter: DprAdcFilter): Promise<{
  code: number; message: string; header: any[]; detail: DprAdcDetailRow[]; status: string
}> {
  const res = await apiClient.post("/dpr-adc/data", { filter })
  return res.data.data
}

export async function fetchDPRDetails(filter: DprAdcFilter): Promise<DprAdcDetailRow[]> {
  const res = await apiClient.post("/dpr-adc/details", { filter })
  return res.data.data ?? []
}

export async function insertDPRHeader(filter: DprAdcFilter, footer: Partial<DprAdcFooter>): Promise<{ success: boolean; code: string }> {
  const res = await apiClient.post("/dpr-adc/header/insert", { filter, footer })
  return res.data.data
}

export async function updateDPRHeader(filter: DprAdcFilter, footer: Partial<DprAdcFooter>): Promise<{ success: boolean }> {
  const res = await apiClient.post("/dpr-adc/header/update", { filter, footer })
  return res.data.data
}

export async function insertDPRDetails(details: DprAdcDetailRow[]): Promise<{ success: boolean }> {
  const res = await apiClient.post("/dpr-adc/details/insert", details)
  return res.data.data
}

export async function updateDPRDetails(details: DprAdcDetailRow[]): Promise<{ success: boolean }> {
  const res = await apiClient.post("/dpr-adc/details/update", details)
  return res.data.data
}

export async function fetchShifts(): Promise<ShiftInfo[]> {
  const res = await apiClient.get("/dpr-adc/shifts")
  return res.data.data?.result ?? []
}

export async function fetchProductCodes(): Promise<any[]> {
  const res = await apiClient.get("/dpr-adc/product-codes")
  return res.data.data ?? []
}
