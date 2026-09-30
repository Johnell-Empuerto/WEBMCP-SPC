import { useState, useCallback, useEffect, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { CalendarDays, Factory, ClipboardX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchNgReport, fetchNgReportOptions } from "../api";
import { MONTH_LABELS, DEFAULT_PAGE_SIZE } from "../types";
import type { NgReportOptions, NgReportRow, NgReportSummary } from "../types";
import NgReportFilters, { type NgReportDraftFilters } from "./NgReportFilters";
import NgReportKpis from "./NgReportKpis";
import NgReportTable from "./NgReportTable";

const EMPTY_SUMMARY: NgReportSummary = {
  totalRecords: 0,
  totalNgQty: 0,
  topCause: "",
  mostAffectedLine: "",
};

const EMPTY_OPTIONS: NgReportOptions = {
  years: [],
  lines: [],
  models: [],
  shifts: [],
  statuses: [],
};

function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function defaultFilters(): NgReportDraftFilters {
  return {
    ...currentPeriod(),
    line: "",
    model: "",
    shift: "",
    status: "",
    search: "",
  };
}

export default function NgReportPage() {
  usePageTitle("NG Report");

  const [options, setOptions] = useState<NgReportOptions>(EMPTY_OPTIONS);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [draft, setDraft] = useState<NgReportDraftFilters>(defaultFilters);
  const [applied, setApplied] = useState<NgReportDraftFilters>(defaultFilters);

  const [rows, setRows] = useState<NgReportRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState<NgReportSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const abortRef = useRef<AbortController | null>(null);

  // Dropdown options are loaded once for the current period, and again after a
  // Search (so they always reflect the period being searched). Changing a
  // dropdown ONLY updates the local draft — it never triggers a request.
  const loadOptions = useCallback(async (year: number, month: number) => {
    setOptionsLoading(true);
    try {
      const result = await fetchNgReportOptions(year, month);
      setOptions(result);
    } catch {
      // keep the last known options so the dropdowns never blank out
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const { year, month } = currentPeriod();
    loadOptions(year, month);
    return () => abortRef.current?.abort();
  }, [loadOptions]);

  // The report API runs ONLY on an explicit user action (Search / pagination /
  // page-size change / retry). Every value is sent together as one request.
  const load = useCallback(
    async (filters: NgReportDraftFilters, pageNo: number, size: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(false);
      try {
        const result = await fetchNgReport(
          {
            year: filters.year,
            month: filters.month,
            line: filters.line,
            model: filters.model,
            shift: filters.shift,
            status: filters.status,
            search: filters.search,
            size,
            pageno: pageNo,
          },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setRows(result.rows);
          setTotalItems(result.totalItems);
          setSummary(result.summary);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setRows([]);
          setTotalItems(0);
          setSummary(EMPTY_SUMMARY);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [],
  );

  const handleSearch = useCallback(() => {
    setApplied(draft);
    setPage(1);
    loadOptions(draft.year, draft.month);
    load(draft, 1, pageSize);
  }, [draft, pageSize, load, loadOptions]);

  const handleReset = useCallback(() => {
    const defaults = defaultFilters();
    setDraft(defaults);
    setApplied(defaults);
    setPage(1);
  }, []);

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      load(applied, p, pageSize);
    },
    [applied, pageSize, load],
  );

  const handlePageSizeChange = useCallback(
    (s: number) => {
      setPageSize(s);
      setPage(1);
      load(applied, 1, s);
    },
    [applied, load],
  );

  const hasActiveFilters = !!(
    applied.line ||
    applied.model ||
    applied.shift ||
    applied.status ||
    applied.search
  );

  const periodLabel =
    applied.month >= 1 && applied.month <= 12
      ? `${MONTH_LABELS[applied.month - 1]} ${applied.year}`
      : `${applied.year}`;

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="ng-report-grid"
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
            <rect width="100%" height="100%" fill="url(#ng-report-grid)" />
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
              NG Report
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Non-Good production records and issue analysis
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <CalendarDays className="h-3 w-3" />
                {periodLabel}
              </div>
              {totalItems > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                  <ClipboardX className="h-3 w-3" />
                  {totalItems} NG record{totalItems === 1 ? "" : "s"}
                </div>
              )}
              {summary.totalNgQty > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                  <Factory className="h-3 w-3" />
                  {summary.totalNgQty} NG qty
                </div>
              )}
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

      {/* ── Filters ─────────────────────────────────────── */}
      <NgReportFilters
        options={options}
        optionsLoading={optionsLoading}
        value={draft}
        onChange={setDraft}
        onSearch={handleSearch}
        onReset={handleReset}
        disabled={loading}
      />

      {/* ── KPI Summary ─────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : !error ? (
        <NgReportKpis summary={summary} />
      ) : null}

      {/* ── NG Records Table ────────────────────────────── */}
      <NgReportTable
        rows={rows}
        loading={loading}
        error={error}
        totalItems={totalItems}
        page={page}
        pageSize={pageSize}
        hasActiveFilters={hasActiveFilters}
        onRetry={() => load(applied, page, pageSize)}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
