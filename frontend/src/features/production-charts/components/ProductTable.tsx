import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber, achievementTextColor } from "../lib/format"
import type { ProductSummary } from "../types"
import ChartCard from "./ChartCard"

const PAGE_SIZES = [10, 20, 50]

export default function ProductTable({ data }: { data: ProductSummary[] }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const rows = useMemo(() => data, [data])
  const totalItems = rows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const showingFrom = totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0
  const showingTo = Math.min(safePage * pageSize, totalItems)

  return (
    <ChartCard
      title="Product Production Detail"
      subtitle="All products ranked by actual production"
      icon={Database}
    >
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold w-14">Rank</th>
              <th className="px-4 py-3 font-semibold">Product Code</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Line</th>
              <th className="px-4 py-3 font-semibold text-right">Planned</th>
              <th className="px-4 py-3 font-semibold text-right">Actual</th>
              <th className="px-4 py-3 font-semibold text-right">Achv %</th>
              <th className="px-4 py-3 font-semibold text-right hidden sm:table-cell">WIP</th>
              <th className="px-4 py-3 font-semibold text-right hidden sm:table-cell">NG</th>
              <th className="px-4 py-3 font-semibold text-right hidden sm:table-cell">FG</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => {
              const rank = (safePage - 1) * pageSize + i + 1
              return (
                <tr
                  key={row.prodcode}
                  className="border-t border-border/50 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                        rank === 1
                          ? "bg-emerald-500 text-white"
                          : rank === 2
                            ? "bg-slate-300 text-slate-700"
                            : rank === 3
                              ? "bg-amber-400 text-white"
                              : "bg-slate-100 text-muted-foreground dark:bg-slate-800",
                      )}
                    >
                      {rank}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block font-medium text-foreground truncate max-w-[200px]">
                      {row.title || row.prodcode}
                    </span>
                    <span className="block text-[10px] font-mono text-muted-foreground/60">{row.prodcode}</span>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{row.line || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {formatNumber(row.plan)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-amber-600">
                    {formatNumber(row.actual)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-mono tabular-nums font-semibold",
                      achievementTextColor(row.achievement),
                    )}
                  >
                    {row.plan > 0 ? `${formatNumber(row.achievement)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sky-600 dark:text-sky-400 hidden sm:table-cell">
                    {formatNumber(row.wip)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-600 dark:text-red-400 hidden sm:table-cell">
                    {formatNumber(row.ng)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 hidden sm:table-cell">
                    {formatNumber(row.fg)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span>entries · Showing {showingFrom}–{showingTo} of {totalItems}</span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1 text-xs text-muted-foreground">…</span>
                  )}
                  <Button
                    variant={p === safePage ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                </span>
              ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </ChartCard>
  )
}
