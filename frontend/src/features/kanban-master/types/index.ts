// ════════════════════════════════════════════════════════════════════════════
// KANBAN MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// The field names match the legacy KanbanMasterController.js / Node-RED
// payloads (getKanbanMaster / addKanbanMaster), so the backend can reproduce
// the exact SQL semantics.

// Filter used by the list endpoint (legacy getKanbanMaster query params).
export interface KanbanMasterFilter {
  size: number
  pageno: number
  kanban?: string
  partno?: string
  capacity?: string
  rem?: string
}

// One row from the list endpoint (legacy getKanbanMaster → LoopDataArrangementEvents).
export interface KanbanMasterRow {
  Kbm_DefaultLocator: string
  Kbm_Description: string
  Kbm_KanbanID: string
  Kbm_PartNo: string
  Kbm_Qty: number
  Kbm_RegBy: string
  Kbm_RegDate: string
  Kbm_Remarks: string
  Kbm_Status: string
  User_login: string
  ludatetime: string
  selected: boolean
}

// The payload the add call sends (legacy addKanbanMaster query params).
export interface AddKanbanPayload {
  partno: string
  desc: string
  capacity: string
  loc: string
  rem: string
  userlogin?: string
}

// The payload the update call sends (adds the immutable Kanban ID key).
export interface UpdateKanbanPayload extends AddKanbanPayload {
  kanbanid: string
}

// Dropdown option shape (legacy mapped { code, description }).
export interface LookupOption {
  code: string
  description: string
}

// Product option from the partno dropdown (active products with internal codes).
export interface PartNoOption {
  Pmt_Productcode: string
  Pmt_Productname: string
  Pmt_InternalProdCode: string
}

// All lookup groups returned by GET /kanban-master/lookups.
export interface KanbanMasterLookups {
  partNos: PartNoOption[]
  locators: LookupOption[]
}
