import { useMemo } from "react"
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { BarChart3 } from "lucide-react"
import ChartCard from "@/features/production-charts/components/ChartCard"
import { formatNumber } from "@/lib/formatters"
import type { MprDayAggregates } from "../types"

// ════════════════════════════════════════════════════════════════════════════
// MPR ADC — CHART (PREMIUM SaaS PRESENTATION)
// ════════════════════════════════════════════════════════════════════════════
// Presentation-only redesign. The DATA is untouched — every series below is
// computed from the exact same MprDayAggregates produced by the legacy-math
// in lib/aggregate.ts:
//
//   Actual (stacked bars, EON blue family)   → actualDataShift1/2/3
//   Planned (light slate bars)               → planDataShift1/2/3
//   Running Actual (dominant blue line)      → runningTotalActualData
//   Running Planned (secondary muted line)   → runningTotalPlannedData
//
// Visual hierarchy: Running Actual → Running Planned → Actual daily →
// Planned daily → individual shift breakdown.

// ── EON design-system palette ────────────────────────────────────────────
const PALETTE = {
  actual: "#005B96",
  plan: "#93C5FD",
  runningActual: "#003B63",
  runningPlan: "#0EA5A8",
  runningActualFill: "#003B63",
  actualShift1: "#005B96",
  actualShift2: "#F59E0B",
  actualShift3: "#7C3AED",
  planShift1: "#DBEAFE",
  planShift2: "#BFDBFE",
  planShift3: "#93C5FD",
  grid: "#eef2f7",
  tick: "#94a3b8",
}

// Compact axis ticks — "0 · 3K · 6K · 9K" instead of heavy raw numbers.
function formatTick(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ── Premium custom tooltip ────────────────────────────────────────────────
function MprTooltip({ active, payload, label, monthLabel }: any) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  if (!row) return null

  const Row = ({
    label: lbl,
    value,
    dot,
    strong,
  }: {
    label: string
    value: number
    dot?: string
    strong?: boolean
  }) => (
    <p className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {dot && <span className="inline-block h-2 w-2 rounded-[3px]" style={{ background: dot }} />}
        {lbl}
      </span>
      <span
        className={
          strong
            ? "font-mono tabular-nums font-bold text-[#005B96] dark:text-[#4fa3d8]"
            : "font-mono tabular-nums font-semibold text-foreground"
        }
      >
        {formatNumber(value)}
      </span>
    </p>
  )

  return (
    <div className="min-w-[230px] rounded-xl border border-slate-200/80 bg-background/95 backdrop-blur-sm px-4 py-3 shadow-lg dark:border-slate-700/80">
      <p className="text-xs font-bold text-foreground">
        {monthLabel || "Day"} {label}
      </p>
      <div className="mt-2.5 space-y-1.5">
        <Row label="Actual Production" value={row.actualTotal} dot={PALETTE.actual} strong />
        <Row label="Planned Production" value={row.planTotal} dot={PALETTE.plan} />
      </div>
      <div className="my-2 h-px bg-border/70" />
      <div className="space-y-1.5">
        <Row label="Running Actual" value={row.runningActual} dot={PALETTE.runningActual} strong />
        <Row label="Running Planned" value={row.runningPlan} dot={PALETTE.runningPlan} />
      </div>
      <div className="my-2 h-px bg-border/70" />
      <div className="space-y-1.5">
        <Row label="Shift 1" value={row.actualShift1} dot={PALETTE.actualShift1} />
        <Row label="Shift 2" value={row.actualShift2} dot={PALETTE.actualShift2} />
        <Row label="Shift 3" value={row.actualShift3} dot={PALETTE.actualShift3} />
      </div>
    </div>
  )
}

// ── Compact modern legend (replaces the heavy bottom legend) ──────────────
function MprLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: PALETTE.actual }} />
        Actual
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: PALETTE.plan }} />
        Planned
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-0.5 w-4 rounded-full" style={{ background: PALETTE.runningActual }} />
        Running Actual
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-0.5 w-4 rounded-full" style={{ background: PALETTE.runningPlan }} />
        Running Planned
      </span>
      <span className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.actualShift1 }} />
          S1
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.actualShift2 }} />
          S2
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.actualShift3 }} />
          S3
        </span>
        <span className="text-slate-400">· actual</span>
      </span>
    </div>
  )
}

// ── Compact context chips (Machine / Model / Period) ─────────────────────
function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[130px] rounded-xl border border-slate-200/70 bg-slate-50/80 px-3.5 py-2 dark:border-slate-700/60 dark:bg-slate-800/40">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold text-foreground truncate">{value}</div>
    </div>
  )
}

export default function MprChart({
  agg,
  machineName,
  modelName,
  monthYearString,
}: {
  agg: MprDayAggregates
  machineName: string
  modelName: string
  monthYearString: string
}) {
  const monthLabel = monthYearString.split(" ")[0] || "Day"

  const data = useMemo(
    () =>
      agg.dateRange.map((day, i) => ({
        day,
        actualShift1: agg.actualDataShift1[i],
        actualShift2: agg.actualDataShift2[i],
        actualShift3: agg.actualDataShift3[i],
        planShift1: agg.planDataShift1[i],
        planShift2: agg.planDataShift2[i],
        planShift3: agg.planDataShift3[i],
        runningActual: agg.runningTotalActualData[i],
        runningPlan: agg.runningTotalPlannedData[i],
        actualTotal: agg.totalActualData[i],
        planTotal: agg.totalPlannedData[i],
      })),
    [agg],
  )

  return (
    <ChartCard
      title="Chart Details"
      subtitle="Plan vs Actual Production Performance"
      icon={BarChart3}
    >
      {/* Context + legend row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-3">
          <ContextChip label="Machine" value={machineName} />
          <ContextChip label="Model" value={modelName} />
          <ContextChip label="Period" value={monthYearString || "—"} />
        </div>
        <div className="pt-1">
          <MprLegend />
        </div>
      </div>

      {/* Chart */}
      <div data-mpr-export-chart className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="mprRunningActualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PALETTE.runningActualFill} stopOpacity={0.14} />
                <stop offset="100%" stopColor={PALETTE.runningActualFill} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} vertical={false} />

            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: PALETTE.grid }}
              tick={{ fontSize: 11, fill: PALETTE.tick }}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={formatTick}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: PALETTE.tick }}
              width={42}
            />

            <Tooltip
              content={<MprTooltip monthLabel={monthLabel} />}
              cursor={{ fill: "rgba(0, 91, 150, 0.04)" }}
            />

            {/* Running-actual gradient fill — rendered FIRST so it sits
                behind the bars (bars stay crisp); the lines render last and
                stay on top. */}
            <Area
              type="monotone"
              dataKey="runningActual"
              stroke="none"
              fill="url(#mprRunningActualFill)"
              isAnimationActive
            />

            {/* Planned — light slate-blue stacked bars (secondary) */}
            <Bar dataKey="planShift1" stackId="plan" fill={PALETTE.planShift1} maxBarSize={9} />
            <Bar dataKey="planShift2" stackId="plan" fill={PALETTE.planShift2} maxBarSize={9} />
            <Bar dataKey="planShift3" stackId="plan" fill={PALETTE.planShift3} maxBarSize={9} />

            {/* Actual — EON blue stacked bars (dominant daily representation) */}
            <Bar dataKey="actualShift1" stackId="actual" fill={PALETTE.actualShift1} maxBarSize={9} />
            <Bar dataKey="actualShift2" stackId="actual" fill={PALETTE.actualShift2} maxBarSize={9} />
            <Bar dataKey="actualShift3" stackId="actual" fill={PALETTE.actualShift3} maxBarSize={9} />

            {/* Running totals — smooth cumulative lines (on top of everything) */}
            <Line
              type="monotone"
              dataKey="runningActual"
              stroke={PALETTE.runningActual}
              strokeWidth={3}
              dot={{ r: 2.5, fill: PALETTE.runningActual, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="runningPlan"
              stroke={PALETTE.runningPlan}
              strokeWidth={2}
              strokeDasharray="0"
              dot={{ r: 1.5, fill: PALETTE.runningPlan, strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
