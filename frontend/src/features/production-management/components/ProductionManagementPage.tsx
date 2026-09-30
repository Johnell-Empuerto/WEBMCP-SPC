import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterField } from "@/components/ui/FilterField";
import {
  Search,
  FilterX,
  ClipboardList,
  Factory,
  CalendarDays,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import {
  fetchProductDetails,
  fetchCalendarEvents,
  fetchMonthlySummary,
} from "@/features/production-management/api";
import type {
  ProductDetail,
  ProductionFilters,
  CalendarEvent as CalendarEventType,
  MonthlySummary,
} from "@/features/production-management/types";
import ProductionCalendar from "@/features/production-management/components/ProductionCalendar";
import ProductionDetailsDialog from "@/features/production-management/components/ProductionDetailsDialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ComponentType } from "react";

const LINES = [
  { value: "0", label: "All Lines" },
  { value: "1", label: "ADC Line 1" },
  { value: "2", label: "ADC Line 2" },
  { value: "3", label: "ADC Line 3" },
  { value: "4", label: "Machining (C4) Line" },
  { value: "5", label: "Palletizing (KD) Line" },
];

const CHART_COLORS = {
  plan: "#52525b", // zinc-600
  actual: "#d97706", // amber-600
};

function getLineLabel(line: string): string {
  return LINES.find((l) => l.value === line)?.label ?? "All Lines";
}

// ── Premium chart helpers (matches the Production Analytics look) ──

interface MonthlyPlanActual {
  name: string;
  plan: number;
  actual: number;
}

function formatCompactTick(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return formatNumber(n);
}

function achievementTextColor(achievement: number): string {
  if (achievement >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (achievement >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function PlanActualTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as MonthlyPlanActual | undefined;
  if (!row) return null;

  const achievement = row.plan > 0 ? (row.actual / row.plan) * 100 : null;

  return (
    <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[170px]">
      <p className="font-semibold text-foreground pb-0.5">{row.name}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{
                background:
                  entry.dataKey === "plan"
                    ? CHART_COLORS.plan
                    : CHART_COLORS.actual,
              }}
            />
            {entry.name}
          </span>
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {formatNumber(Number(entry.value ?? 0))}
          </span>
        </p>
      ))}
      {achievement != null && (
        <p className="flex items-center justify-between gap-4 border-t border-border/60 pt-1.5">
          <span className="text-muted-foreground">Achievement</span>
          <span
            className={`font-mono tabular-nums font-semibold ${achievementTextColor(achievement)}`}
          >
            {formatCompactTick(achievement)}%
          </span>
        </p>
      )}
    </div>
  );
}

interface PremiumKpiProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  subLabel: string;
  tile: string;
  value: string;
  exact: string;
  valueClass: string;
}

function PremiumKpi({
  icon: Icon,
  label,
  subLabel,
  tile,
  value,
  exact,
  valueClass,
}: PremiumKpiProps) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm px-4 py-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group">
      <div className="flex items-center justify-between gap-2">
        <div
          className={`flex items-center justify-center h-9 w-9 rounded-xl ${tile} shrink-0 transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 text-right leading-tight">
          {label}
        </span>
      </div>
      <div
        className={`mt-3 text-2xl font-bold font-mono tabular-nums leading-none ${valueClass}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground/80 font-medium truncate">
        {exact}
        <span className="text-muted-foreground/50 font-normal">
          {" "}
          · {subLabel}
        </span>
      </div>
    </Card>
  );
}

export default function ProductionManagementPage() {
  usePageTitle("Production Management");

  const today = new Date().toISOString().split("T")[0];
  const [currentDate, setCurrentDate] = useState(today);
  const [filters, setFilters] = useState<ProductionFilters>({
    line: "0",
    machine: "",
  });
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // ── Data Loading ──

  const loadProductDetails = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await fetchProductDetails(currentDate, filters);
      setProducts(data);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [currentDate, filters]);

  const loadCalendarEvents = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCalendarLoading(true);
    try {
      // Calendar events cover the whole visible month, so key the request on the
      // month of viewDate only — clicking a day (currentDate change) must NOT
      // reload the entire month's events. This avoids a duplicate full scan per click.
      const viewMonth = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-01`;
      const data = await fetchCalendarEvents(
        viewMonth,
        filters,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setEvents(data);
      }
    } catch {
      if (!controller.signal.aborted) {
        setEvents([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setCalendarLoading(false);
      }
    }
  }, [viewDate, filters]);

  // The monthly-summary endpoint only uses the YEAR of the date, so key the fetch
  // on the year — navigating between months of the same year must not refetch.
  const selectedYear = useMemo(
    () => Number(currentDate.substring(0, 4)) || new Date().getFullYear(),
    [currentDate],
  );

  const loadMonthlySummaryByYear = useCallback(
    async (year: number) => {
      setMonthlyLoading(true);
      try {
        const data = await fetchMonthlySummary(`${year}-01-01`, filters);
        setMonthlyData(data);
      } catch {
        setMonthlyData([]);
      } finally {
        setMonthlyLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    loadProductDetails();
  }, [loadProductDetails]);

  useEffect(() => {
    loadCalendarEvents();
    return () => abortRef.current?.abort();
  }, [loadCalendarEvents]);

  useEffect(() => {
    loadMonthlySummaryByYear(selectedYear);
  }, [loadMonthlySummaryByYear, selectedYear]);

  // ── Navigation ──

  const handlePrevMonth = useCallback(() => {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      const firstOfMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      setCurrentDate(firstOfMonth);
      return d;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      const firstOfMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      setCurrentDate(firstOfMonth);
      return d;
    });
  }, []);

  const handleToday = useCallback(() => {
    setViewDate(new Date());
    setCurrentDate(today);
  }, [today]);

  const handleSelectDate = useCallback((dateStr: string) => {
    setCurrentDate(dateStr);
  }, []);

  const handleEventClick = useCallback(
    (event: CalendarEventType) => {
      if (event.type === "actual") {
        const detailDate = event.start
          ? event.start.substring(0, 10)
          : currentDate;
        setDialogDate(detailDate);
        setDialogOpen(true);
      }
    },
    [currentDate],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({ line: "0", machine: "" });
    setCurrentDate(today);
  }, [today]);

  // ── Derived Data ──

  const totals = useMemo(
    () => (products.length > 0 ? products[products.length - 1] : null),
    [products],
  );
  const productRows = useMemo(
    () => (products.length > 0 ? products.slice(0, -1) : []),
    [products],
  );

  // Chart data — 12 months (Jan..Dec) of the selected year with Plan + Actual
  const chartData = useMemo(() => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return monthNames.map((name, i) => {
      const item = monthlyData.find((m) => m.month === i + 1);
      return {
        name,
        plan: item?.planqty ?? 0,
        actual: item?.actqty ?? 0,
      } as MonthlyPlanActual;
    });
  }, [monthlyData]);

  // Year totals — sum all 12 months of the selected year so the KPI cards match
  // the monthly (Jan..Dec) chart instead of the selected month only.
  const yearTotals = useMemo(() => {
    const plan = monthlyData.reduce(
      (sum, m) => sum + (Number(m.planqty) || 0),
      0,
    );
    const actual = monthlyData.reduce(
      (sum, m) => sum + (Number(m.actqty) || 0),
      0,
    );
    const achievement = plan > 0 ? (actual / plan) * 100 : 0;
    return { plan, actual, difference: actual - plan, achievement };
  }, [monthlyData]);

  const lineLabel = getLineLabel(filters.line || "0");

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ──────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10"
        style={{ minHeight: 120 }}
      >
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="bp-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
              <pattern
                id="bp-dots"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bp-grid)" />
            <rect width="100%" height="100%" fill="url(#bp-dots)" />
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
            <line
              x1="100%"
              y1="0"
              x2="0"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
          </svg>
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent animate-pulse-slow" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-inner">
              <img
                src="/plan.png"
                alt="Production Planning"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              Production Management
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Production Planning &amp; Actual Monitoring
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Factory className="h-3 w-3" />
                {lineLabel}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <CalendarDays className="h-3 w-3" />
                {new Date(currentDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <div className="flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-sm border border-white/20">
              <img
                src="/logo_npax.png"
                alt="ISUZU"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ── Left Panel ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* ════════════════════════════════════════
              FILTER OPTIONS CARD
              ════════════════════════════════════════ */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 px-5 pt-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-foreground">
                    Filter Options
                  </span>
                  <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                    Configure production filters
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 px-5 pb-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Production Line
                </label>
                <FilterField icon={Factory}>
                  <select
                    value={filters.line}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, line: e.target.value }))
                    }
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                      transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    {LINES.map((line) => (
                      <option key={line.value} value={line.value}>
                        {line.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Product Alias Code
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter product alias code..."
                    value={filters.machine || ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        machine: e.target.value,
                      }))
                    }
                    className="flex h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3.5 py-2.5 text-sm shadow-sm
                      placeholder:text-muted-foreground/40
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 focus-visible:border-[#005B96]
                      transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
                    maxLength={30}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <Button
                  size="default"
                  className="flex-1 h-11 rounded-xl shadow-sm gap-2 bg-[#005B96] hover:bg-[#005B96]/90 text-white"
                  onClick={loadProductDetails}
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  className="group flex-1 h-11 rounded-xl gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
                  onClick={handleReset}
                >
                  <FilterX className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ════════════════════════════════════════
              PRODUCT DETAILS CARD
              ════════════════════════════════════════ */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <span>Product Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {productsLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-xl" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium">
                    No available plan to view
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground/60">
                    Select a date and click Search
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-border">
                        <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-3 px-5">
                          Product
                        </th>
                        <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-3 px-4">
                          Plan
                        </th>
                        <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-3 px-4">
                          Actual
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Summary "All" row */}
                      {totals && (
                        <tr
                          className="border-b border-border/60 bg-slate-50/80 dark:bg-slate-800/30 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/30"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, machine: "" }))
                          }
                        >
                          <td className="py-3.5 px-5 font-semibold text-sm text-foreground">
                            All
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                            {formatNumber(totals.totplan ?? 0)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm font-semibold text-amber-600">
                            {formatNumber(totals.totact ?? 0)}
                          </td>
                        </tr>
                      )}
                      {/* Product rows */}
                      {productRows.map((item, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-border/20 transition-all duration-150 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              machine: item.remarks,
                            }))
                          }
                        >
                          <td className="py-3 px-5 text-sm font-medium text-foreground truncate max-w-[160px]">
                            <span className="truncate block">
                              {item.remarks}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 font-normal">
                              {item.prodcode}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-sm text-zinc-600 dark:text-zinc-400">
                            {formatNumber(item.pqty)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-sm font-medium text-amber-600">
                            {formatNumber(item.actqty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Panel: Calendar ──────────────── */}
        <div className="lg:col-span-8">
          <ProductionCalendar
            viewDate={viewDate}
            events={events}
            selectedDate={currentDate}
            today={today}
            lineLabel={lineLabel}
            loading={calendarLoading}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            onSelectDate={handleSelectDate}
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════
          PLAN VS. ACTUAL — Full Width Section
          ════════════════════════════════════════════ */}
      {!monthlyLoading && (
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-4 px-6 pt-6">
            <CardTitle className="text-base font-semibold flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="block text-base font-semibold text-foreground">
                  Plan vs. Actual
                </span>
                <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                  Production Summary
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {/* Premium KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <PremiumKpi
                icon={ClipboardList}
                label="Planned Production"
                subLabel="yearly plan"
                tile="bg-slate-500/10 text-slate-600 dark:text-slate-300"
                value={formatCompactTick(yearTotals.plan)}
                exact={formatNumber(yearTotals.plan)}
                valueClass="text-slate-700 dark:text-slate-300"
              />
              <PremiumKpi
                icon={BarChart3}
                label="Total Production"
                subLabel="yearly actual"
                tile="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                value={formatCompactTick(yearTotals.actual)}
                exact={formatNumber(yearTotals.actual)}
                valueClass="text-amber-600 dark:text-amber-400"
              />
              <PremiumKpi
                icon={TrendingUp}
                label="Achievement"
                subLabel="actual vs plan"
                tile="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                value={
                  yearTotals.plan > 0
                    ? `${formatCompactTick(yearTotals.achievement)}%`
                    : "—"
                }
                exact={
                  yearTotals.difference >= 0
                    ? `+${formatNumber(yearTotals.difference)}`
                    : formatNumber(yearTotals.difference)
                }
                valueClass={`${yearTotals.plan > 0 ? achievementTextColor(yearTotals.achievement) : "text-muted-foreground"}`}
              />
            </div>

            {/* Bar Chart — Monthly (Jan..Dec) */}
            <div className="rounded-xl border border-border/40 bg-white dark:bg-slate-900/50 p-4">
              {monthlyLoading ? (
                <div className="space-y-3 py-6">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
                      barGap={3}
                      barCategoryGap="22%"
                    >
                      <defs>
                        <linearGradient
                          id="pmPlanFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={CHART_COLORS.plan}
                            stopOpacity={0.95}
                          />
                          <stop
                            offset="100%"
                            stopColor={CHART_COLORS.plan}
                            stopOpacity={0.45}
                          />
                        </linearGradient>
                        <linearGradient
                          id="pmActualFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#f59e0b"
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor={CHART_COLORS.actual}
                            stopOpacity={0.65}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#eef2f7"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fill: "#64748b",
                          fontWeight: 500,
                        }}
                        dy={8}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickFormatter={(val: number) => formatCompactTick(val)}
                        width={70}
                      />
                      <Tooltip
                        cursor={{ fill: "#f8fafc", opacity: 0.6 }}
                        content={<PlanActualTooltip />}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                      />
                      <Bar
                        dataKey="plan"
                        name="Plan"
                        fill="url(#pmPlanFill)"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={18}
                        animationBegin={0}
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                      <Bar
                        dataKey="actual"
                        name="Actual"
                        fill="url(#pmActualFill)"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={18}
                        animationBegin={120}
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Production Details Dialog ── */}
      <ProductionDetailsDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        date={dialogDate}
        filters={filters}
        lineLabel={lineLabel}
      />

      {/* ── Animations ──────────────────────────── */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.15; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
