import { useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Factory, CalendarDays } from "lucide-react"
import CalendarDay from "./CalendarDay"
import type { CalendarEvent as CalendarEventType } from "../types"

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface ProductionCalendarProps {
  viewDate: Date
  events: CalendarEventType[]
  selectedDate: string
  today: string
  lineLabel: string
  loading: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDate: (dateStr: string) => void
  onEventClick: (event: CalendarEventType) => void
}

export default function ProductionCalendar({
  viewDate,
  events,
  selectedDate,
  today,
  lineLabel,
  loading,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  onEventClick,
}: ProductionCalendarProps) {
  // Compute calendar grid data
  const { calendarDays, leadingBlanks } = useMemo(() => {
    const dim = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
    const fd = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
    return {
      calendarDays: Array.from({ length: dim }, (_, i) => i + 1),
      leadingBlanks: Array.from({ length: fd }, (_, i) => i),
    }
  }, [viewDate])

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventType[]>()
    for (const event of events) {
      const key = event.start ? event.start.substring(0, 10) : ""
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    return map
  }, [events])

  const getDateStr = useCallback(
    (day: number) =>
      `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    [viewDate],
  )

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      {/* Calendar Header */}
      <CardHeader className="bg-gradient-to-r from-[#1a3c5e] to-[#0a1e33] text-white py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-white/70" />
            <span className="text-xs font-medium text-white/80">{lineLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToday}
              className="h-7 px-2.5 text-[11px] text-white/70 hover:text-white hover:bg-white/10"
            >
              <CalendarDays className="h-3 w-3 mr-1" />
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
              onClick={onPrevMonth}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-semibold px-2 text-white min-w-[140px] text-center select-none">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
              onClick={onNextMonth}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_HEADERS.map((day) => (
            <div
              key={day}
              className="py-1.5 text-center text-[10px] font-medium text-muted-foreground bg-muted/20 border-r border-border last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i}                className="min-h-[75px] p-2 border-r border-b border-border/30">
                <Skeleton className="h-5 w-5 rounded-full mb-1" />
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-2/3 rounded-md mt-0.5" />
              </div>
            ))}
          </div>
        ) : (
          /* Calendar grid */
          <div className="grid grid-cols-7">
            {leadingBlanks.map((blank) => (
              <div
                key={`blank-${blank}`}
                className="min-h-[75px] border-r border-b border-border/30 bg-muted/[0.03]"
              />
            ))}
            {calendarDays.map((day) => {
              const dateStr = getDateStr(day)
              const dayEvents = eventsByDate.get(dateStr) ?? []

              return (
                <CalendarDay
                  key={day}
                  day={day}
                  dateStr={dateStr}
                  isToday={dateStr === today}
                  isSelected={dateStr === selectedDate}
                  events={dayEvents}
                  onSelectDate={onSelectDate}
                  onEventClick={onEventClick}
                />
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <CalendarDays className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-medium">No production scheduled.</p>
            <p className="text-[10px] mt-0.5 text-muted-foreground/70">
              Select a different date or adjust filters.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
