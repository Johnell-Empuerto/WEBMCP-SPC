import { CalendarDays } from "lucide-react"
import { MonthField } from "@/components/ui/MonthField"

interface MonthSelectorProps {
  selectedYearMonth: string
  year: number
  month: number
  onMonthChange: (year: number, month: number) => void
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function MonthSelector({
  selectedYearMonth,
  year,
  month,
  onMonthChange,
}: MonthSelectorProps) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i)

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">Month</label>

      <div className="flex gap-2">
        <MonthField className="flex-1">
          <select
            value={month}
            onChange={(e) => onMonthChange(year, parseInt(e.target.value))}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30
              transition-colors hover:border-slate-300 dark:hover:border-slate-600"
          >
            {MONTHS.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </MonthField>

        <MonthField className="w-28">
          <select
            value={year}
            onChange={(e) => onMonthChange(parseInt(e.target.value), month)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30
              transition-colors hover:border-slate-300 dark:hover:border-slate-600"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </MonthField>
      </div>

      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-primary border border-primary/20">
        <CalendarDays className="h-3 w-3" />
        {selectedYearMonth || `${year}-${String(month).padStart(2, "0")}`}
      </div>
    </div>
  )
}
