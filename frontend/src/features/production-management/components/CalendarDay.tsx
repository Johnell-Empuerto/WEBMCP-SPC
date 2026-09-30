import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import CalendarEvent from "./CalendarEvent"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CalendarEvent as CalendarEventType } from "../types"

interface CalendarDayProps {
  day: number
  dateStr: string
  isToday: boolean
  isSelected: boolean
  events: CalendarEventType[]
  maxVisible?: number
  onSelectDate: (dateStr: string) => void
  onEventClick: (event: CalendarEventType) => void
}

export default function CalendarDay({
  day,
  dateStr,
  isToday,
  isSelected,
  events,
  maxVisible = 3,
  onSelectDate,
  onEventClick,
}: CalendarDayProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)

  const visibleEvents = useMemo(
    () => events.slice(0, maxVisible),
    [events, maxVisible],
  )
  const overflowCount = events.length - maxVisible

  return (
    <div
      className={cn(
        "min-h-[75px] p-1 border-r border-b border-border/40 cursor-pointer transition-all duration-150",
        "hover:bg-accent/20 hover:shadow-inner",
        isToday && "bg-primary/[0.04]",
        isSelected && "ring-1 ring-primary ring-inset bg-primary/[0.07]",
      )}
      onClick={() => onSelectDate(dateStr)}
    >
      {/* Day number */}
      <div
        className={cn(
          "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-medium mb-0.5 transition-colors",
          isToday && "bg-primary text-primary-foreground shadow-sm",
          isSelected && !isToday && "bg-primary/15 text-primary font-semibold",
          !isToday && !isSelected && "text-foreground/80",
        )}
      >
        {day}
      </div>

      {/* Event chips (up to maxVisible) */}
      <div className="space-y-0.5">
        {visibleEvents.map((event) => (
          <CalendarEvent
            key={event.id}
            event={event}
            onClick={(ev) => onEventClick(ev)}
          />
        ))}
        {overflowCount > 0 && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full text-[10px] font-medium text-muted-foreground/70 hover:text-muted-foreground text-center py-0.5 rounded-sm hover:bg-muted/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                +{overflowCount} More
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={4}
              className="w-64 p-2 max-h-[280px] overflow-y-auto overflow-x-hidden bg-gradient-to-r from-[#005B96] to-[#0078C8] border-none"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between mb-1.5 px-1.5 pb-1.5 border-b border-white/20">
                <span className="text-[11px] font-semibold text-white/80">
                  {day} · {overflowCount + maxVisible} events
                </span>
                <button
                  type="button"
                  className="flex items-center justify-center h-5 w-5 rounded-full text-white/60 hover:text-white hover:bg-white/15 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPopoverOpen(false)
                  }}
                  aria-label="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors hover:bg-white/15 cursor-pointer text-white"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPopoverOpen(false)
                      onEventClick(event)
                    }}
                  >
                    {/* Color dot */}
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        event.status === "APPROVED" && "bg-emerald-500",
                        event.status === "PENDING" && "bg-amber-500",
                        event.status === "DECLINED" && "bg-red-500",
                        !event.status && event.type === "actual" && "bg-sky-500",
                        !event.status && event.type === "management" && "bg-[#413D46]",
                        !event.status && !event.type && "bg-primary/60",
                      )}
                    />
                    {/* Event text */}
                    <span className="flex-1 truncate font-medium text-white/90">
                      {event.title || event.remarks || event.prodcode || "Event"}
                    </span>
                    {/* Type badge */}
                    {event.type && (
                      <span className="text-[10px] text-white/60 uppercase tracking-wider shrink-0">
                        {event.type === "actual" ? "Actual" : event.type === "management" ? "Plan" : event.type}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
