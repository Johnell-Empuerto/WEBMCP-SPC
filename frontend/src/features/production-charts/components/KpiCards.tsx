import { BarChart3, ClipboardList, TrendingUp, Package, XCircle, CheckCircle2 } from "lucide-react"
import type { ComponentType } from "react"
import { Card } from "@/components/ui/card"
import { formatCompact, formatNumber, formatPercent, achievementTextColor } from "../lib/format"
import type { YearlySummary } from "../types"

interface KpiDef {
  key: keyof YearlySummary
  label: string
  subLabel: string
  icon: ComponentType<{ className?: string }>
  tile: string
  value: string
  exact: string
  valueClass: string
}

function buildKpis(s: YearlySummary): KpiDef[] {
  const achievement = s.totalPlan > 0 ? s.achievement : 0
  return [
    {
      key: "totalActual",
      label: "Total Production",
      subLabel: `${formatNumber(s.productCount)} products`,
      icon: BarChart3,
      tile: "bg-[#005B96]/10 text-[#005B96]",
      value: formatCompact(s.totalActual),
      exact: formatNumber(s.totalActual),
      valueClass: "text-[#005B96] dark:text-sky-400",
    },
    {
      key: "totalPlan",
      label: "Planned Production",
      subLabel: `${formatNumber(s.lineCount)} active lines`,
      icon: ClipboardList,
      tile: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
      value: formatCompact(s.totalPlan),
      exact: formatNumber(s.totalPlan),
      valueClass: "text-slate-700 dark:text-slate-300",
    },
    {
      key: "achievement",
      label: "Achievement",
      subLabel: "actual vs plan",
      icon: TrendingUp,
      tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      value: formatPercent(achievement),
      exact: s.totalPlan > 0 ? "of plan" : "no plan data",
      valueClass: achievementTextColor(achievement),
    },
    {
      key: "wip",
      label: "Total WIP",
      subLabel: "work in progress",
      icon: Package,
      tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      value: formatCompact(s.wip),
      exact: formatNumber(s.wip),
      valueClass: "text-sky-600 dark:text-sky-400",
    },
    {
      key: "ng",
      label: "Total NG",
      subLabel: "defects",
      icon: XCircle,
      tile: "bg-red-500/10 text-red-600 dark:text-red-400",
      value: formatCompact(s.ng),
      exact: formatNumber(s.ng),
      valueClass: "text-red-600 dark:text-red-400",
    },
    {
      key: "fg",
      label: "Total FG",
      subLabel: "finished goods",
      icon: CheckCircle2,
      tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      value: formatCompact(s.fg),
      exact: formatNumber(s.fg),
      valueClass: "text-emerald-600 dark:text-emerald-400",
    },
  ]
}

export default function KpiCards({ summary }: { summary: YearlySummary }) {
  const kpis = buildKpis(summary)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <Card
          key={kpi.key}
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
          <div className={`mt-3 text-2xl font-bold font-mono tabular-nums leading-none ${kpi.valueClass}`}>
            {kpi.value}
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground/80 font-medium truncate">
            {kpi.exact}
            <span className="text-muted-foreground/50 font-normal"> · {kpi.subLabel}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
