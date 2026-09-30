export interface PalletFilter {
  status?: string
  date?: string
  partNo?: string
}

export interface PalletRow {
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
  selected?: boolean
}

export interface PalletHeaderForm {
  controlNo: string
  partNo: string
  plCode?: string
  date: string
  customerCode: string
  destination: string
  poNumber: string
  invoiceNo: string
  caseNo: string
  orderDate: string
}

export interface PalletDetailsForm {
  packingDate: string
  orderNo: string
  productName: string
  palletCount: number | null
  quantity: number | null
  weight: number | null
  boxNo: string
}

export interface ProductDetailsResult {
  data: {
    Pmt_Productcode: string
    Pmt_Productname: string
    Pmt_StdPackingQty: number
    Pmt_StdGrossWeight: number
    Pmt_ProductCase: string
    [key: string]: unknown
  } | null
  entryCount: number
}

export interface CustomerCode {
  code: string
  name: string
}

export interface LoadedPallet {
  Plh_PLCode: string
  Plh_PalletCode: string | null
  Plh_PartNo: string | null
  Plh_CaseNo: string | null
  Plh_PONo: string | null
  Plh_InvoiceNo: string | null
  Plh_CustomerCode: string | null
  Plh_Destination: string | null
  Plh_OrderDate: number | null
  Plh_Date: string | null
  Plh_PackingDate: string | null
  Plh_OrderNo: string | null
  Plh_ProductName: string | null
  Plh_Quantity: number | null
  Plh_Weight: number | null
  Plh_BoxNo: number | null
  Plh_ControlNo: string | null
  Plh_CheckBy: string | null
}

export interface PrintEntry {
  qrCode: string
  palletId: string
  poNumber: string
  invoiceNo: string
  caseNo: string
  partNo: string
  description: string
  boxNo: string
  totalQtyCase: string
  partName: string
  packingDatePlan: string
  packingDateActual: string
  orderNo: string
  destination: string
  packedBy: string
  checkedBy: string
  salesPlanning: string
  caseNoFooter: string
  weight: string
}