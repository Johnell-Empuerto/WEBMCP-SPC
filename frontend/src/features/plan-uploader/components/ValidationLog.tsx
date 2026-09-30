import { ScrollText, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ValidationError } from "../types"

interface ValidationLogProps {
  errors: ValidationError[]
}

export default function ValidationLog({ errors }: ValidationLogProps) {
  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-3">
          <ScrollText className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">No logs</p>
        <p className="text-xs mt-1 text-muted-foreground/60">
          Validation messages will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="border border-border/60 rounded-xl overflow-hidden">
        <div className="max-h-[250px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 w-16 border-b border-border">
                  Row
                </th>
                <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 border-b border-border">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err, idx) => {
                const isSuccess =
                  err.err.includes("Successfully") || err.err.includes("Inserted") || err.err.includes("Updated")
                return (
                  <tr
                    key={idx}
                    className={cn(
                      "border-b border-border/20 transition-colors",
                      isSuccess
                        ? "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                        : "hover:bg-red-50/50 dark:hover:bg-red-950/20",
                    )}
                  >
                    <td className="py-2 px-3 text-muted-foreground">{err.row}</td>
                    <td className="py-2 px-3 flex items-center gap-1.5">
                      {isSuccess ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                      <span
                        className={cn(
                          isSuccess ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {err.err}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
