// ════════════════════════════════════════════════════════════════════════════
// NG REPORT — TYPES & CONSTANTS
// ════════════════════════════════════════════════════════════════════════════
// The report reuses the SAME NG data source as the MPR ADC / C4 / KD NG
// details tables (V_ActualProductionDetail where Ng_Stat > 0) and the same
// legacy column semantics:
//   Date ← Pth_ReqInputDate, Model ← Pmt_InternalProdCode,
//   Die No. ← SUBSTRING(Pth_ProductLotNo,13,1), Shift ← Scm_ShiftCode,
//   Problem ← Dfm_DefectDesc, Status ← Dfm_status.
// Travelog No. ← Pth_TravelogNo, Process ← Pdd_ProcessSeqNo/Pdd_ProcessCode,
// PIC ← the user NAME resolved from T_TravelogDefectsDetail.User_login against
// T_UserMaster (falling back to the login value). Cause / Action /
// Countermeasures / Down Time are not stored in the actuals source (they were
// editable inputs in the legacy view only).

export interface NgReportRow {
  line: string
  model: string
  prodcode: string
  plandate: string | null
  shift: string
  dieNo: string
  problem: string
  cause: string
  action: string
  countermeasures: string
  pic: string
  travelogNo: string
  process: string
  downTime: string
  status: string
  totalNg: number
  recordCount: number
}

export interface NgReportSummary {
  totalRecords: number
  totalNgQty: number
  topCause: string
  mostAffectedLine: string
}

export interface NgReportResult {
  rows: NgReportRow[]
  totalItems: number
  summary: NgReportSummary
}

export interface NgReportOptionItem {
  value: string
  label: string
}

export interface NgReportOptions {
  years: number[]
  lines: NgReportOptionItem[]
  models: NgReportOptionItem[]
  shifts: NgReportOptionItem[]
  statuses: string[]
}

// Machine_Line '1'..'5' → human label (same mapping as the MPR routes).
export const LINE_LABELS: Record<string, string> = {
  "1": "ADC 1",
  "2": "ADC 2",
  "3": "ADC 3",
  "4": "C4",
  "5": "KD",
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50]
export const DEFAULT_PAGE_SIZE = 10

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]