import { useState, useEffect, useCallback, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthField } from "@/components/ui/MonthField";
import { FilterField } from "@/components/ui/FilterField";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Search,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  Factory,
} from "lucide-react";
import { fetchYearlyAnalytics } from "../api";
import type { YearlyAnalyticsData } from "../types";
import { CHART_LINES } from "../types";
import KpiCards from "./KpiCards";
import YearlyPerformanceChart from "./YearlyPerformanceChart";
import ProductionByLineChart from "./ProductionByLineChart";
import TopProductsChart from "./TopProductsChart";
import PlanVsActualChart from "./PlanVsActualChart";
import StatusDonutChart from "./StatusDonutChart";
import LinePerformanceChart from "./LinePerformanceChart";
import ProductTable from "./ProductTable";

const YEARS = Array.from(
  { length: 11 },
  (_, i) => new Date().getFullYear() - 10 + i,
).reverse();

const EMPTY_DATA: YearlyAnalyticsData = {
  year: new Date().getFullYear(),
  summary: {
    totalPlan: 0,
    totalActual: 0,
    achievement: 0,
    variance: 0,
    wip: 0,
    ng: 0,
    fg: 0,
    lineCount: 0,
    productCount: 0,
  },
  byLine: [],
  byProduct: [],
  planVsActual: [],
  linePerformance: [],
  status: { wip: 0, ng: 0, fg: 0, total: 0 },
};

export default function ProductionChartsPage() {
  usePageTitle("Production Analytics");

  const defaultYear = new Date().getFullYear();

  // Temporary filter state — changing the controls updates these WITHOUT
  // triggering any request. Only Search copies them into the applied state.
  const [filterYear, setFilterYear] = useState(defaultYear);
  const [filterLine, setFilterLine] = useState("all");
  const [filterProductInput, setFilterProductInput] = useState("");

  // Applied filter state — the filters currently driving the dashboard.
  const [appliedYear, setAppliedYear] = useState(defaultYear);
  const [appliedLine, setAppliedLine] = useState("all");
  const [appliedProduct, setAppliedProduct] = useState("");

  const [data, setData] = useState<YearlyAnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);
    try {
      const result = await fetchYearlyAnalytics(
        appliedYear,
        { line: appliedLine, product: appliedProduct },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(true);
        setData(EMPTY_DATA);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [appliedYear, appliedLine, appliedProduct]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Search is the ONLY action that applies filters and loads data — one
  // intentional update to the applied state (single request).
  const handleSearch = useCallback(() => {
    setAppliedYear(filterYear);
    setAppliedLine(filterLine);
    setAppliedProduct(filterProductInput.trim());
  }, [filterYear, filterLine, filterProductInput]);

  // Reset restores defaults in both the temporary and applied state, then
  // reloads once via the applied-state effect.
  const handleReset = useCallback(() => {
    setFilterYear(defaultYear);
    setFilterLine("all");
    setFilterProductInput("");
    setAppliedYear(defaultYear);
    setAppliedLine("all");
    setAppliedProduct("");
  }, [defaultYear]);

  const hasData =
    data.summary.totalActual > 0 ||
    data.summary.totalPlan > 0 ||
    data.byProduct.length > 0;

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="pc-grid"
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
            </defs>
            <rect width="100%" height="100%" fill="url(#pc-grid)" />
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
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-inner">
              <img
                src="/plan.png"
                alt="Production Analytics"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              Production Analytics
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Yearly production performance and output analysis
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <BarChart3 className="h-3 w-3" />
                Yearly Analytics
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <CalendarDays className="h-3 w-3" />
                {appliedYear}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                {CHART_LINES.find((l) => l.value === appliedLine)?.label ??
                  "All Lines"}
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

      {/* ── Filters ────────────────────────────────────── */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_auto] lg:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Year
              </label>
              <MonthField>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(Number(e.target.value))}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors hover:border-slate-300"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </MonthField>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Production Line
              </label>
              <FilterField icon={Factory}>
                <select
                  value={filterLine}
                  onChange={(e) => setFilterLine(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors hover:border-slate-300"
                >
                  {CHART_LINES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Product
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  value={filterProductInput}
                  onChange={(e) => setFilterProductInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder="Search product code…"
                  className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors hover:border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:col-span-2 sm:justify-end lg:col-span-1">
              <Button
                className="h-10 rounded-xl shadow-sm gap-2 bg-[#005B96] hover:bg-[#005B96]/90 text-white"
                onClick={handleSearch}
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button
                variant="outline"
                className="group h-10 rounded-xl gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Loading ────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] w-full rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="rounded-2xl border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-44 mb-3" />
                  <Skeleton className="h-[240px] w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : error ? (
        /* ── Error state ─────────────────────────────── */
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Unable to load production analytics
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-5">
              Something went wrong while loading data for {appliedYear}. Please
              try again.
            </p>
            <Button
              className="gap-2 bg-[#005B96] hover:bg-[#005B96]/90 text-white"
              onClick={() => load()}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !hasData ? (
        /* ── Empty state ─────────────────────────────── */
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              No production data available
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              There's no production data available for {appliedYear}.
              {appliedLine !== "all" || appliedProduct
                ? " Try adjusting the filters."
                : ""}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── KPI Cards ─────────────────────────────── */}
          <KpiCards summary={data.summary} />

          {/* ── Charts ────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <YearlyPerformanceChart
              year={appliedYear}
              line={appliedLine}
              product={appliedProduct}
            />
            <PlanVsActualChart data={data.byLine} />
            <ProductionByLineChart data={data.byLine} />
            <LinePerformanceChart data={data.byLine} />
            <TopProductsChart data={data.byProduct} />
            <StatusDonutChart status={data.status} />
          </div>

          {/* ── Product Detail Table ──────────────────── */}
          <ProductTable data={data.byProduct} />
        </>
      )}
    </div>
  );
}
