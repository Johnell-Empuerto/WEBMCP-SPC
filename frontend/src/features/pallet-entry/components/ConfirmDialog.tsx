import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, AlertCircle } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  action: "cancel" | "save" | "error"
  count: number
  errorMessage?: string
  onClose: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  action,
  count,
  errorMessage,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const isError = action === "error"
  const isCancel = action === "cancel"

  const title = isError ? "Error" : isCancel ? "Cancel Pallets" : "Save Pallets"
  const message = isError
    ? errorMessage || "An unexpected error occurred. Please try again."
    : isCancel
      ? `Are you sure you want to cancel the selected pallet${count === 1 ? "" : "s"}?`
      : `Are you sure you want to save the selected pallet${count === 1 ? "" : "s"}?`
  const icon = isError ? <AlertCircle className="h-5 w-5 text-red-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 gap-0 overflow-hidden border-border/60">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            {icon} {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5">
          <DialogDescription className="text-sm text-muted-foreground">{message}</DialogDescription>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border/60 gap-2">
          {!isError ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} className="h-10">No</Button>
              <Button
                type="button"
                onClick={onConfirm}
                className={`h-10 ${isCancel ? "bg-red-600 hover:bg-red-700" : "bg-[#005B96] hover:bg-[#005B96]/90"} disabled:opacity-50`}
              >
                Yes
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onConfirm} className="h-10 bg-red-600 hover:bg-red-700">
              OK
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}