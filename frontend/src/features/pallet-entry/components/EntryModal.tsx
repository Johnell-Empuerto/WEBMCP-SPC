import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DateField } from "@/components/ui/MonthField"
import { FilterField } from "@/components/ui/FilterField"
import { Wand2, Printer, Save, Loader2, Package, X, Users } from "lucide-react"
import type {
  PalletHeaderForm,
  PalletDetailsForm,
  CustomerCode,
} from "../types"

interface EntryModalProps {
  open: boolean
  header: PalletHeaderForm
  details: PalletDetailsForm
  customerCodes: CustomerCode[]
  saving: boolean
  populating: boolean
  onClose: () => void
  onFieldChange: (field: string, value: string) => void
  onCustomerChange: (code: string) => void
  onDetailChange: (field: string, value: string) => void
  onPopulate: () => void
  onPrint: () => void
  onSave: () => void
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  maxLength,
}: {
  label: string
  value: string | number | null
  onChange?: (v: string) => void
  disabled?: boolean
  type?: string
  maxLength?: number
}) {
  const editable = !disabled
  const base = editable
    ? "h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    : "h-10 w-full rounded-lg border border-input bg-muted/60 px-3 py-2 text-sm text-muted-foreground disabled:opacity-100"
  const control = (
    <input
      type={type}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={!editable}
      readOnly={disabled}
      maxLength={maxLength}
      className={base}
    />
  )
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {type === "date" ? <DateField>{control}</DateField> : control}
    </div>
  )
}

export default function EntryModal({
  open,
  header,
  details,
  customerCodes,
  saving,
  populating,
  onClose,
  onFieldChange,
  onCustomerChange,
  onDetailChange,
  onPopulate,
  onPrint,
  onSave,
}: EntryModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[720px] w-full max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl shadow-2xl border-border/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96] duration-200 ease-out max-sm:max-w-full max-sm:max-h-full max-sm:rounded-none max-sm:h-dvh"
        hideDefaultClose
      >
        {/* ── Fixed header ── */}
        <div className="relative shrink-0 px-7 pt-6 pb-5 border-b border-border/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-[#005B96]/10 text-[#005B96] shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                Pallet Entry
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

        {/* ── Scrollable content (scroll stays inside; corners stay clean) ── */}
        <div
          className="flex-1 overflow-y-auto px-7 pt-6 pb-7 mr-3 pallet-entry-scroll"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,0.5) transparent" }}
        >
          <div className="space-y-6">
            {/* Header section */}
            <section>
              <h4 className="text-sm font-semibold text-foreground border-b border-border/60 pb-2 mb-4">
                Header
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Control No" value={header.controlNo} disabled />
                <Field label="Date" value={header.date} onChange={(v) => onFieldChange("date", v)} type="date" />
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Customer Code</Label>
                  <FilterField icon={Users}>
                    <select
                      value={header.customerCode}
                      onChange={(e) => onCustomerChange(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value=""></option>
                      {customerCodes.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                  </FilterField>
                </div>
                <Field label="Destination" value={header.destination} disabled />
                <Field label="PO Number" value={header.poNumber} onChange={(v) => onFieldChange("poNumber", v)} maxLength={35} />
                <Field label="Invoice No" value={header.invoiceNo} onChange={(v) => onFieldChange("invoiceNo", v)} maxLength={35} />
                <Field label="Order Date" value={header.orderDate} disabled />
                <Field label="Case No." value={header.caseNo} disabled />
              </div>
            </section>

            {/* Details section */}
            <section>
              <h4 className="text-sm font-semibold text-foreground border-b border-border/60 pb-2 mb-4">
                Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Part No." value={header.partNo} disabled />
                <Field label="Product Name" value={details.productName} disabled />
                <Field label="Packing Date" value={details.packingDate} onChange={(v) => onDetailChange("packingDate", v)} type="date" />
                <Field label="Order No" value={details.orderNo} onChange={(v) => onDetailChange("orderNo", v)} maxLength={35} />
                <Field label="Quantity" value={details.quantity} disabled type="number" />
                <Field label="Weight" value={details.weight} disabled />
                <Field label="Pallet Count" value={details.palletCount} disabled />
                <Field label="Box No" value={details.boxNo} onChange={(v) => onDetailChange("boxNo", v)} maxLength={4} />
              </div>
            </section>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onPopulate}
                disabled={populating}
                className="h-10"
              >
                {populating ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-1.5" />
                )}
                Populate Fields
              </Button>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 shrink-0 px-7 py-4 border-t border-border/60">
          <Button type="button" variant="outline" onClick={onClose} className="h-10">Cancel</Button>
          <Button type="button" onClick={onPrint} className="h-10">
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-10 bg-[#005B96] hover:bg-[#005B96]/90"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </DialogContent>
      <style>{`
        .pallet-entry-scroll::-webkit-scrollbar { width: 6px; }
        .pallet-entry-scroll::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
        .pallet-entry-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 999px; transition: background 0.15s ease; }
        .pallet-entry-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.6); }
      `}</style>
    </Dialog>
  )
}