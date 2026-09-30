import { FileSpreadsheet } from "lucide-react"
import type { UploadValidationRow } from "../types"

interface PreviewTableProps {
  rows: UploadValidationRow[]
  columns: string[]
}

export default function PreviewTable({ rows, columns }: PreviewTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center py-10 text-muted-foreground">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-3">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">No data to preview</p>
        <p className="text-xs mt-1 text-muted-foreground/60">
          Upload and validate an Excel file to see preview
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 dark:bg-slate-800">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap border-b border-border"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border/20 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-2 px-3 font-medium text-foreground">{row.row}</td>
                  <td className="py-2 px-3 text-foreground">{row.prodline}</td>
                  <td className="py-2 px-3 text-foreground">{row.costcentercode}</td>
                  <td className="py-2 px-3 font-medium text-foreground">{row.prodcode}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.revno}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.editno}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-600 font-medium">
                    {row.planqty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
