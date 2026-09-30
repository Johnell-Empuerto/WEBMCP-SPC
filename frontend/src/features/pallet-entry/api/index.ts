import apiClient from "@/api/client"
import * as QRCode from "qrcode"
import type {
  PalletFilter,
  PalletRow,
  ProductDetailsResult,
  CustomerCode,
  LoadedPallet,
  PalletHeaderForm,
  PalletDetailsForm,
  PrintEntry,
} from "../types"

export async function fetchPallets(filter: PalletFilter): Promise<PalletRow[]> {
  const res = await apiClient.post("/pallet-entry/filter", { filter })
  return res.data.data ?? []
}

export async function fetchPallet(plCode: string): Promise<LoadedPallet[]> {
  const res = await apiClient.post("/pallet-entry/load", { plCode })
  return res.data.data ?? []
}

export async function fetchCustomerCodes(): Promise<CustomerCode[]> {
  const res = await apiClient.get("/pallet-entry/customer-codes")
  return res.data.data ?? []
}

export async function fetchProductDetails(
  header: { orderDate?: string | null; partNo?: string | null },
): Promise<ProductDetailsResult> {
  const res = await apiClient.post("/pallet-entry/product-details", { header })
  return res.data.data ?? { data: null, entryCount: 0 }
}

export async function updatePallets(
  user_login: string,
  header: PalletHeaderForm,
  details: PalletDetailsForm,
  palletIds: string[],
): Promise<{ success: boolean; updated: number }> {
  const palletIdsObj: Record<string, string> = {}
  palletIds.forEach((code, i) => {
    palletIdsObj[`Plh_PLCode_${i}`] = code
  })
  const res = await apiClient.post("/pallet-entry/update", {
    user_login,
    header,
    details,
    palletIds: palletIdsObj,
  })
  return res.data.data
}

export async function cancelPallets(palletIds: string[]): Promise<{ success: boolean; cancelled: number }> {
  const palletIdsObj: Record<string, string> = {}
  palletIds.forEach((code, i) => {
    palletIdsObj[`Plh_PLCode_${i}`] = code
  })
  const res = await apiClient.post("/pallet-entry/cancel", palletIdsObj)
  return res.data.data
}

export async function fetchPrintData(plCode: string): Promise<LoadedPallet | null> {
  const res = await apiClient.post("/pallet-entry/print", { plCode })
  return res.data.data ?? null
}

export async function generateQRCodeDataUrl(data: string, size = 50): Promise<string> {
  try {
    return await QRCode.toDataURL(data, { width: size, margin: 1 })
  } catch {
    return ""
  }
}

export function buildPrintEntries(
  row: LoadedPallet,
  header: PalletHeaderForm,
  details: PalletDetailsForm,
  qrCodeFallback = "",
): PrintEntry {
  return {
    qrCode: qrCodeFallback,
    palletId: row.Plh_PLCode ?? "",
    poNumber: header.poNumber ?? row.Plh_PONo ?? "",
    invoiceNo: header.invoiceNo ?? row.Plh_InvoiceNo ?? "",
    caseNo: header.caseNo ?? row.Plh_CaseNo ?? "",
    partNo: header.partNo ?? row.Plh_PartNo ?? "",
    description: details.productName ?? row.Plh_ProductName ?? "",
    boxNo: details.boxNo ?? (row.Plh_BoxNo?.toString() ?? ""),
    totalQtyCase: (details.quantity ?? row.Plh_Quantity ?? "").toString(),
    partName: details.productName ?? row.Plh_ProductName ?? "",
    packingDatePlan: (header.date || "").slice(0, 10),
    packingDateActual: (details.packingDate || (row.Plh_PackingDate ?? "")).slice(0, 10),
    orderNo: details.orderNo ?? row.Plh_OrderNo ?? "",
    destination: header.destination ?? row.Plh_Destination ?? "",
    packedBy: "LOGISTICS SECTION",
    checkedBy: row.Plh_CheckBy || "QUALITY CONTROL SECTION",
    salesPlanning: "SALES PLANNING",
    caseNoFooter: header.caseNo ?? row.Plh_CaseNo ?? "",
    weight: (details.weight ?? row.Plh_Weight ?? "").toString(),
  }
}

function toDateStr(v: string | null | undefined): string {
  if (!v) return ""
  const datePart = String(v).split("T")[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : ""
}

export function buildPrintEntryFromRow(row: PalletRow, qrCode = ""): PrintEntry {
  const packingDatePlan = toDateStr(row.Plh_Date)
  const packingDateActual = toDateStr(row.Plh_PackingDate)
  return {
    qrCode,
    palletId: row.Plh_PLCode || "",
    poNumber: row.Plh_PONo || "",
    invoiceNo: row.Plh_InvoiceNo || "",
    caseNo: row.Plh_CaseNo || "",
    partNo: row.Plh_PartNo || "",
    description: row.Plh_ProductName || "",
    boxNo: row.Plh_BoxNo != null ? String(row.Plh_BoxNo) : "",
    totalQtyCase: row.Plh_Quantity != null ? String(row.Plh_Quantity) : "",
    partName: row.Plh_ProductName || "",
    packingDatePlan,
    packingDateActual,
    orderNo: row.Plh_OrderNo || "",
    destination: row.Plh_Destination || "",
    packedBy: "LOGISTICS SECTION",
    checkedBy: row.Plh_CheckBy || "QUALITY CONTROL SECTION",
    salesPlanning: "SALES PLANNING",
    caseNoFooter: row.Plh_CaseNo || "",
    weight: row.Plh_Weight != null ? String(row.Plh_Weight) : "",
  }
}

export type { PrintEntry }