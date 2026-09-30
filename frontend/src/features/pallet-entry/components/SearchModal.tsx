import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateField } from "@/components/ui/MonthField"
import { FilterField } from "@/components/ui/FilterField"
import { Search, RotateCcw, X, CircleDot, Box } from "lucide-react"
import { getStatusLabel } from "@/lib/status"
import type { PalletFilter } from "../types"

const STATUS_OPTIONS = ["A", "N", "F", "C"]
const PART_OPTIONS = [
  { value: "8-97533-464-1", label: "ES08" },
  { value: "8-97669-716-0", label: "ES25" },
  { value: "8-98247-187-2", label: "ES01" },
  { value: "8972787453", label: "ES30HR" },
  { value: "8972787463", label: "ES30LR" },
]

interface SearchModalProps {
  open: boolean
  onClose: () => void
  onReset: () => void
  onSearch: (filter: PalletFilter) => void
}

export default function SearchModal({ open, onClose, onReset, onSearch }: SearchModalProps) {
  const [status, setStatus] = useState("A")
  const [date, setDate] = useState("")
  const [partNo, setPartNo] = useState("")

  const handleSearch = () => {
    onSearch({ status, date, partNo })
  }

  const handleReset = () => {
    setStatus("A")
    setDate("")
    setPartNo("")
    onReset()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[460px] w-full max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl shadow-2xl border-border/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96] duration-200 ease-out max-sm:max-w-full max-sm:max-h-full max-sm:rounded-none max-sm:h-dvh"
        hideDefaultClose
      >
        {/* ── Fixed header ── */}
        <div className="relative shrink-0 px-7 pt-6 pb-5 border-b border-border/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-[#005B96]/10 text-[#005B96] shrink-0">
                <Search className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                Search Pallet
              </DialogTitle>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-all duration-150 hover:scale-105 active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-7 pt-6 pb-7 mr-3">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="search-status">Status</Label>
              <FilterField icon={CircleDot}>
                <select
                  id="search-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="search-date">Date</Label>
              <DateField>
                <Input
                  id="search-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </DateField>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="search-part">Part No.</Label>
              <FilterField icon={Box}>
                <select
                  id="search-part"
                  value={partNo}
                  onChange={(e) => setPartNo(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a product</option>
                  {PART_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.value} - {p.label}</option>
                  ))}
                </select>
              </FilterField>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 shrink-0 px-7 py-4 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="h-10"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
          <Button onClick={handleSearch} className="h-10 bg-[#005B96] hover:bg-[#005B96]/90">
            <Search className="h-4 w-4 mr-1.5" /> Search
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}