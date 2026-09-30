import { ClipboardX } from "lucide-react"
import ChartCard from "@/features/production-charts/components/ChartCard"
import { formatNumber } from "@/lib/formatters"
import type { MprNgDetailRow } from "../types"
import { formatMprDate } from "../lib/aggregate"
import { getStatusLabel, isActiveStatus, ACTIVE_STATUS_BADGE, DEFAULT_STATUS_BADGE } from "@/lib/status"

// ════════════════════════════════════════════════════════════════════════════
// NG DETAILS TABLE
// ════════════════════════════════════════════════════════════════════════════
// Reproduces the legacy #details-table: DATE / MODEL / DIE NO. / SHIFT /
// PROBLEM / CAUSE / ACTION / COUNTERMEASURES / PIC / DOWN TIME / STATUS.
// CAUSE onward were editable inputs in the legacy view — preserved here.

const HEADERS = [
  "DATE",
  "MODEL",
  "DIE NO.",
  "SHIFT",
  "PROBLEM",
  "CAUSE",
  "ACTION",
  "COUNTERMEASURES",
  "PIC",
  "DOWN TIME",
  "STATUS",
]

export default function NgDetailsTable({ rows }: { rows: MprNgDetailRow[] }) {
  return (
    <ChartCard
      title="NG Details"
      subtitle="Defective items for the selected period"
      icon={ClipboardX}
    >
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-3">
            <ClipboardX className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">No NG data available</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            No defective (NG) items were recorded for the selected Machine, Model, and Month.
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border/60">
          <div className="ng-scroll overflow-x-auto overflow-y-auto max-h-[420px] overscroll-contain">
            <table className="border-collapse min-w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  {HEADERS.map((h) => (
                    <th
                      key={h}
                      className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 text-center text-[11px] font-bold text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.uniqueId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center whitespace-nowrap tabular-nums">
                      {formatMprDate(t.DateNo)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center whitespace-nowrap font-medium">
                      {t.ProductCode}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center whitespace-nowrap">
                      {t.DieNo}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center whitespace-nowrap">
                      {t.Shift}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center min-w-[140px]">
                      {t.Dfm_DefectDesc}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 p-0">
                      <input
                        type="text"
                        defaultValue={t.Cause}
                        className="w-full bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground/40"
                        placeholder=""
                      />
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 p-0">
                      <input
                        type="text"
                        defaultValue={t.Action}
                        className="w-full bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground/40"
                        placeholder=""
                      />
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 p-0">
                      <input
                        type="text"
                        defaultValue={t.Countermeasures}
                        className="w-full bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground/40"
                        placeholder=""
                      />
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 p-0">
                      <input
                        type="text"
                        defaultValue={t.PIC}
                        className="w-full bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground/40"
                        placeholder=""
                      />
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 p-0">
                      <input
                        type="text"
                        defaultValue={t.DownTime}
                        className="w-full bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground/40"
                        placeholder=""
                      />
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${isActiveStatus(t.Dfm_status) ? ACTIVE_STATUS_BADGE : DEFAULT_STATUS_BADGE}`}>
                        {getStatusLabel(t.Dfm_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>
            {formatNumber(rows.length)} NG record{rows.length === 1 ? "" : "s"}
          </span>
          <span>NG Qty: {formatNumber(rows.reduce((s, r) => s + r.Total_NG, 0))}</span>
        </div>
      )}
    </ChartCard>
  )
}
