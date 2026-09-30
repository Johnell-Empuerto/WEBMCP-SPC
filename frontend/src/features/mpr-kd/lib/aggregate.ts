import type { MprDayAggregates, MprKdNgRow, MprKdRow, MprNgDetailRow } from "../types"

// ════════════════════════════════════════════════════════════════════════════
// MPR KD — DATA PROCESSING (legacy MPRControllerKD.js behavior)
// ════════════════════════════════════════════════════════════════════════════
// This replicates the exact aggregation the legacy AngularJS controller
// performed on the live /fetchkd-data response (FULL OUTER JOIN variant):
//
//   - Each row is validated (plandate present, valid date, inside the month)
//   - planQty   = item.planqty
//   - actualQty = item.Total_WIP       (legacy uses Total_WIP as "actual")
//   - DUPLICATE-KEY REMOVAL via a processedKeys Set — the legacy KD controller
//     dedupes (unlike C4) because the FULL OUTER JOIN can repeat a plan row
//     across the multiple actual shift/die rows it matches. The key is:
//       ShiftName known  → `${plandate}-${ShiftName}-${prodcode}-${DieNo}`
//       ShiftName Unknown → `${plandate}-PlanOnly-${prodcode}`
//   - Shift assignment: 'Shift 1'|'Shift 2'|'Shift 3'; any unknown/empty
//     shift (including the SQL 'Unknown' default) falls back to 'Shift 1',
//     exactly like legacy
//   - Per-day totals, grand totals (tPlan/tActual), diff and eff% per day
//   - Running totals via cumulative reduce
//
// The result feeds BOTH the MPR table and the chart.

const SHIFT_1 = "Shift 1"
const SHIFT_2 = "Shift 2"
const SHIFT_3 = "Shift 3"

export function buildMprAggregates(
  rows: MprKdRow[],
  month: string, // "YYYY-MM"
): MprDayAggregates {
  const [year, mon] = month.split("-").map(Number)
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()

  const agg: MprDayAggregates = {
    dateRange: Array.from({ length: daysInMonth }, (_, i) => i + 1),
    planDataShift1: new Array(daysInMonth).fill(0),
    actualDataShift1: new Array(daysInMonth).fill(0),
    planDataShift2: new Array(daysInMonth).fill(0),
    actualDataShift2: new Array(daysInMonth).fill(0),
    planDataShift3: new Array(daysInMonth).fill(0),
    actualDataShift3: new Array(daysInMonth).fill(0),
    fgDataShift1: new Array(daysInMonth).fill(0),
    fgDataShift2: new Array(daysInMonth).fill(0),
    fgDataShift3: new Array(daysInMonth).fill(0),
    totalPlannedData: new Array(daysInMonth).fill(0),
    totalActualData: new Array(daysInMonth).fill(0),
    totalFgData: new Array(daysInMonth).fill(0),
    runningTotalPlannedData: new Array(daysInMonth).fill(0),
    runningTotalActualData: new Array(daysInMonth).fill(0),
    runningTotalFgData: new Array(daysInMonth).fill(0),
    eff: new Array(daysInMonth).fill(0),
    diff: new Array(daysInMonth).fill(0),
    tPlan: 0,
    tActual: 0,
    tFg: 0,
  }

  // Legacy MPRControllerKD.js tracks processed plandate+ShiftName combos to
  // avoid double-counting rows produced by the FULL OUTER JOIN.
  const processedKeys = new Set<string>()

  for (const item of rows) {
    if (!item.plandate) continue

    const planDate = new Date(item.plandate)
    if (Number.isNaN(planDate.getTime())) continue

    // Ensure plandate is within the selected month — legacy MPRControllerKD.js
    // used LOCAL-time getters (getMonth/getFullYear/getDate), so we do the
    // same for exact parity.
    if (
      planDate.getMonth() + 1 !== mon ||
      planDate.getFullYear() !== year
    ) {
      continue
    }

    const dayIndex = planDate.getDate() - 1
    if (dayIndex < 0 || dayIndex >= daysInMonth) continue

    // Legacy dedup key — ShiftName 'Unknown' (or empty) rows use the
    // PlanOnly key so plan-only rows are not lost/duplicated.
    const key =
      item.ShiftName && item.ShiftName !== "Unknown"
        ? `${item.plandate}-${item.ShiftName}-${item.prodcode}-${item.DieNo}`
        : `${item.plandate}-PlanOnly-${item.prodcode}`
    if (processedKeys.has(key)) continue
    processedKeys.add(key)

    const planQty = Number.parseFloat(String(item.planqty)) || 0
    const actualQty = Number.parseFloat(String(item.Total_WIP)) || 0
    const fgQty = Number.parseFloat(String(item.Total_FG)) || 0

    // Legacy: shiftName = item.ShiftName !== 'Unknown' ? item.ShiftName :
    // 'Shift 1'; the final else also lands in Shift 1.
    const shiftName =
      item.ShiftName && item.ShiftName !== "Unknown" ? item.ShiftName : SHIFT_1

    if (shiftName === SHIFT_1) {
      agg.planDataShift1[dayIndex] += planQty
      agg.actualDataShift1[dayIndex] += actualQty
      agg.fgDataShift1[dayIndex] += fgQty
    } else if (shiftName === SHIFT_2) {
      agg.planDataShift2[dayIndex] += planQty
      agg.actualDataShift2[dayIndex] += actualQty
      agg.fgDataShift2[dayIndex] += fgQty
    } else if (shiftName === SHIFT_3) {
      agg.planDataShift3[dayIndex] += planQty
      agg.actualDataShift3[dayIndex] += actualQty
      agg.fgDataShift3[dayIndex] += fgQty
    } else {
      agg.planDataShift1[dayIndex] += planQty
      agg.actualDataShift1[dayIndex] += actualQty
      agg.fgDataShift1[dayIndex] += fgQty
    }

    agg.totalPlannedData[dayIndex] += planQty
    agg.totalActualData[dayIndex] += actualQty
    agg.totalFgData[dayIndex] += fgQty
    agg.tPlan += planQty
    agg.tActual += actualQty
    agg.tFg += fgQty
    agg.diff[dayIndex] = agg.totalPlannedData[dayIndex] - agg.totalActualData[dayIndex]
    agg.eff[dayIndex] =
      agg.totalPlannedData[dayIndex] > 0
        ? Number(
            ((agg.totalActualData[dayIndex] / agg.totalPlannedData[dayIndex]) * 100).toFixed(2),
          )
        : 0
  }

  // Running totals — cumulative reduce, same as legacy
  agg.totalPlannedData.reduce((sum, value, index) => {
    agg.runningTotalPlannedData[index] = sum + value
    return sum + value
  }, 0)

  agg.totalActualData.reduce((sum, value, index) => {
    agg.runningTotalActualData[index] = sum + value
    return sum + value
  }, 0)

  agg.totalFgData.reduce((sum, value, index) => {
    agg.runningTotalFgData[index] = sum + value
    return sum + value
  }, 0)

  return agg
}

// ── NG details table rows (legacy machinedata mapping) ─────────────────────
// Filters Total_NG > 0 and maps each NG row into the details-table shape.
export function buildNgDetailRows(rows: MprKdNgRow[]): MprNgDetailRow[] {
  return rows
    .filter((item) => Number.parseFloat(String(item.Total_NG)) > 0)
    .map((item, index) => ({
      DateNo: item.plandate,
      ProductCode: item.prodcode ? String(item.prodcode).trim() : "",
      Title: item.title || "",
      DieNo: item.DieNo || "",
      Shift: item.ShiftName || "Unknown",
      Dfm_DefectDesc: item.Dfm_DefectDesc || "",
      Dfm_status: item.Dfm_status || "",
      Cause: "",
      Action: "",
      Countermeasures: "",
      PIC: "",
      DownTime: "",
      Total_NG: Number.parseFloat(String(item.Total_NG)) || 0,
      Total_WIP: 0,
      PlanQty: 0,
      uniqueId: `${item.plandate}-${item.ShiftName || "Unknown"}-${item.prodcode || "Unknown"}-${
        item.DieNo || "Unknown"
      }-${item.Dfm_DefectDesc || "Unknown"}-${index}`,
    }))
}

// ── Date formatting for the details table (legacy dd-MM-yyyy) ──────────────
export function formatMprDate(dateString: string | null | undefined): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ""
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}
