import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"

interface SuccessDialogProps {
  open: boolean
  message: string
  onClose: () => void
}

export default function SuccessDialog({ open, message, onClose }: SuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[380px] rounded-2xl p-0 gap-0 overflow-hidden border-border/60">
        <div className="flex items-center justify-center pt-8 pb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <div className="px-6 text-center">
          <DialogTitle className="text-lg font-semibold">Success!</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">{message}</DialogDescription>
        </div>
        <DialogFooter className="px-6 py-5">
          <Button onClick={onClose} className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}