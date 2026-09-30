// ════════════════════════════════════════════════════════════════════════════
// PREFERENCE MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// Backed by T_ParameterMaster — a grouped key/value configuration store.
// The compound key is (Pmt_ParameterID, Pmt_ParameterSeq).

// Filter used by the list endpoint.
export interface PreferenceMasterFilter {
  size: number
  pageno: number
  search?: string
  group?: string
}

// One row from the list endpoint (T_ParameterMaster).
export interface PreferenceMasterRow {
  parameterid: string
  seq: number
  desc: string
  value: string
}

// The payload the add call sends.
export interface AddPreferencePayload {
  parameterid: string
  seq: number
  desc: string
  value: string
}

// The payload the update call sends (Group + Seq are the immutable key).
export interface UpdatePreferencePayload {
  parameterid: string
  seq: number
  desc: string
  value: string
}