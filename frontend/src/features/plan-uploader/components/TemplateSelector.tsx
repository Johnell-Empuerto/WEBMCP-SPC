import { useState, useCallback } from "react"
import { FileDown, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Database, FileText } from "lucide-react"
import apiClient from "@/api/client"
import { FilterField } from "@/components/ui/FilterField"
import type { PlanUploaderTemplate } from "../types"

interface TemplateSelectorProps {
  templates: PlanUploaderTemplate[]
  selectedTemplate: string
  selectedYearMonth: string
  onTemplateChange: (id: string) => void
  includeHistory: boolean
  onIncludeHistoryChange: (checked: boolean) => void
  hasHistory: boolean
}

export default function TemplateSelector({
  templates,
  selectedTemplate,
  selectedYearMonth,
  onTemplateChange,
  includeHistory,
  onIncludeHistoryChange,
  hasHistory,
}: TemplateSelectorProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "success" | "error">("idle")

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    setDownloadStatus("idle")

    try {
      const response = await apiClient.get("/plan-uploader/template/download", {
        params: {
          yearmonth: selectedYearMonth,
          includeHistory: includeHistory ? "true" : "false",
        },
        responseType: "blob",
      })

      const disposition = response.headers["content-disposition"]
      let filename = `CodeMarkingEntry_${selectedYearMonth}.xlsx`
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/)
        if (match) filename = match[1]
      }

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDownloadStatus("success")
      setTimeout(() => setDownloadStatus("idle"), 3000)
    } catch {
      setDownloadStatus("error")
      setTimeout(() => setDownloadStatus("idle"), 5000)
    } finally {
      setDownloading(false)
    }
  }, [selectedYearMonth, includeHistory])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary shrink-0">
          <FileSpreadsheet className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Excel Template</span>
      </div>

      <div className="flex gap-2">
        <FilterField icon={FileText} className="flex-1">
          <select
            value={selectedTemplate}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005B96]/30
              transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600"
          >
            <option value="">Select Template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </FilterField>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-input bg-background
            text-muted-foreground hover:text-primary hover:border-primary/30
            transition-all duration-150 shadow-sm shrink-0
            disabled:opacity-50 disabled:cursor-not-allowed"
          title={downloading ? "Downloading..." : "Download Template"}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : downloadStatus === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : downloadStatus === "error" ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* With/Without Data checkbox — matches legacy behavior */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
        <div className="relative">
          <input
            type="checkbox"
            checked={includeHistory}
            onChange={(e) => onIncludeHistoryChange(e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-5 w-9 rounded-full border-2 border-input bg-background
            peer-checked:bg-[#005B96] peer-checked:border-[#005B96]
            transition-colors duration-200"
          />
          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm
            peer-checked:translate-x-4 transition-transform duration-200"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-[12px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            With Existing Data
          </span>
          {hasHistory && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              Available
            </span>
          )}
        </div>
      </label>

      {downloadStatus === "success" && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          Template downloaded successfully
        </p>
      )}
      {downloadStatus === "error" && (
        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
          Failed to download template. Please try again.
        </p>
      )}
    </div>
  )
}
