import { useEffect, useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CalendarDays,
  Factory,
  AlertCircle,
  X,
  Inbox,
} from "lucide-react"
import { fetchDailyProductionDetails } from "../api"
import { formatNumber } from "@/lib/formatters"
import type { DailyProductionDetail, ProductionFilters } from "../types"
import { cn } from "@/lib/utils"

const SHIFT_LABELS = ["Shift 1", "Shift 2", "Shift 3"]

const SHIFT_META = {
  "Shift 1": { dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200/40 dark:border-blue-800/30", label: "Shift 1" },
  "Shift 2": { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200/40 dark:border-amber-800/30", label: "Shift 2" },
  "Shift 3": { dot: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200/40 dark:border-purple-800/30", label: "Shift 3" },
} as const

interface ProductionDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  filters: ProductionFilters
  lineLabel: string
}

export default function ProductionDetailsDialog({
  open,
  onOpenChange,
  date,
  filters,
  lineLabel,
}: ProductionDetailsDialogProps) {
  const [details, setDetails] = useState<DailyProductionDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)

  const loadDetails = useCallback(async () => {
    if (!date) return
    setLoading(true)
    setError(false)
    setContentVisible(false)
    try {
      const data = await fetchDailyProductionDetails(date, filters)
      // Brief delay so the fade-in transition is visible
      await new Promise((r) => setTimeout(r, 80))
      setDetails(data)
      if (data.length === 0) setError(false)
    } catch {
      setDetails([])
      setError(true)
    } finally {
      setLoading(false)
      setContentVisible(true)
    }
  }, [date, filters])

  useEffect(() => {
    if (open) loadDetails()
  }, [open, loadDetails])

  const shiftGroups = SHIFT_LABELS.map((shift) => ({
    shift,
    items: details.filter((d) => d.shift === shift),
  }))

  const totalRecords = details.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent        className={cn(
          // Responsive sizing — dialog itself does NOT scroll (fixes rounded-corner clipping)
          "max-w-5xl w-full max-h-[88vh] overflow-hidden flex flex-col",
          // Premium rounded corners
          "rounded-3xl",
          // Modern padding
          "p-0 gap-0",
          // Soft shadow
          "shadow-2xl",
          // ── CENTER-BASED ANIMATION ──
          // No horizontal movement (no slide-left/right/from-left/from-top)
          // Opening: fade in + scale 96→100% + translate up 6px
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96]",
          "data-[state=open]:slide-in-from-bottom-1 data-[state=closed]:slide-out-to-bottom-1",
          // Opening: 200ms ease-out — Closing: 150ms ease-in
          "duration-200 ease-out data-[state=closed]:duration-150 data-[state=closed]:ease-in",
          // Responsive: fullscreen on mobile
          "max-sm:max-w-full max-sm:max-h-full max-sm:rounded-none max-sm:h-dvh",
          // Tablet
          "max-md:max-w-[90vw]",
        )}
        hideDefaultClose
      >
        {/* ════════════════════════════════════════
            FIXED HEADER
            ════════════════════════════════════════ */}
        <div className="relative shrink-0 px-8 pt-8 pb-6 border-b border-border/40 max-sm:px-5 max-sm:pt-5 max-sm:pb-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Line + Date */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-[#005B96]/10 text-[#005B96] shrink-0">
                  <Factory className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                  {lineLabel}
                </DialogTitle>
              </div>
              <div className="flex items-center gap-2 mt-2 ml-1">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-sm text-muted-foreground">
                  {new Date(date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Right: Badge + Close */}
            <div className="flex items-center gap-3 shrink-0">
              {!loading && totalRecords > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-[#005B96]/10 px-3 py-1.5 text-xs font-semibold text-[#005B96] whitespace-nowrap">
                  <Factory className="h-3 w-3" />
                  {totalRecords} {totalRecords === 1 ? "record" : "records"}
                </div>
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-all duration-150 hover:scale-105 active:scale-95"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            SCROLLABLE CONTENT
            ════════════════════════════════════════ */}
        <div
          className="flex-1 overflow-y-auto px-8 pt-6 pb-8 mr-3 max-sm:px-5 max-sm:pb-6 max-sm:mr-0 production-details-scroll"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(148,163,184,0.5) transparent",
          }}
        >
          {loading ? (
            /* ── Loading State ── */
            <div className="space-y-5">
              {SHIFT_LABELS.map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          ) : error ? (
            /* ── Error State ── */
            <div className="flex flex-col items-center py-20 text-muted-foreground animate-in fade-in duration-200">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-950/30 mb-4">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <p className="text-base font-semibold text-foreground">Failed to load details</p>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                The server is currently unavailable. Please try again.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-[#005B96] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#005B96]/90 transition-all duration-150"
                onClick={loadDetails}
              >
                <Factory className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : totalRecords === 0 ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center py-20 text-muted-foreground animate-in fade-in duration-200">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/50 mb-4">
                <Inbox className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-base font-semibold text-foreground">No production data for this date</p>
              <p className="text-sm text-muted-foreground mt-1">
                Select a different date or adjust your filters.
              </p>
            </div>
          ) : (
            /* ── Shift Sections ── */
            <div
              className={cn(
                "space-y-5 transition-opacity duration-200",
                contentVisible ? "opacity-100" : "opacity-0",
              )}
            >
              {shiftGroups.map(({ shift, items }) => {
                const meta = SHIFT_META[shift as keyof typeof SHIFT_META]
                const hasData = items.length > 0

                return (
                  <div
                    key={shift}
                    className={cn(
                      "rounded-2xl border overflow-hidden transition-all duration-150",
                      meta.border,
                      hasData ? meta.bg : "bg-muted/20 border-dashed",
                    )}
                  >
                    {/* Shift Header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-inherit">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                        <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                        {hasData && (
                          <span className="inline-flex items-center rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/40">
                            {items.length} {items.length === 1 ? "record" : "records"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shift Content */}
                    {hasData ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-inherit">
                              <th className="text-left font-medium text-muted-foreground/70 text-[11px] uppercase tracking-wider py-3 px-5 w-[40%]">
                                Product
                              </th>
                              <th className="text-right font-medium text-muted-foreground/70 text-[11px] uppercase tracking-wider py-3 px-4 w-[15%]">
                                Plan
                              </th>
                              <th className="text-right font-medium text-muted-foreground/70 text-[11px] uppercase tracking-wider py-3 px-4 w-[15%]">
                                WIP
                              </th>
                              <th className="text-right font-medium text-muted-foreground/70 text-[11px] uppercase tracking-wider py-3 px-4 w-[15%]">
                                NG
                              </th>
                              <th className="text-right font-medium text-muted-foreground/70 text-[11px] uppercase tracking-wider py-3 px-4 w-[15%]">
                                FG
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-inherit last:border-b-0 transition-colors hover:bg-white/50 dark:hover:bg-white/5"
                              >
                                <td className="py-3.5 px-5">
                                  <div className="text-sm font-medium text-foreground truncate max-w-[240px]">
                                    {item.remarks}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground/50 font-normal mt-0.5">
                                    {item.prodcode}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm text-zinc-600 dark:text-zinc-400">
                                  {formatNumber(item.pqty)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm text-amber-600 dark:text-amber-400">
                                  {formatNumber(item.wip_qty)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm text-red-500 dark:text-red-400 font-medium">
                                  {formatNumber(item.ng_qty)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                  {formatNumber(item.fg_qty)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* Empty shift state */
                      <div className="flex flex-col items-center py-10 text-muted-foreground">
                        <Inbox className="h-6 w-6 text-muted-foreground/20 mb-2" />
                        <p className="text-xs font-medium">
                          No production records for {shift}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>

      {/* ── Custom thin scrollbar styles ── */}
      <style>{`
        .production-details-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .production-details-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 4px 0;
        }
        .production-details-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 999px;
          transition: background 0.15s ease;
        }
        .production-details-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
      `}</style>
    </Dialog>
  )
}
