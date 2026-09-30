import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Factory } from "lucide-react"
import { formatNumber } from "../lib/format"
import type { LineSummary } from "../types"
import ChartCard from "./ChartCard"

function ByLineTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as { line: string; actual: number; share: number } | undefined
  if (!row) return null
  return (
    <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm px-3 py-2.5 shadow-lg text-xs space-y-1 min-w-[150px]">
      <p className="font-semibold text-foreground">{row.line}</p>
      <p className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Production</span>
        <span className="font-mono tabular-nums font-semibold text-foreground">{formatNumber(row.actual)}</span>
      </p>
      <p className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">% of total</span>
        <span className="font-mono tabular-nums font-semibold text-[#005B96]">
          {formatNumber(row.share)}%
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

export default function ProductionByLineChart({ data }: { data: LineSummary[] }) {
  const totalActual = data.reduce((s, d) => s + d.actual, 0)
  const sorted = data
    .filter((d) => d.actual > 0 || d.plan > 0)
    .map((d) => ({ ...d, share: totalActual > 0 ? Number(((d.actual / totalActual) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.actual - a.actual)

  return (
    <ChartCard
      title="Production by Line"
      subtitle="Yearly contribution by production line"
      icon={Factory}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={(v: number) => formatCompactTick(v)}
            />
            <YAxis
              type="category"
              dataKey="line"
              axisLine={false}
              tickLine={false}
              width={60}
              tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
            />
            <Tooltip cursor={{ fill: "#f1f5f9" }} content={<ByLineTooltip />} />
            <Bar dataKey="actual" name="Production" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {sorted.map((entry, i) => (
                <Cell key={entry.line} fill={i === 0 ? "#005B96" : i === 1 ? "#0284c7" : "#38bdf8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
