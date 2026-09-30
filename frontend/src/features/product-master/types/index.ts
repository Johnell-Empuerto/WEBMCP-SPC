// ════════════════════════════════════════════════════════════════════════════
// PRODUCT MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// The field names match the legacy ProductMasterController.js / Node-RED
// payloads (addProdMaster / updateProdMaster / getProdDetails), so the
// backend can reproduce the exact SQL semantics.

// Filter used by the list endpoint (legacy getProdMaster query params).
export interface ProductMasterFilter {
  size: number
  pageno: number
  prodcode?: string
  prodname?: string
  prodspec?: string
  internalprodcode?: string
}

// One row from the list endpoint (legacy getProdMaster → LoopDataArrangementEvents).
export interface ProductMasterRow {
  Pmt_Productcode: string
  Pmt_Productname: string
  Pmt_CostCenterCode: string
  Pmt_ProdCategory: string
  Pmt_ProdSource: string
  Pmt_BMstatus: string
  Pmt_ProductSpecification: string
  Pmt_InternalProdCode: string
  Pmt_status: string
  User_login: string
  ludatetime: string
  selected: boolean
}

// Full product detail used by the add/edit modal (legacy getProdDetails shape).
export interface ProductDetail {
  Pmt_Productcode: string
  Pmt_Productname: string
  Pmt_CostCenterCode: string
  Pmt_ProdRegdate: string
  Pmt_ProdCategory: string
  Pmt_ProdSource: string
  Pmt_RequireCPO: number
  Pmt_ProductUnit: string
  Pmt_BOMControlNo: string
  Pmt_BOMProdCode: string
  Pmt_BOMType: string
  Pmt_BMstatus: string
  Pmt_HasCurMthPSched: number
  Pmt_HasNxtMthPSched: number
  Pmt_PSGroupCode: string
  Pmt_MinLotSize: number
  Pmt_MaxLotSize: number
  Pmt_ProdLeadTime: number
  Pmt_LeadTimeUnit: string
  Pmt_StdPackingQty: number
  Pmt_StdPackingUnit: string
  Pmt_BarcodeHeader: number
  Pmt_status: string
  User_login: string
  ludatetime: string
  Pmt_AccountCode: string
  Pmt_IsHalfFinished: number
  Pmt_LastShipment: string
  Pmt_ProductSpecification: string
  Pmt_ProductExtCode: string
  Pmt_BusinessUnitCode: string
  Pmt_StdNetWeight: number
  Pmt_StdGrossWeight: number
  Pmt_NetGrossDecDigit: number
  Pmt_DescCategoryCode: string
  Pmt_InternalProdCode: string
}

// The product payload the add/update calls send — same field names as the
// legacy controller (addmachine / updatemachinetble).
export interface ProductMasterPayload {
  prodcode?: string
  prodname?: string
  prodcostcenter?: string
  prodcategory?: string
  prodsource?: string
  reqcpo?: string
  produnit?: string
  bomcontrolno?: string
  bomprodcode?: string
  bomtype?: string
  hascurpsched?: string
  hasnxtpsched?: string
  bmstatus?: string
  psgroupcode?: string
  minlotsize?: number | string
  maxlotsize?: number | string
  prodleadtime?: number | string
  leadtimeunit?: string
  stdpackingqty?: number | string
  stdpackingunit?: string
  barcodeheader?: number | string
  status?: string
  accountcode?: string
  ishalffinished?: number | string
  stdnetweight?: number | string
  stdgrossweight?: number | string
  netgrossdecdigit?: number | string
  userlogin?: string
  prodspec?: string
  prodextcode?: string
  businessunitcode?: string
  desccategorycode?: string
  prodregdate?: string
  last_shipment?: string
  internalprodcode?: string
}

// Dropdown option shape (legacy mapped { code, description }).
export interface LookupOption {
  code: string
  description: string
}

// All lookup groups returned by GET /product-master/lookups.
export interface ProductMasterLookups {
  costCenters: LookupOption[]
  prodUnits: LookupOption[]
  accountCodes: LookupOption[]
  psGroupCodes: LookupOption[]
}
