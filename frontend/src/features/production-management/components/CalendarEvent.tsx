import { useState, useCallback } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { CalendarEvent as CalendarEventType } from "../types"

/** Legacy production calendar: only two business concepts — planned vs actual. No status colors. */
function getEventColor(type?: string): string {
  if (type === "actual") return "bg-amber-600/85 hover:bg-amber-600"
  // type === "management" or any unknown type → dark charcoal
  return "bg-zinc-700/85 hover:bg-zinc-700"
}

function getDotColor(type?: string): string {
  if (type === "actual") return "bg-amber-300"
  return "bg-zinc-400"
}

interface CalendarEventProps {
  event: CalendarEventType
  onClick?: (event: CalendarEventType) => void
}

export default function CalendarEvent({ event, onClick }: CalendarEventProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick?.(event)
    },
    [event, onClick],
  )

  const bgClass = getEventColor(event.type)
  const dotClass = getDotColor(event.type)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] leading-tight font-medium text-white truncate transition-all duration-150 cursor-pointer shadow-sm",
              "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
              bgClass,
            )}
            onClick={handleClick}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
            <span className="truncate">{event.title || event.remarks || event.prodcode}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[260px] p-3 space-y-1.5">
          <EventTooltipContent event={event} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function EventTooltipContent({ event }: { event: CalendarEventType }) {
  return (
    <>
      <div className="font-semibold text-sm text-white truncate">
        {event.remarks || event.title || event.prodcode || "Production Event"}
      </div>
      {event.prodcode && (
        <div className="text-xs text-white/70">
          Code: <span className="text-white/90 font-medium">{event.prodcode}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-white/70 pt-1 border-t border-white/20">
        {event.pqty != null && (
          <>
            <span>Plan</span>
            <span className="text-right text-white/90 font-medium">
              {event.pqty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </>
        )}
        {event.actqty != null && (
          <>
            <span>Actual</span>
            <span className="text-right text-white/90 font-medium">
              {event.actqty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </>
        )}
      </div>
    </>
  )
}
