// ════════════════════════════════════════════════════════════════════════════
// LOCATOR MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// The field names match the legacy LocatorMasterController.js / Node-RED
// payloads (getLocatorMaster24 / getLocatorMasterWithPara24 / addLocatorMaster24 /
// updateLocatorMaster24 / checkifCodeExists24), so the backend can reproduce
// the exact SQL semantics.

// Filter used by the list endpoint (legacy getLocatorMasterWithPara24 params).
export interface LocatorMasterFilter {
  size: number
  pageno: number
  search?: string
  type?: string
  area?: string
  occupancy?: string
  status?: string
  warehouse?: string
}

// One row from the list endpoint (T_LocatorMaster).
export interface LocatorMasterRow {
  Lmt_Locatorcode: string
  Lmt_Locatordesc: string
  Lmt_LocatorType: string
  Lmt_LocatorArea: string
  Lmt_OccupancyStatus: string
  Lmt_EffectivityDate: string
  Lmt_status: string
  Lmt_WarehouseCode: string
  User_login: string
  ludatetime: string
  selected: boolean
}

// The payload the add call sends (legacy addLocatorMaster24 query params).
export interface AddLocatorPayload {
  locatorcode: string
  desc: string
  type: string
  area: string
  occupancy: string
  status: string
  warehouse?: string
  userlogin?: string
}

// The payload the update call sends (adds the immutable Locator Code key and
// the optional Effectivity Date).
export interface UpdateLocatorPayload extends AddLocatorPayload {
  locatorcode: string
  effectivitydate?: string
}