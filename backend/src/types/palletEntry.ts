export interface PalletFilter {
  status?: string
  date?: string
  formattedDate?: string
  partNo?: string
}

export interface PalletHeaderRow {
  Plh_PLCode: string
  Plh_PalletCode: string | null
  Plh_PartNo: string | null
  Plh_CaseNo: string | null
  Plh_OrderNo: string | null
  Plh_PONo: string | null
  Plh_InvoiceNo: string | null
  Plh_CustomerCode: string | null
  Plh_Status: string | null
  Plh_ControlNo: string | null
  Plh_OrderDate: number | null
  Plh_Date: string | null
  Plh_Destination: string | null
  Plh_PackingDate: string | null
  Plh_ProductName: string | null
  Plh_Quantity: number | null
  Plh_Weight: number | null
  Plh_BoxNo: number | null
  Plh_PalletCount: number | null
  Plh_CheckBy: string | null
}

export interface PalletHeader {
  controlNo: string | null
  partNo: string | null
  plCode?: string | null
  date: string | null
  customerCode: string | null
  destination: string | null
  poNumber: string | null
  invoiceNo: string | null
  caseNo: string | null
  orderDate: string | number | null
}

export interface PalletDetails {
  packingDate: string | null
  orderNo: string | null
  productName: string | null
  palletCount: number | null
  quantity: number | null
  weight: number | null
  boxNo: string | null
}

export interface PalletProductResult {
  data: any[]
  entryCount: number
}

export interface CustomerCode {
  code: string
  name: string
}

export interface UpdatePalletRequest {
  user_login?: string
  header: PalletHeader
  details: PalletDetails
  palletIds: Record<string, string>
}