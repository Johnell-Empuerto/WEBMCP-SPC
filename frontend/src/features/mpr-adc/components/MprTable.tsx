import { Table2 } from "lucide-react"
import ChartCard from "@/features/production-charts/components/ChartCard"
import type { MprDayAggregates } from "../types"

// ════════════════════════════════════════════════════════════════════════════
// MPR TABLE — Monthly Production Record
// ════════════════════════════════════════════════════════════════════════════
// Reproduces the legacy #mpr-table structure exactly:
//
//   [ Month Year ]  |  1  2  3  ...  daysInMonth
//   1ST SHIFT  PLAN | ...
//   1ST SHIFT ACTUAL|
//   2ND SHIFT  PLAN |
//   2ND SHIFT ACTUAL|
//   3RD SHIFT  PLAN |
//   3RD SHIFT ACTUAL|
//   TOTAL P.        |
//   TOTAL A.        |
//   EFF%            |
//   T.PLAN (running)|
//   T.ACTUAL (running)|
//   DIFF            |
//
// Rows mirror the color language of the exported Excel MPR production matrix:
// deep-blue header, pale-green PLAN, very-light-blue ACTUAL, medium-light-blue
// TOTAL/RUNNING rows, pale-amber EFF%, pale-red DIFF, restrained blue-gray
// shift labels. Subdued and premium — no legacy harsh colors.

const HEADER_BG = "#005B96"   // deep NXPERT blue
const PLAN_BG = "#EAF5E8"     // very subtle pale green
const PLAN_TX = "#15803D"     // PLAN text / value green
const ACTUAL_BG = "#F1F6FA"   // very light blue / neutral
const FG_BG = "#E8F5E9"       // light green for FG
const FG_TX = "#2E7D32"       // FG text green
const TOTAL_BG = "#DCEAF5"    // TOTAL P. / TOTAL A. / T.PLAN
const RUN_ACT_BG = "#D3E4F1"  // T.ACTUAL (slightly stronger light blue)
const EFF_BG = "#FFF1D6"      // pale amber
const DIFF_BG = "#FDECEC"     // very subtle light red
const DIFF_NEG_TX = "#B42323" // negative DIFF value red
const SHIFT_BG = "#D9E4F0"    // restrained blue-gray shift label
const GRID = "#B7C9D8"        // subtle blue-gray border

function fmt(v: number): string {
  return v.toLocaleString()
}

export default function MprTable({
  agg,
  monthYearString,
  showFg = false,
  wipLabel = "WIP",
}: {
  agg: MprDayAggregates
  monthYearString: string
  showFg?: boolean
  wipLabel?: string
}) {
  const { dateRange } = agg
  const showRunning = agg.tPlan > 0 || agg.tActual > 0

  const cellCls =
    "border px-2 py-1.5 text-center text-[11px] tabular-nums whitespace-nowrap"
  const labelCls =
    "border px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap text-left"
  const rowLabelCls =
    "border px-3 py-1.5 font-bold whitespace-nowrap text-left"

  const renderDayRow = (
    values: number[],
    bg: string,
    textColor?: string,
  ) => (
    <>
      {dateRange.map((day, i) => (
        <td
          key={day}
          className={cellCls}
          style={{
            background: bg,
            borderColor: GRID,
            ...(textColor ? { color: textColor } : {}),
          }}
        >
          {fmt(values[i])}
        </td>
      ))}
    </>
  )

  return (
    <ChartCard
      title="Daily Production Record"
      subtitle={monthYearString}
      icon={Table2}
    >
      <div className="relative overflow-hidden rounded-xl border border-border/60">
        {/* Horizontal scroll viewport — only the content scrolls, corners stay rounded */}
        <div className="mpr-scroll overflow-x-auto overflow-y-hidden max-h-[520px] overscroll-contain">
          <table className="border-collapse min-w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th
                  colSpan={2}
                  className="border px-3 py-2.5 text-center text-sm font-bold"
                  style={{ background: HEADER_BG, borderColor: GRID, color: "#fff" }}
                >
                  {monthYearString}
                </th>
                {dateRange.map((day) => (
                  <th
                    key={day}
                    className="border px-2 py-2.5 text-center text-[11px] font-bold text-white"
                    style={{ background: HEADER_BG, borderColor: GRID }}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 1ST SHIFT */}
              <tr>
                <td rowSpan={showFg ? 3 : 2} className={rowLabelCls} style={{ background: SHIFT_BG, borderColor: GRID, color: "#1e3a5f" }}>
                  1ST SHIFT
                </td>
                <td className={labelCls} style={{ background: PLAN_BG, borderColor: GRID, color: PLAN_TX }}>PLAN</td>
                {renderDayRow(agg.planDataShift1, PLAN_BG, PLAN_TX)}
              </tr>
              <tr>
                <td className={labelCls} style={{ background: ACTUAL_BG, borderColor: GRID }}>{wipLabel}</td>
                {renderDayRow(agg.actualDataShift1, ACTUAL_BG)}
              </tr>
              {showFg && (
              <tr>
                <td className={labelCls} style={{ background: FG_BG, borderColor: GRID, color: FG_TX }}>FG</td>
                {renderDayRow(agg.fgDataShift1, FG_BG, FG_TX)}
              </tr>
              )}

              {/* 2ND SHIFT */}
              <tr>
                <td rowSpan={showFg ? 3 : 2} className={rowLabelCls} style={{ background: SHIFT_BG, borderColor: GRID, color: "#1e3a5f" }}>
                  2ND SHIFT
                </td>
                <td className={labelCls} style={{ background: PLAN_BG, borderColor: GRID, color: PLAN_TX }}>PLAN</td>
                {renderDayRow(agg.planDataShift2, PLAN_BG, PLAN_TX)}
              </tr>
              <tr>
                <td className={labelCls} style={{ background: ACTUAL_BG, borderColor: GRID }}>{wipLabel}</td>
                {renderDayRow(agg.actualDataShift2, ACTUAL_BG)}
              </tr>
              {showFg && (
              <tr>
                <td className={labelCls} style={{ background: FG_BG, borderColor: GRID, color: FG_TX }}>FG</td>
                {renderDayRow(agg.fgDataShift2, FG_BG, FG_TX)}
              </tr>
              )}

              {/* 3RD SHIFT */}
              <tr>
                <td rowSpan={showFg ? 3 : 2} className={rowLabelCls} style={{ background: SHIFT_BG, borderColor: GRID, color: "#1e3a5f" }}>
                  3RD SHIFT
                </td>
                <td className={labelCls} style={{ background: PLAN_BG, borderColor: GRID, color: PLAN_TX }}>PLAN</td>
                {renderDayRow(agg.planDataShift3, PLAN_BG, PLAN_TX)}
              </tr>
              <tr>
                <td className={labelCls} style={{ background: ACTUAL_BG, borderColor: GRID }}>{wipLabel}</td>
                {renderDayRow(agg.actualDataShift3, ACTUAL_BG)}
              </tr>
              {showFg && (
              <tr>
                <td className={labelCls} style={{ background: FG_BG, borderColor: GRID, color: FG_TX }}>FG</td>
                {renderDayRow(agg.fgDataShift3, FG_BG, FG_TX)}
              </tr>
              )}

              {/* Totals & Efficiency */}
              <tr>
                <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                <td className={labelCls} style={{ background: TOTAL_BG, borderColor: GRID }}>TOTAL P.</td>
                {renderDayRow(agg.totalPlannedData, TOTAL_BG)}
              </tr>
              <tr>
                <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                <td className={labelCls} style={{ background: TOTAL_BG, borderColor: GRID }}>TOTAL {wipLabel === "ACTUAL" ? "A." : "W."}</td>
                {renderDayRow(agg.totalActualData, TOTAL_BG)}
              </tr>
              {showFg && (
              <tr>
                <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                <td className={labelCls} style={{ background: FG_BG, borderColor: GRID, color: FG_TX }}>TOTAL FG</td>
                {renderDayRow(agg.totalFgData, FG_BG, FG_TX)}
              </tr>
              )}
              <tr>
                <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                <td className={labelCls} style={{ background: EFF_BG, borderColor: GRID }}>EFF%</td>
                {dateRange.map((day, i) => (
                  <td key={day} className={cellCls} style={{ background: EFF_BG, borderColor: GRID }}>
                    {agg.eff[i] ? `${agg.eff[i]}%` : "0"}
                  </td>
                ))}
              </tr>

              {showRunning && (
                <>
                  <tr>
                    <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                    <td className={labelCls} style={{ background: TOTAL_BG, borderColor: GRID }}>T.PLAN</td>
                    {renderDayRow(
                      agg.runningTotalPlannedData.map((v) => (v > 0 ? v : 0)),
                      TOTAL_BG,
                    )}
                  </tr>
                  <tr>
                    <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                    <td className={labelCls} style={{ background: RUN_ACT_BG, borderColor: GRID }}>T.{wipLabel}</td>
                    {renderDayRow(
                      agg.runningTotalActualData.map((v) => (v > 0 ? v : 0)),
                      RUN_ACT_BG,
                    )}
                  </tr>
                  {showFg && (
                  <tr>
                    <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                    <td className={labelCls} style={{ background: FG_BG, borderColor: GRID, color: FG_TX }}>T.FG</td>
                    {renderDayRow(
                      agg.runningTotalFgData.map((v) => (v > 0 ? v : 0)),
                      FG_BG,
                      FG_TX,
                    )}
                  </tr>
                  )}
                </>
              )}

              <tr>
                <td className={rowLabelCls} style={{ borderColor: GRID }}></td>
                <td className={labelCls} style={{ background: DIFF_BG, borderColor: GRID }}>DIFF</td>
                {dateRange.map((day, i) => (
                  <td
                    key={day}
                    className={cellCls}
                    style={{
                      background: DIFF_BG,
                      borderColor: GRID,
                      ...(agg.diff[i] < 0 ? { color: DIFF_NEG_TX } : {}),
                    }}
                  >
                    {fmt(agg.diff[i])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  )
}
