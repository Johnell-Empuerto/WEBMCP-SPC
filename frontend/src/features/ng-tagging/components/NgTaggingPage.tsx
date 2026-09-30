import { useCallback, useEffect, useRef, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/MonthField";
import { FilterField } from "@/components/ui/FilterField";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/Pagination";
import {
  Search,
  Tag,
  Loader2,
  AlertTriangle,
  ScanLine,
  CheckCircle2,
  XCircle,
  Workflow,
} from "lucide-react";
import {
  fetchNgTagHistory,
  fetchTagDefects,
  fetchTagProcesses,
  lookupNgPart,
  tagNg,
} from "../api";
import type {
  NgPartLookup,
  NgTagDefect,
  NgTagHistoryFilter,
  NgTagHistoryRow,
  NgTagProcess,
} from "../types";

const PAGE_SIZE = 10;

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusLabel(status?: string): string {
  switch ((status ?? "").trim()) {
    case "F":
      return "Finished";
    case "C":
      return "Closed";
    case "A":
      return "Active";
    default:
      return status || "—";
  }
}

export default function NgTaggingPage() {
  usePageTitle("NG Tagging");

  const { user } = useAuth();
  const userCode = user?.userCode ?? "";

  // ── Tag form ─────────────────────────────────────────────
  const partsInputRef = useRef<HTMLInputElement>(null);
  const [partsId, setPartsId] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [defectCode, setDefectCode] = useState("");
  const [processes, setProcesses] = useState<NgTagProcess[]>([]);
  const [defects, setDefects] = useState<NgTagDefect[]>([]);
  const [lookup, setLookup] = useState<NgPartLookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [tagError, setTagError] = useState("");
  const [tagSuccess, setTagSuccess] = useState("");

  // ── History ──────────────────────────────────────────────
  const [rows, setRows] = useState<NgTagHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    processCode: "",
    dateFrom: "",
    dateTo: "",
  });

  // Load the process list once.
  useEffect(() => {
    fetchTagProcesses()
      .then(setProcesses)
      .catch(() => setProcesses([]));
  }, []);

  // Reload the defect dropdown when the process changes (category-filtered).
  useEffect(() => {
    fetchTagDefects(processCode)
      .then((d) => {
        setDefects(d);
        setDefectCode((cur) =>
          cur && d.some((x) => x.code === cur) ? cur : "",
        );
      })
      .catch(() => setDefects([]));
  }, [processCode]);

  const handleLookup = useCallback(async () => {
    const value = partsId.trim();
    if (!value) return;
    setLookingUp(true);
    setTagError("");
    setTagSuccess("");
    try {
      const result = await lookupNgPart(value);
      setLookup(result);
      if (!result.found) {
        setTagError(`Part "${value}" was not found in the travelog records.`);
      }
    } catch {
      setLookup(null);
      setTagError("Failed to look up part. Please try again.");
    } finally {
      setLookingUp(false);
    }
  }, [partsId]);

  const handleTag = async () => {
    if (!partsId.trim()) {
      setTagError("Please scan or enter a Parts ID.");
      return;
    }
    if (!processCode) {
      setTagError("Please select a Process.");
      return;
    }
    if (!defectCode) {
      setTagError("Please select a Defect.");
      return;
    }
    setTagging(true);
    setTagError("");
    setTagSuccess("");
    try {
      const res = await tagNg({
        partsId: partsId.trim(),
        processCode,
        defectCode,
        userCode,
      });
      if (res.status === "success") {
        setTagSuccess(`Part "${partsId.trim()}" tagged as NG (${defectCode}).`);
        setPartsId("");
        setLookup(null);
        setTimeout(() => partsInputRef.current?.focus(), 0);
        loadHistory(1, filters);
      } else {
        setTagError(res.message || "Tagging failed.");
      }
    } catch {
      setTagError("Tagging failed. Please try again.");
    } finally {
      setTagging(false);
    }
  };

  // ── History list ─────────────────────────────────────────
  const loadHistory = useCallback(async (pageNo: number, f: typeof filters) => {
    setLoading(true);
    try {
      const filter: NgTagHistoryFilter = {
        size: PAGE_SIZE,
        pageno: pageNo,
        ...f,
      };
      const result = await fetchNgTagHistory(filter);
      setRows(result.rows);
      setTotal(result.totalItems);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(page, filters);
  }, [page, loadHistory]);

  const handleSearch = () => {
    setPage(1);
    loadHistory(1, filters);
  };

  const resetSearch = () => {
    setFilters({ search: "", processCode: "", dateFrom: "", dateTo: "" });
    setPage(1);
    loadHistory(1, { search: "", processCode: "", dateFrom: "", dateTo: "" });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canTag = !(
    lookup?.partStatus && ["F", "C"].includes(lookup.partStatus.trim())
  );

  return (
    <div className="space-y-6 animate-in">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="ng-tagging-grid"
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
            <rect width="100%" height="100%" fill="url(#ng-tagging-grid)" />
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
                alt="NG Tagging"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              NG Tagging
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Tag a scanned product lot as Not Good (NG)
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Tag className="h-3 w-3" />
                Handy NG Scanning
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <AlertTriangle className="h-3 w-3" />
                {total} NG record{total !== 1 ? "s" : ""}
              </div>
              {tagSuccess && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white border border-white/10">
                  {tagSuccess}
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

      {tagSuccess && (
        <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {tagSuccess}
        </div>
      )}

      {/* Tag as NG */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tag as NG</CardTitle>
          <span className="text-xs text-muted-foreground">
            Scan Parts ID then tag
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px] space-y-1.5">
              <Label htmlFor="partsId">Parts ID (Product Lot No.)</Label>
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="partsId"
                  ref={partsInputRef}
                  autoFocus
                  className="pl-9 h-10 font-mono text-base tracking-wide"
                  placeholder="Scan barcode or type..."
                  value={partsId}
                  maxLength={20}
                  onChange={(e) => {
                    setPartsId(e.target.value);
                    setLookup(null);
                    setTagError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLookup();
                  }}
                />
              </div>
            </div>
            <div className="w-full sm:w-[240px] space-y-1.5">
              <Label htmlFor="processCode">Process</Label>
              <FilterField icon={Workflow}>
                <select
                  id="processCode"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={processCode}
                  onChange={(e) => setProcessCode(e.target.value)}
                >
                  <option value="">Select process...</option>
                  {processes.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {p.descr}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="w-full sm:w-[260px] space-y-1.5">
              <Label htmlFor="defectCode">Defect</Label>
              <FilterField icon={AlertTriangle}>
                <select
                  id="defectCode"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={defectCode}
                  onChange={(e) => setDefectCode(e.target.value)}
                  disabled={!processCode}
                >
                  <option value="">
                    {processCode
                      ? "Select defect..."
                      : "Select a process first"}
                  </option>
                  {defects.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} — {d.descr} ({d.shortName})
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handleLookup}
                disabled={lookingUp || !partsId.trim()}
              >
                {lookingUp ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-1.5 h-4 w-4" />
                )}
                Look Up
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleTag}
                disabled={tagging || !canTag}
                className="min-w-[120px]"
              >
                {tagging && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                <Tag className="mr-1.5 h-4 w-4" />
                Tag as NG
              </Button>
            </div>
          </div>

          {/* Look-up result panel */}
          {lookup && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                lookup.found
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-red-200 bg-red-50/60"
              }`}
            >
              {lookup.found ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Part found
                  </span>
                  {lookup.model && (
                    <span>
                      <span className="text-muted-foreground">Model:</span>{" "}
                      <span className="font-mono">{lookup.model}</span>
                    </span>
                  )}
                  {lookup.productName && (
                    <span>
                      <span className="text-muted-foreground">Product:</span>{" "}
                      {lookup.productName}
                    </span>
                  )}
                  <span>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    {statusLabel(lookup.partStatus)}
                  </span>
                  {Number(lookup.ngCount) > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                      <AlertTriangle className="h-4 w-4" /> Already tagged NG (
                      {lookup.ngCount})
                    </span>
                  )}
                  {!canTag && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                      <XCircle className="h-4 w-4" /> Cannot tag: travelog is{" "}
                      {statusLabel(lookup.partStatus).toLowerCase()}
                    </span>
                  )}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                  <XCircle className="h-4 w-4" /> Part not found in travelog
                  records
                </span>
              )}
            </div>
          )}

          {tagError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {tagError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* NG History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>NG History</CardTitle>
          <span className="text-xs text-muted-foreground">
            {total} record{total !== 1 ? "s" : ""}
          </span>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Search}>
                <Input
                  placeholder="Parts ID / Defect Code / Description"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[140px]">
              <FilterField icon={Workflow}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.processCode}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, processCode: e.target.value }))
                  }
                >
                  <option value="">Process (All)</option>
                  {processes.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {p.descr}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="w-[150px]">
              <DateField>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, dateFrom: e.target.value }))
                  }
                />
              </DateField>
            </div>
            <div className="w-[150px]">
              <DateField>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, dateTo: e.target.value }))
                  }
                />
              </DateField>
            </div>
            <Button variant="default" size="sm" onClick={handleSearch}>
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" size="sm" onClick={resetSearch}>
              Reset
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No NG records found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Tag a part above to start recording NG.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Scanned Date
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Parts ID
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Process
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Defect
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Operator
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.travelogNo}-${r.defectCode}-${i}`}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {formatDateTime(r.scannedAt)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs font-medium">
                        {r.partId}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                          {r.processCode} — {r.processDesc}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {r.defectCode} — {r.defectDesc} ({r.defectShortName})
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs">
                            {r.operatorId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.operatorName}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
