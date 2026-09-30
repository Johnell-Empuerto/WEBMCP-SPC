import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Layers } from "lucide-react"
import { formatCompact, formatNumber, CHART_COLORS } from "../lib/format"
import type { StatusSummary } from "../types"
import ChartCard from "./ChartCard"

function StatusTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as { name: string; value: number; color: string } | undefined
  if (!row) return null
  return (
    <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm px-3 py-2.5 shadow-lg text-xs space-y-1">
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        <span className="h-2 w-2 rounded-sm" style={{ background: row.color }} />
        {row.name}
      </p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Quantity</span>
        <span className="font-mono tabular-nums font-semibold text-foreground">{formatNumber(row.value)}</span>
      </p>
    </div>
  )
}

export default function StatusDonutChart({ status }: { status: StatusSummary }) {
  const data = [
    { name: "WIP", value: status.wip, color: CHART_COLORS.wip },
    { name: "NG", value: status.ng, color: CHART_COLORS.ng },
    { name: "FG", value: status.fg, color: CHART_COLORS.fg },
  ]
  const total = data.reduce((s, d) => s + d.value, 0)
  const totalFromStatus = status.total

  return (
    <ChartCard
      title="Production Status"
      subtitle="WIP · NG · FG distribution"
      icon={Layers}
      className="lg:col-span-2"
    >
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-16">
        {/* Donut */}
        <div className="relative h-[240px] w-full max-w-[280px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<StatusTooltip />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="66%"
                outerRadius="90%"
                paddingAngle={3}
                cornerRadius={6}
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} fillOpacity={0.9} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Total Production
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-foreground leading-tight">
              {formatCompact(totalFromStatus)}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground/60">
              {formatNumber(totalFromStatus)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full max-w-[420px] space-y-3">
          {data.map((d) => {
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0"
            return (
              <div
                key={d.name}
                className="rounded-xl border border-border/50 bg-slate-50/60 dark:bg-slate-800/20 px-4 py-3 transition-colors duration-150 hover:bg-slate-50/90 dark:hover:bg-slate-800/35"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5 font-semibold text-foreground">
                    <span className="h-3 w-3 rounded-md" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {formatNumber(d.value)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/50">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: d.color }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono tabular-nums text-xs text-muted-foreground/70">
                    {pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ChartCard>
  )
}
