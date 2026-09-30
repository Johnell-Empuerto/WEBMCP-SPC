import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts"
import { TrendingUp } from "lucide-react"
import { formatNumber } from "../lib/format"
import type { LineSummary } from "../types"
import ChartCard from "./ChartCard"

function VarianceTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as LineSummary | undefined
  if (!row) return null
  return (
    <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm px-3 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[170px]">
      <p className="font-semibold text-foreground">{row.line}</p>
      <p className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Planned</span>
        <span className="font-mono tabular-nums font-semibold text-slate-600">{formatNumber(row.plan)}</span>
      </p>
      <p className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Actual</span>
        <span className="font-mono tabular-nums font-semibold text-amber-600">{formatNumber(row.actual)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 border-t border-border/60 pt-1.5">
        <span className="text-muted-foreground">Variance</span>
        <span
          className={`font-mono tabular-nums font-semibold ${row.variance >= 0 ? "text-emerald-600" : "text-red-600"}`}
        >
          {row.variance >= 0 ? "+" : ""}
          {formatNumber(row.variance)}
        </span>
      </p>
    </div>
  )
}

function formatCompactTick(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return formatNumber(n)
}

export default function PlanVsActualChart({ data }: { data: LineSummary[] }) {
  const hasData = data.some((d) => d.plan > 0 || d.actual > 0)
  return (
    <ChartCard
      title="Plan vs Actual"
      subtitle="Production variance per line (positive = above plan)"
      icon={TrendingUp}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
            <XAxis
              dataKey="line"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={(v: number) => formatCompactTick(v)}
              width={70}
            />
            <Tooltip cursor={{ fill: "#f1f5f9" }} content={<VarianceTooltip />} />
            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
            <Bar dataKey="variance" name="Variance" radius={[4, 4, 4, 4]} maxBarSize={26}>
              {data.map((d) => (
                <Cell key={d.line} fill={d.variance >= 0 ? "#16a34a" : "#dc2626"} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!hasData && (
        <p className="text-center text-xs text-muted-foreground py-8">No plan/actual data for the selected year.</p>
      )}
    </ChartCard>
  )
}
