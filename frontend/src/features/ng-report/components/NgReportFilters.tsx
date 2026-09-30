import { Search, RotateCcw, Settings2, Loader2, Factory, Box, Clock, CircleDot } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MonthField } from "@/components/ui/MonthField"
import { FilterField } from "@/components/ui/FilterField"
import { MONTH_LABELS } from "../types"
import type { NgReportOptionItem, NgReportOptions } from "../types"

export interface NgReportDraftFilters {
  year: number
  month: number
  line: string
  model: string
  shift: string
  status: string
  search: string
}

interface NgReportFiltersProps {
  options: NgReportOptions
  optionsLoading: boolean
  value: NgReportDraftFilters
  onChange: (next: NgReportDraftFilters) => void
  onSearch: () => void
  onReset: () => void
  disabled: boolean
}

const SHIFT_OPTIONS: NgReportOptionItem[] = [
  { value: "Shift01", label: "Shift 1" },
  { value: "Shift02", label: "Shift 2" },
  { value: "Shift03", label: "Shift 3" },
]

const FIELD_CLASS =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30 " +
  "transition-colors hover:border-slate-300 dark:hover:border-slate-600"

export default function NgReportFilters({
  options,
  optionsLoading,
  value,
  onChange,
  onSearch,
  onReset,
  disabled,
}: NgReportFiltersProps) {
  // Always keep the current draft year in the list so the select never renders
  // blank while the options for a different year are still loading.
  const yearOptions = options.years.includes(value.year)
    ? options.years
    : [value.year, ...options.years]

  const periodLabel = `${MONTH_LABELS[value.month - 1] ?? value.month} ${value.year}`

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-4 px-5 pt-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-4 w-4" />
          </div>
          <span>Filters</span>
          <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
            {periodLabel}
          </span>
          {optionsLoading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 text-primary/70 px-2.5 py-1 text-[10px] font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating options…
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {/* Dropdown filters — changes only update local state; Search runs the report */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
          {/* Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Year</label>
            <MonthField>
              <select
                value={value.year}
                onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
                className={FIELD_CLASS}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </MonthField>
          </div>

          {/* Month */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Month</label>
            <MonthField>
              <select
                value={value.month}
                onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
                className={FIELD_CLASS}
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </MonthField>
          </div>

          {/* Production Line */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Production Line</label>
            <FilterField icon={Factory}>
              <select
                value={value.line}
                onChange={(e) => onChange({ ...value, line: e.target.value })}
                className={FIELD_CLASS}
              >
                <option value="">All Lines</option>
                {options.lines.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Model</label>
            <FilterField icon={Box}>
              <select
                value={value.model}
                onChange={(e) => onChange({ ...value, model: e.target.value })}
                className={FIELD_CLASS}
              >
                <option value="">All Models</option>
                {options.models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>

          {/* Shift */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Shift</label>
            <FilterField icon={Clock}>
              <select
                value={value.shift}
                onChange={(e) => onChange({ ...value, shift: e.target.value })}
                className={FIELD_CLASS}
              >
                <option value="">All Shifts</option>
                {(options.shifts.length > 0 ? options.shifts : SHIFT_OPTIONS).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Status</label>
            <FilterField icon={CircleDot}>
              <select
                value={value.status}
                onChange={(e) => onChange({ ...value, status: e.target.value })}
                className={FIELD_CLASS}
              >
                <option value="">All Status</option>
                {options.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s === "A" ? "Active" : s === "I" ? "Inactive" : s}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>
        </div>

        {/* Search text */}
        <div className="mt-4 space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={value.search}
              onChange={(e) => onChange({ ...value, search: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Search travelog no., model, die no., problem/defect, PIC, process…"
              className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30"
            />
          </div>
        </div>

        {/* Actions — the ONLY report trigger */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <Button
              onClick={onSearch}
              disabled={disabled}
              className="flex-1 sm:flex-none h-10 gap-2 rounded-xl shadow-sm bg-[#005B96] hover:bg-[#005B96]/90 text-white px-5"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
            <Button
              variant="outline"
              onClick={onReset}
              disabled={disabled}
              className="flex-1 sm:flex-none h-10 gap-2 rounded-xl shadow-sm px-5"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}