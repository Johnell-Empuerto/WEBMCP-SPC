import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/formatters"

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION — the single shared premium pager for the whole frontend
// ════════════════════════════════════════════════════════════════════════════
// One visual language for every paginated module (Master lists, Logs, NG
// Report, Pallet Entry, Production charts, …). This component only standardizes
// the UI — pagination behaviour (server-side vs client-side, the page
// calculation, and the page-size values) stays 100% owned by each page.
//
// Layout (desktop):
//   Showing 1–20 of 156          Rows [10 ▪]   [«] [‹] [1] [2] [3] … [8] [›] [»]
//
// The page-size selector is rendered ONLY when pageSizeOptions + onPageSizeChange
// are provided (pages that intentionally keep a fixed page size simply omit it).
// The page list uses a window around the current page (first + last + ±range)
// with ellipsis separators for large result sets.

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  pageSize?: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  disabled?: boolean
  range?: number
  className?: string
}

const NAV_BUTTON =
  "h-8 w-8 rounded-lg px-0 text-muted-foreground hover:text-foreground"
const PAGE_BUTTON = "h-8 min-w-8 rounded-lg px-2 text-xs tabular-nums"

function buildPageList(current: number, total: number, range: number): Array<number | "ellipsis"> {
  if (total <= 1) return [1]
  const set = new Set<number>()
  set.add(1)
  set.add(total)
  for (let p = Math.max(2, current - range); p <= Math.min(total - 1, current + range); p++) {
    set.add(p)
  }
  const sorted = Array.from(set).sort((a, b) => a - b)
  const out: Array<number | "ellipsis"> = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis")
    out.push(p)
    prev = p
  }
  return out
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  range = 1,
  className,
}: PaginationProps) {
  const safeTotal = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, currentPage), safeTotal)
  const canPrev = safePage > 1 && !disabled
  const canNext = safePage < safeTotal && !disabled
  const showSizeSelect = !!pageSizeOptions && !!onPageSizeChange && pageSize !== undefined

  const startCount = totalItems === undefined || totalItems === 0 ? 0 : (safePage - 1) * (pageSize ?? 0) + 1
  const endCount = Math.min(safePage * (pageSize ?? 0), totalItems ?? 0)

  const pages = buildPageList(safePage, safeTotal, range)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {/* Left: total-count presentation + optional page-size selector */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {totalItems !== undefined && (
          <span>
            Showing{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatNumber(startCount)}
            </span>
            {"–"}
            <span className="font-medium text-foreground tabular-nums">
              {formatNumber(endCount)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatNumber(totalItems)}
            </span>
          </span>
        )}
        {showSizeSelect && (
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange!(Number(e.target.value))}
              disabled={disabled}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-150"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {formatNumber(s)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Right: page navigation */}
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className={NAV_BUTTON}
          disabled={!canPrev}
          onClick={() => onPageChange(1)}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={NAV_BUTTON}
          disabled={!canPrev}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="inline-flex h-8 min-w-6 items-center justify-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === safePage ? "default" : "outline"}
              size="sm"
              className={PAGE_BUTTON}
              disabled={disabled || p === safePage}
              onClick={() => onPageChange(p)}
              aria-current={p === safePage ? "page" : undefined}
            >
              {formatNumber(p)}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className={NAV_BUTTON}
          disabled={!canNext}
          onClick={() => onPageChange(Math.min(safeTotal, safePage + 1))}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={NAV_BUTTON}
          disabled={!canNext}
          onClick={() => onPageChange(safeTotal)}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  )
}

export default Pagination