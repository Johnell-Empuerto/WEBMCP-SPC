import {
  ClipboardX,
  SearchX,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/Pagination"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/formatters"
import { PAGE_SIZE_OPTIONS, LINE_LABELS } from "../types"
import { ACTIVE_STATUS_BADGE } from "@/lib/status"
import type { NgReportRow } from "../types"

const COLUMNS = [
  "DATE",
  "LINE",
  "MODEL",
  "DIE NO.",
  "SHIFT",
  "PROBLEM",
  "CAUSE",
  "ACTION",
  "COUNTERMEASURES",
  "PIC",
  "TRAVELOG NO.",
  "PROCESS",
  "DOWN TIME",
  "STATUS",
]

function formatReportDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}-${mm}-${d.getFullYear()}`
}

function statusBadge(status: string): { label: string; className: string } {
  const s = (status || "").trim()
  switch (s) {
    case "A":
      return { label: "Active", className: ACTIVE_STATUS_BADGE }
    case "I":
      return { label: "Inactive", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" }
    case "F":
      return { label: "Finished", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" }
    default:
      return { label: s || "—", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
  }
}

interface NgReportTableProps {
  rows: NgReportRow[]
  loading: boolean
  error: boolean
  totalItems: number
  page: number
  pageSize: number
  hasActiveFilters: boolean
  onRetry: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function NgReportTable({
  rows,
  loading,
  error,
  totalItems,
  page,
  pageSize,
  hasActiveFilters,
  onRetry,
  onPageChange,
  onPageSizeChange,
}: NgReportTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const isInitialLoading = loading && rows.length === 0

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-4 px-5 pt-5">
        <CardTitle className="text-sm font-semibold flex flex-wrap items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
            <ClipboardX className="h-4 w-4" />
          </div>
          <span>NG Records</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
              {formatNumber(totalItems)} record{totalItems === 1 ? "" : "s"}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        {isInitialLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/30 text-red-500 mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">Failed to load NG records</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Something went wrong while fetching the NG data. Please try again.
            </p>
            <Button variant="outline" onClick={onRetry} className="mt-4 h-10 rounded-xl gap-2">
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-3">
              <SearchX className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">No NG records found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {hasActiveFilters
                ? "No records match the selected filters. Adjust the filters or clear the search."
                : "No defective (NG) items were recorded for the selected period."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {loading && (
              <div className="mb-2 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-medium">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  Loading...
                </span>
              </div>
            )}

            <div className="relative overflow-hidden rounded-xl border border-border/60">
              <div className="ng-scroll overflow-x-auto overflow-y-auto max-h-[560px] overscroll-contain scrollbar-thin">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      {COLUMNS.map((col) => (
                        <th
                          key={col}
                          className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap border-b border-border"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={`${row.plandate}-${row.model}-${row.prodcode}-${row.shift}-${row.dieNo}-${row.problem}-${idx}`}
                        className={cn(
                          "border-b border-border/20 transition-colors",
                          idx % 2 === 1
                            ? "bg-slate-50/50 dark:bg-slate-800/20"
                            : "bg-background",
                          "hover:bg-[#005B96]/[0.04]",
                        )}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatReportDate(row.plandate)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 text-[10px] font-semibold">
                            {row.line ? (LINE_LABELS[row.line] ?? row.line) : "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground leading-tight">
                              {row.model || "—"}
                            </span>
                            {row.prodcode && (
                              <span className="text-[10px] text-muted-foreground font-mono leading-tight">
                                {row.prodcode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{row.dieNo || "—"}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-[#005B96]/10 text-[#005B96] dark:text-sky-400 px-2 py-0.5 text-[10px] font-semibold">
                            {row.shift || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 min-w-[160px] whitespace-normal break-words">
                          {row.problem || "—"}
                        </td>
                        <td className="py-2.5 px-3 min-w-[140px] whitespace-normal break-words text-muted-foreground">
                          {row.cause || "—"}
                        </td>
                        <td className="py-2.5 px-3 min-w-[140px] whitespace-normal break-words text-muted-foreground">
                          {row.action || "—"}
                        </td>
                        <td className="py-2.5 px-3 min-w-[160px] whitespace-normal break-words text-muted-foreground">
                          {row.countermeasures || "—"}
                        </td>
                        <td className="py-2.5 px-3 min-w-[100px] whitespace-nowrap text-muted-foreground">
                          {row.pic || "—"}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                            {row.travelogNo || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-[#005B96]/10 text-[#005B96] dark:text-sky-400 px-2 py-0.5 font-mono text-[10px] font-semibold">
                            {row.process || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 min-w-[100px] whitespace-nowrap text-muted-foreground">
                          {row.downTime || "—"}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              statusBadge(row.status).className,
                            )}
                          >
                            {statusBadge(row.status).label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

{/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}