// ════════════════════════════════════════════════════════════════════════════
// MPR KD — TYPES & FILTER CONSTANTS
// ════════════════════════════════════════════════════════════════════════════
// The filter options below are the SAME values the legacy MPRControllerKD.js
// used — the machine is fixed to the single 'KD' line (value 'KD') and model
// names map to their exact product codes. The backend reproduces the legacy
// live Node-RED /fetchkd-data SQL semantics, so these must not be invented or
// changed.

export interface MprKdFilter {
  selectedDate: string // "YYYY-MM"
  selectedMachine?: string | null // "KD" | null (All)
  selectedModel?: string | null // exact product code | null (All)
}

// One row from POST /mpr-kd/data (same shape as legacy live /fetchkd-data).
export interface MprKdRow {
  title: string
  prodcode: string
  plandate: string
  planqty: number
  Total_WIP: number
  Total_NG: number
  Total_FG: number
  DieNo: string
  ShiftName: string
  Dfm_DefectDesc: string
  Dfm_status: string
  plan_record_count?: number | string
  plan_dates?: string
  plan_product_codes?: string
  plan_lines?: string
  status?: string
}

// One row from POST /mpr-kd/ng-data (same shape as legacy /fetchkd-ng-data).
export interface MprKdNgRow {
  title: string
  prodcode: string
  plandate: string
  Total_NG: number
  DieNo: string
  ShiftName: string
  Dfm_DefectDesc: string
  Dfm_status: string
}

// Row for the NG details table (editable fields default to empty, exactly
// like the legacy view's inputs).
export interface MprNgDetailRow {
  DateNo: string
  ProductCode: string
  Title: string
  DieNo: string
  Shift: string
  Dfm_DefectDesc: string
  Dfm_status: string
  Cause: string
  Action: string
  Countermeasures: string
  PIC: string
  DownTime: string
  Total_NG: number
  Total_WIP: number
  PlanQty: number
  uniqueId: string
}

// Daily aggregates produced by the same shift/total/running calculations the
// legacy MPRControllerKD.js performed on the /fetchkd-data response.
export interface MprDayAggregates {
  dateRange: number[]
  planDataShift1: number[]
  actualDataShift1: number[]
  planDataShift2: number[]
  actualDataShift2: number[]
  planDataShift3: number[]
  actualDataShift3: number[]
  fgDataShift1: number[]
  fgDataShift2: number[]
  fgDataShift3: number[]
  totalPlannedData: number[]
  totalActualData: number[]
  totalFgData: number[]
  runningTotalPlannedData: number[]
  runningTotalActualData: number[]
  runningTotalFgData: number[]
  eff: number[]
  diff: number[]
  tPlan: number
  tActual: number
  tFg: number
}

// ── Legacy filter constants (MPRControllerKD.js) ─────────────────────────
// The legacy KD page exposes a single machine — the KD line.
export const MACHINES = [{ name: "KD", value: "KD" }]

export const MODELS = [
  { name: "ES01", value: "8-98247-187-2" },
  { name: "ES25", value: "8-97669-716-0" },
  { name: "ES08", value: "8-97533-464-1" },
  { name: "ES30 H/R", value: "8972787453" },
  { name: "ES30 L/R", value: "8972787463" },
]

// Legacy Chart.js colors for the stacked bar datasets + running-total lines.
export const CHART_COLORS = {
  planShift1: "rgba(0, 51, 102, 0.85)",
  actualShift1: "rgba(139, 0, 0, 0.85)",
  planShift2: "rgba(54, 162, 235, 0.85)",
  actualShift2: "rgba(255, 99, 99, 0.85)",
  planShift3: "rgba(135, 206, 250, 0.85)",
  actualShift3: "rgba(255, 182, 193, 0.85)",
  runningPlan: "#008000",
  runningActual: "#FFA500",
}
