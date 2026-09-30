import { Gauge } from "lucide-react"
import { formatCompact, formatNumber } from "../lib/format"
import type { LineSummary } from "../types"
import ChartCard from "./ChartCard"
import { achievementBarColor, achievementTextColor } from "../lib/format"

export default function LinePerformanceChart({ data }: { data: LineSummary[] }) {
  const ranked = data
    .filter((d) => d.plan > 0 || d.actual > 0)
    .sort((a, b) => b.achievement - a.achievement)
    .slice(0, 8)

  const maxBar = Math.max(...ranked.map((d) => Math.min(d.achievement, 100)), 1)

  return (
    <ChartCard title="Line Performance" subtitle="Achievement ranking by production line" icon={Gauge}>
      <div className="space-y-3 pt-1">
        {ranked.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No performance data for the selected year.</p>
        )}
        {ranked.map((d, i) => (
          <div key={d.line} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i === 0
                  ? "bg-emerald-500 text-white"
                  : i === 1
                    ? "bg-slate-300 text-slate-700"
                    : i === 2
                      ? "bg-amber-400 text-white"
                      : "bg-slate-100 text-muted-foreground dark:bg-slate-800"
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-foreground">{d.line}</span>
                <span className={`shrink-0 text-xs font-bold font-mono tabular-nums ${achievementTextColor(d.achievement)}`}>
                  {d.plan > 0 ? `${formatNumber(d.achievement)}%` : "—"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${achievementBarColor(d.achievement)}`}
                    style={{ width: `${Math.min(d.achievement, 100) > 0 ? (Math.min(d.achievement, 100) / maxBar) * 100 : 0}%` }}
                  />
                </div>
                <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground/70">
                  {formatCompact(d.actual)} / {formatCompact(d.plan)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
