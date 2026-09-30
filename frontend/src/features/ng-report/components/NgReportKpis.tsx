import { ClipboardList, XCircle, AlertTriangle, Factory } from "lucide-react"
import type { ComponentType } from "react"
import { Card } from "@/components/ui/card"
import { formatNumber } from "@/lib/formatters"
import { LINE_LABELS } from "../types"
import type { NgReportSummary } from "../types"

interface KpiDef {
  label: string
  subLabel: string
  icon: ComponentType<{ className?: string }>
  tile: string
  value: string
  valueClass: string
  caption: string
}

function buildKpis(s: NgReportSummary): KpiDef[] {
  const affectedLine = s.mostAffectedLine
    ? LINE_LABELS[s.mostAffectedLine] ?? `Line ${s.mostAffectedLine}`
    : "—"
  return [
    {
      label: "Total NG Records",
      subLabel: "grouped defect rows",
      icon: ClipboardList,
      tile: "bg-[#005B96]/10 text-[#005B96] dark:text-sky-400",
      value: formatNumber(s.totalRecords),
      valueClass: "text-[#005B96] dark:text-sky-400",
      caption: `${formatNumber(s.totalRecords)} record${s.totalRecords === 1 ? "" : "s"}`,
    },
    {
      label: "Total NG Quantity",
      subLabel: "defective pieces",
      icon: XCircle,
      tile: "bg-red-500/10 text-red-600 dark:text-red-400",
      value: formatNumber(s.totalNgQty),
      valueClass: "text-red-600 dark:text-red-400",
      caption: "sum of defect qty",
    },
    {
      label: "Top NG Cause",
      subLabel: "highest NG qty",
      icon: AlertTriangle,
      tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      value: s.topCause || "—",
      valueClass: "text-amber-600 dark:text-amber-400",
      caption: "defect description",
    },
    {
      label: "Most Affected Line",
      subLabel: "highest NG qty",
      icon: Factory,
      tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      value: affectedLine,
      valueClass: "text-sky-600 dark:text-sky-400",
      caption: "production line",
    },
  ]
}

export default function NgReportKpis({ summary }: { summary: NgReportSummary }) {
  const kpis = buildKpis(summary)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          className="rounded-2xl border-border/60 shadow-sm px-4 py-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between gap-2">
            <div className={`flex items-center justify-center h-9 w-9 rounded-xl ${kpi.tile} shrink-0 transition-transform duration-200 group-hover:scale-105`}>
              <kpi.icon className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 text-right leading-tight">
              {kpi.label}
            </span>
          </div>
          <div className={`mt-3 text-2xl font-bold font-mono tabular-nums leading-none truncate ${kpi.valueClass}`} title={kpi.value}>
            {kpi.value}
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground/80 font-medium truncate">
            {kpi.caption}
            <span className="text-muted-foreground/50 font-normal"> · {kpi.subLabel}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}