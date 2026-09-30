import { useState, useEffect, useCallback, useRef } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { BarChart3, AlertTriangle, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { formatNumber } from "../lib/format"
import type { MonthlyTrendPoint } from "../types"
import { CHART_LINES } from "../types"
import { fetchMonthlyTrend } from "../api"
import ChartCard from "./ChartCard"

const CHART_COLORS = {
  plan: "#52525b",
  actual: "#d97706",
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as MonthlyTrendPoint | undefined
  if (!row) return null
  const achievement = row.plan > 0 ? formatNumber(row.achievement) : "—"
  return (
    <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-foreground pb-0.5">{row.label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{
                background: entry.dataKey === "plan" ? CHART_COLORS.plan : CHART_COLORS.actual,
              }}
            />
            {entry.name}
          </span>
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {formatNumber(Number(entry.value ?? 0))}
          </span>
        </p>
      ))}
      <p className="flex items-center justify-between gap-4 border-t border-border/60 pt-1.5 text-muted-foreground">
        <span>Achievement</span>
        <span
          className={`font-mono tabular-nums font-semibold ${
            row.plan > 0
              ? row.achievement >= 100
                ? "text-emerald-600"
                : row.achievement >= 80
                  ? "text-amber-600"
                  : "text-red-600"
              : "text-muted-foreground/60"
          }`}
        >
          {achievement}
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

interface YearlyPerformanceChartProps {
  year: number
  line: string
  product: string
}

export default function YearlyPerformanceChart({ year, line, product }: YearlyPerformanceChartProps) {
  const [trend, setTrend] = useState<MonthlyTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(false)
    try {
      const result = await fetchMonthlyTrend(year, line, product, controller.signal)
      if (!controller.signal.aborted) {
        setTrend(result)
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(true)
        setTrend([])
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [year, line, product])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const lineLabel = CHART_LINES.find((l) => l.value === line)?.label ?? "All Lines"
  const hasData = trend.some((t) => t.plan > 0 || t.actual > 0)

  return (
    <ChartCard
      title="Yearly Production Performance"
      subtitle={`Monthly Planned vs Actual trend · ${lineLabel}`}
      icon={BarChart3}
      className="lg:col-span-2"
    >
      {loading ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-[320px] w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="flex h-[340px] flex-col items-center justify-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Unable to load monthly trend</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 text-xs"
            onClick={() => load()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : !hasData ? (
        <div className="flex h-[340px] flex-col items-center justify-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold text-foreground">No monthly production data</p>
          <p className="text-xs text-muted-foreground mt-1">
            No planned/actual trend available for {year} · {lineLabel}.
          </p>
        </div>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.actual} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART_COLORS.actual} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="planFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.plan} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={CHART_COLORS.plan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                dy={8}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v: number) => formatCompactTick(v)}
                width={70}
              />
              <Tooltip cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} content={<TrendTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              <Area
                type="monotone"
                dataKey="plan"
                name="Planned"
                stroke={CHART_COLORS.plan}
                strokeWidth={2}
                fill="url(#planFill)"
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke={CHART_COLORS.actual}
                strokeWidth={2.5}
                fill="url(#actualFill)"
                dot={false}
                activeDot={{ r: 4.5 }}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
