import { useEffect, useMemo, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import type { LeaderInfo } from "../types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10

interface LeaderPickerProps {
  value: string
  options: LeaderInfo[]
  onChange: (name: string) => void
  className?: string
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v))

const leaderName = (l?: LeaderInfo | null): string =>
  `${str(l?.md_firstname)} ${str(l?.md_lastname)}`.replace(/\s+/g, " ").trim()

export default function LeaderPicker({ value, options, onChange, className }: LeaderPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  const filtered = useMemo(() => {
    const list = (options || []).filter(l => l && (l.md_firstname || l.md_lastname))
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(l => {
      const name = leaderName(l).toLowerCase()
      const pos = str(l?.md_position).toLowerCase()
      const code = str(l?.md_Usercode).toLowerCase()
      return name.includes(q) || pos.includes(q) || code.includes(q)
    })
  }, [query, options])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const select = (name: string) => {
    onChange(name)
    setOpen(false)
    setQuery("")
    setPage(0)
  }

  const clear = () => {
    onChange("")
    setOpen(false)
    setQuery("")
    setPage(0)
  }

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) { setQuery(""); setPage(0) } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={value ? "Click to change" : "Click to select"}
          className={cn(
            "w-full h-full bg-[#F5F591] text-center text-[10px] outline-none cursor-pointer",
            "flex items-center justify-center px-1 group",
            className,
          )}
        >
          <span className="break-words leading-tight whitespace-normal min-w-0">{value || "— Select —"}</span>
          {value && (
            <span
              role="button"
              title="Remove"
              onClick={e => { e.stopPropagation(); clear() }}
              className="ml-0.5 shrink-0 rounded-full p-0.5 text-muted-foreground/70 hover:bg-black/10 hover:text-foreground"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" sideOffset={2} className="w-64 p-1.5 bg-white border border-border shadow-lg">
        <div className="relative mb-1.5">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0) }}
            placeholder="Search name / position / code"
            className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="max-h-52 overflow-y-auto">
          {pageItems.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matching people</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {pageItems.map(l => {
                const name = leaderName(l)
                const isSelected = name === value
                return (
                  <li key={str(l.md_Usercode)}>
                    <button
                      type="button"
                      onClick={() => select(name)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors",
                        isSelected && "bg-accent font-medium",
                      )}
                    >
                      <span className="block break-words whitespace-normal leading-snug">{name}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">{str(l.md_position)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-border/60 pt-1.5">
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            Clear
          </button>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[4.5rem] text-center">
              {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
