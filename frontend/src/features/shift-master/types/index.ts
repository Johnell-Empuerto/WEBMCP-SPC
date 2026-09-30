// ════════════════════════════════════════════════════════════════════════════
// SHIFT MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the fields exposed by the modern /shift-master endpoints. Times are
// exchanged as "HHMM" strings (e.g. "0600") to match the char(4) columns on
// T_ShiftCodeMaster. The UI converts to/from "HH:MM" for the time inputs.

// Filter used by the list endpoint.
export interface ShiftMasterFilter {
  size: number
  pageno: number
  search?: string
  status?: string
}

// One row from the list endpoint (T_ShiftCodeMaster).
export interface ShiftMasterRow {
  code: string
  desc: string
  scheduleType: string
  timein: string
  breakStart: string
  breakEnd: string
  timeout: string
  totalHours: number
  status: string
  userLogin: string
  updatedAt: string | null
}

// The payload the add call sends.
export interface AddShiftPayload {
  code: string
  desc: string
  scheduleType: string
  timein: string
  breakStart: string
  breakEnd: string
  timeout: string
  totalHours: number
  status: string
  userlogin?: string
}

// The payload the update call sends (Shift Code is the immutable key).
export interface UpdateShiftPayload {
  code: string
  desc: string
  scheduleType: string
  timein: string
  breakStart: string
  breakEnd: string
  timeout: string
  totalHours: number
  status: string
  userlogin?: string
}