import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthField } from "@/components/ui/MonthField";
import { FilterField } from "@/components/ui/FilterField";
import {
  Search,
  RotateCcw,
  Factory,
  CalendarDays,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Package,
  FileSpreadsheet,
  Cog,
  Box,
} from "lucide-react";
import { fetchMprKdData, fetchMprKdNgData } from "../api";
import type { MprKdNgRow, MprKdRow, MprNgDetailRow } from "../types";
import { MACHINES, MODELS } from "../types";
import { buildMprAggregates, buildNgDetailRows } from "../lib/aggregate";
import { exportMprToExcel } from "@/features/mpr-adc/lib/exportExcel";
// The KD screen is required to look IDENTICAL to the MPR ADC screen, so the
// three presentation components (chart, table, NG details) are shared with
// the MPR ADC feature. They only depend on the daily-aggregate / NG-row
// shapes, not on any ADC-specific data logic.
import MprChart from "@/features/mpr-adc/components/MprChart";
import MprTable from "@/features/mpr-adc/components/MprTable";
import NgDetailsTable from "@/features/mpr-adc/components/NgDetailsTable";

function getDefaultMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function MprKdPage() {
  usePageTitle("MPR Entry (KD)");

  const defaultMonth = getDefaultMonth();

  // ── Temporary filter state (control-bound, NO request on change) ─────────
  const [filterMonth, setFilterMonth] = useState(defaultMonth);
  const [filterMachine, setFilterMachine] = useState<string>("all");
  const [filterModel, setFilterModel] = useState<string>("all");

  // ── Applied filter state (drives the dashboard — only via Load/Reset) ────
  const [appliedMonth, setAppliedMonth] = useState(defaultMonth);
  const [appliedMachine, setAppliedMachine] = useState<string>("all");
  const [appliedModel, setAppliedModel] = useState<string>("all");

  const [collapse, setCollapse] = useState(true);

  // ── Data state ───────────────────────────────────────────────────────────
  const [dataRows, setDataRows] = useState<MprKdRow[]>([]);
  const [ngRows, setNgRows] = useState<MprKdNgRow[]>([]);
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
      const payload = {
        selectedDate: appliedMonth,
        selectedMachine: appliedMachine === "all" ? null : appliedMachine,
        selectedModel: appliedModel === "all" ? null : appliedModel,
      };
      const [data, ng] = await Promise.all([
        fetchMprKdData(payload, controller.signal),
        fetchMprKdNgData(payload, controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setDataRows(data);
        setNgRows(ng);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(true);
        setDataRows([]);
        setNgRows([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [appliedMonth, appliedMachine, appliedModel]);

  // Initial load on mount (dashboard not empty when first opened)
  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Load is the ONLY action that applies filters + loads data
  const handleLoad = useCallback(() => {
    setAppliedMonth(filterMonth);
    setAppliedMachine(filterMachine);
    setAppliedModel(filterModel);
  }, [filterMonth, filterMachine, filterModel]);

  // Reset restores the legacy defaults (current month, all machines, all models)
  const handleReset = useCallback(() => {
    setFilterMonth(defaultMonth);
    setFilterMachine("all");
    setFilterModel("all");
    setAppliedMonth(defaultMonth);
    setAppliedMachine("all");
    setAppliedModel("all");
  }, [defaultMonth]);

  const agg = useMemo(
    () => buildMprAggregates(dataRows, appliedMonth),
    [dataRows, appliedMonth],
  );
  const ngDetails: MprNgDetailRow[] = useMemo(
    () => buildNgDetailRows(ngRows),
    [ngRows],
  );

  const [monthName, year] = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(appliedMonth)) return ["", ""];
    const [y, m] = appliedMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return [d.toLocaleString("en-US", { month: "long" }), String(y)];
  }, [appliedMonth]);
  const monthYearString = monthName ? `${monthName} ${year}` : "";

  const machineName =
    appliedMachine === "all"
      ? "All Machines"
      : (MACHINES.find((m) => m.value === appliedMachine)?.name ??
        "All Machines");
  const modelName =
    appliedModel === "all"
      ? "All Models"
      : (MODELS.find((m) => m.value === appliedModel)?.name ?? "All Models");

  const hasData = dataRows.length > 0 || ngRows.length > 0;

  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportMprToExcel({
        reportTitle: "MPR Entry (KD)",
        fileName: `MPR_KD_${appliedMonth}.xlsx`,
        monthYearString,
        machineName,
        modelName,
        agg,
        ngDetails,
        showFg: true,
      });
    } finally {
      setExporting(false);
    }
  }, [
    appliedMonth,
    exporting,
    monthYearString,
    machineName,
    modelName,
    agg,
    ngDetails,
  ]);

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="mpr-kd-grid"
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
            <rect width="100%" height="100%" fill="url(#mpr-kd-grid)" />
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
                alt="Production Planning"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              MPR Entry (KD)
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Monthly Production Report for KD Line
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Factory className="h-3 w-3" />
                {machineName}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Package className="h-3 w-3" />
                {modelName}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <CalendarDays className="h-3 w-3" />
                {monthYearString || "— Select month —"}
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

      {/* ── Parameter Panel ─────────────────────────────── */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-4 px-5 pt-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
              <Settings className="h-4 w-4" />
            </div>
            <span>Parameter KD Line</span>
            <button
              onClick={() => setCollapse(!collapse)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors rounded-md p-1 hover:bg-accent"
              aria-label="Toggle parameter panel"
            >
              {collapse ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </CardTitle>
        </CardHeader>

        {collapse && (
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Machine
                </label>
                <FilterField icon={Cog}>
                  <select
                    value={filterMachine}
                    onChange={(e) => setFilterMachine(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors hover:border-slate-300"
                  >
                    <option value="all">All Machines</option>
                    {MACHINES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Model / Ratio
                </label>
                <FilterField icon={Box}>
                  <select
                    value={filterModel}
                    onChange={(e) => setFilterModel(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors hover:border-slate-300"
                  >
                    <option value="all">All Models</option>
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Month
                </label>
                <MonthField>
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors hover:border-slate-300"
                  />
                </MonthField>
              </div>

              <div className="flex items-center gap-2 sm:col-span-2 sm:justify-end lg:col-span-1">
                <Button
                  onClick={handleLoad}
                  disabled={loading}
                  className="h-10 rounded-xl shadow-sm gap-2 bg-[#005B96] hover:bg-[#005B96]/90 text-white"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {loading ? "Loading..." : "Load"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={loading}
                  className="h-10 rounded-xl shadow-sm gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={loading || exporting || !hasData}
                  className="h-10 rounded-xl shadow-sm gap-2"
                  title="Export to Excel"
                >
                  {exporting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#005B96]" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  {exporting ? "Exporting..." : "Export Excel"}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Error state ─────────────────────────────────── */}
      {error && !loading && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Unable to load MPR data
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              There was a problem retrieving the monthly production record.
              Please try again.
            </p>
            <Button
              onClick={load}
              className="mt-4 h-9 rounded-xl gap-2 bg-[#005B96] hover:bg-[#005B96]/90 text-white"
            >
              <Search className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading skeletons ────────────────────────────── */}
      {loading && (
        <div className="space-y-6">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-5">
              <Skeleton className="h-[380px] w-full rounded-xl" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-5">
              <Skeleton className="h-64 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {!hasData ? (
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 text-primary mb-4">
                  <CalendarDays className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  No MPR data available
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  No planned or actual production data was found for{" "}
                  {monthYearString || "the selected period"},{" "}
                  {machineName.toLowerCase()} and {modelName.toLowerCase()}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <MprChart
                agg={agg}
                machineName={machineName}
                modelName={modelName}
                monthYearString={monthYearString}
              />
              <MprTable agg={agg} monthYearString={monthYearString} showFg={true} />
              <NgDetailsTable rows={ngDetails} />
            </>
          )}
        </>
      )}
    </div>
  );
}
