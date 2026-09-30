import { useMemo, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber } from "../lib/format"
import type { ProductSummary } from "../types"
import ChartCard from "./ChartCard"

function ProductsTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as (ProductSummary & { share: number }) | undefined
  if (!row) return null
  return (
    <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm px-3 py-2.5 shadow-lg text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-foreground">{row.title || row.prodcode}</p>
      <p className="text-[10px] font-mono text-muted-foreground/70">{row.prodcode}</p>
      {row.line && (
        <p className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Line</span>
          <span className="font-semibold text-foreground">{row.line}</span>
        </p>
      )}
      <p className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Production</span>
        <span className="font-mono tabular-nums font-semibold text-foreground">{formatNumber(row.actual)}</span>
      </p>
      <p className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">% of total</span>
        <span className="font-mono tabular-nums font-semibold text-[#005B96]">{formatNumber(row.share)}%</span>
      </p>
    </div>
  )
}

const TOP_OPTIONS = [
  { label: "Top 10", value: 10 },
  { label: "Top 20", value: 20 },
  { label: "All", value: 0 },
]

const RANK_COLORS = ["#005B96", "#0284c7", "#38bdf8", "#7dd3fc", "#bae6fd"]

function formatCompactTick(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return formatNumber(n)
}

export default function TopProductsChart({ data }: { data: ProductSummary[] }) {
  const [top, setTop] = useState(10)
  const totalActual = data.reduce((s, d) => s + d.actual, 0)
  const sliced = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.actual - a.actual)
    return (top === 0 ? sorted : sorted.slice(0, top)).map((d) => ({
      ...d,
      share: totalActual > 0 ? Number(((d.actual / totalActual) * 100).toFixed(1)) : 0,
    }))
  }, [data, top, totalActual])

  // Keep the axis readable — never render hundreds of overlapping labels.
  const tickInterval = sliced.length > 15 ? Math.ceil(sliced.length / 15) : 0

  return (
    <ChartCard
      title="Top Products"
      subtitle={top === 0 ? "All products ranked by production" : `Top ${top} products by production`}
      icon={Package}
      action={
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 p-0.5">
          {TOP_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setTop(opt.value)}
              className={cn(
                "px-2 py-1 text-[10px] font-semibold rounded-md transition-all duration-150",
                top === opt.value
                  ? "bg-white dark:bg-slate-700 shadow-sm text-[#005B96] dark:text-sky-300"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sliced} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
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
              dataKey="title"
              axisLine={false}
              tickLine={false}
              width={150}
              interval={tickInterval}
              tick={{ fontSize: 10, fill: "#475569", fontWeight: 500 }}
              tickFormatter={(v: string) => (v.length > 24 ? `${v.slice(0, 23)}…` : v)}
            />
            <Tooltip cursor={{ fill: "#f1f5f9" }} content={<ProductsTooltip />} />
            <Bar dataKey="actual" name="Production" radius={[0, 6, 6, 0]} maxBarSize={18}>
              {sliced.map((entry, i) => (
                <Cell key={entry.prodcode} fill={RANK_COLORS[i % RANK_COLORS.length]} fillOpacity={0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {sliced.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">No product data for the selected year.</p>
      )}
    </ChartCard>
  )
}
