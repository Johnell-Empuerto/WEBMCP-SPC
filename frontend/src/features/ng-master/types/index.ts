// ════════════════════════════════════════════════════════════════════════════
// NG MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the fields exposed by the modern /ng-master endpoints (backed by
// T_DefectMaster). Category maps to process: '1' Casting(ADC), '2' Machining
// (C4), '3' Pallet(KD), '' none.

// Filter used by the list endpoint.
export interface NgMasterFilter {
  size: number
  pageno: number
  search?: string
  category?: string
  status?: string
}

// One row from the list endpoint (T_DefectMaster).
export interface NgMasterRow {
  code: string
  shortName: string
  desc: string
  definition1: string
  definition2: string
  category: string
  status: string
  userLogin: string
  updatedAt: string | null
}

// The payload the add call sends.
export interface AddNgPayload {
  code: string
  shortName: string
  desc: string
  definition1: string
  definition2: string
  category: string
  status: string
  userlogin?: string
}

// The payload the update call sends (Defect Code is the immutable key).
export interface UpdateNgPayload {
  code: string
  shortName: string
  desc: string
  definition1: string
  definition2: string
  category: string
  status: string
  userlogin?: string
}