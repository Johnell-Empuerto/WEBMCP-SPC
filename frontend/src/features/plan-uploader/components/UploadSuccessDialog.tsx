import { useCallback, useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface UploadSuccessDialogProps {
  open: boolean
  onClose: () => void
  totalInserted: number
  totalUpdated: number
}

export default function UploadSuccessDialog({
  open,
  onClose,
  totalInserted,
  totalUpdated,
}: UploadSuccessDialogProps) {
  const [animating, setAnimating] = useState(false)

  // Trigger entrance animation after mount
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setAnimating(true), 30)
      return () => clearTimeout(t)
    } else {
      setAnimating(false)
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onClose()
      }
    },
    [onClose],
  )

  const hasInserts = totalInserted > 0
  const hasUpdates = totalUpdated > 0

  let title: string
  let description: string

  if (hasInserts && hasUpdates) {
    title = "Plan Upload Completed"
    description = `Inserted: ${totalInserted} records • Updated: ${totalUpdated} records`
  } else if (hasInserts) {
    title = "Plan Uploaded Successfully"
    description = `${totalInserted} planning ${totalInserted === 1 ? "record was" : "records were"} successfully inserted into Production Planning.`
  } else if (hasUpdates) {
    title = "Production Plan Updated"
    description = `${totalUpdated} existing planning ${totalUpdated === 1 ? "record was" : "records were"} successfully updated.`
  } else {
    title = "No Changes Required"
    description = "All selected records are already up to date."
  }

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
      <DialogContent
        hideDefaultClose
        onKeyDown={handleKeyDown}
        className="sm:max-w-[420px] rounded-2xl p-0 gap-0 overflow-hidden shadow-2xl border-border/60"
      >
        {/* Hidden title for accessibility */}
        <VisuallyHidden>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </VisuallyHidden>

        <div className="flex flex-col items-center px-8 pt-10 pb-6 text-center">
          {/* Success Icon */}
          <div
            className={`flex items-center justify-center h-[72px] w-[72px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 mb-6 transition-all duration-300 ${
              animating ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
          </div>

          {/* Title */}
          <h2
            className={`text-xl font-bold text-foreground mb-2 transition-all duration-300 delay-[60ms] ${
              animating ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            {title}
          </h2>

          {/* Description */}
          <p
            className={`text-sm text-muted-foreground leading-relaxed max-w-[300px] transition-all duration-300 delay-[100ms] ${
              animating ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            {description}
          </p>

          {/* Summary badges */}
          {(hasInserts || hasUpdates) && (
            <div
              className={`flex flex-wrap items-center justify-center gap-2 mt-5 transition-all duration-300 delay-[140ms] ${
                animating ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              {hasInserts && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  {totalInserted} Inserted
                </span>
              )}
              {hasUpdates && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                  <CheckCircle2 className="h-3 w-3" />
                  {totalUpdated} Updated
                </span>
              )}
            </div>
          )}

          {/* Success message */}
          <p
            className={`text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-4 transition-all duration-300 delay-[180ms] ${
              animating ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            No validation errors occurred.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Footer */}
        <DialogFooter className="px-8 py-4 sm:px-8">
          <Button
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-[#005B96] hover:bg-[#005B96]/90 text-white shadow-sm"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
