import { useState, useCallback, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  Save,
  RotateCcw,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MonthSelector from "./MonthSelector";
import TemplateSelector from "./TemplateSelector";
import FileUploader from "./FileUploader";
import PreviewTable from "./PreviewTable";
import ValidationLog from "./ValidationLog";
import UploadSuccessDialog from "./UploadSuccessDialog";
import {
  fetchTemplates,
  validateUpload,
  insertRecords,
  checkHistory,
} from "../api";
import type {
  PlanUploaderTemplate,
  UploadValidationRow,
  ValidationError,
} from "../types";

const PREVIEW_COLUMNS = [
  "Row",
  "Prod Line",
  "Cost Center",
  "Prod Code",
  "Rev No",
  "Edit No",
  "Plan Qty",
];

export default function PlanUploaderPage() {
  usePageTitle("Plan Uploader");

  // ── State ──
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templates, setTemplates] = useState<PlanUploaderTemplate[]>([]);
  const [base64File, setBase64File] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isInserting, setIsInserting] = useState(false);

  // Validation results
  const [validRows, setValidRows] = useState<UploadValidationRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [validationSummary, setValidationSummary] = useState<{
    totalRows: number;
    totalValid: number;
    totalErrors: number;
  } | null>(null);

  // Insert results
  const [insertResult, setInsertResult] = useState<{
    totalInserted: number;
    totalUpdated: number;
  } | null>(null);
  // Success dialog
  const [successDialog, setSuccessDialog] = useState<{
    open: boolean;
    totalInserted: number;
    totalUpdated: number;
  }>({ open: false, totalInserted: 0, totalUpdated: 0 });

  // History
  const [hasHistory, setHasHistory] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);

  const selectedYearMonth = `${year}-${String(month).padStart(2, "0")}`;

  // ── Load reference data ──
  useEffect(() => {
    fetchTemplates(month).then((data) => {
      setTemplates(data.templates);
      if (data.templates.length > 0) {
        setSelectedTemplate(data.templates[0].id);
      }
    });
  }, [month]);

  // Check history on month change — auto-enable checkbox if records exist (legacy behavior)
  useEffect(() => {
    checkHistory(selectedYearMonth).then((data) => {
      setHasHistory(data.exists);
      if (data.exists) {
        setIncludeHistory(true);
      } else {
        setIncludeHistory(false);
      }
    });
  }, [selectedYearMonth]);

  // ── Handlers ──
  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    setSelectedTemplate("");
    setValidRows([]);
    setValidationErrors([]);
    setValidationSummary(null);
    setInsertResult(null);
    setBase64File(null);
  }, []);

  const handleFileSelect = useCallback((_file: File, base64: string) => {
    setBase64File(base64);
    setValidationErrors([]);
    setValidRows([]);
    setValidationSummary(null);
    setInsertResult(null);
  }, []);

  const handleValidate = useCallback(async () => {
    if (!base64File) return;

    setIsValidating(true);
    setValidationErrors([]);
    setValidRows([]);
    setValidationSummary(null);
    setInsertResult(null);

    try {
      const result = await validateUpload(base64File, selectedYearMonth);
      setValidRows(result.ins);
      setValidationErrors(result.errs);
      setValidationSummary({
        totalRows: result.totalRows,
        totalValid: result.totalValid,
        totalErrors: result.totalErrors,
      });
    } catch (err) {
      setValidationErrors([
        {
          row: 0,
          err: `Validation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setIsValidating(false);
    }
  }, [base64File, selectedYearMonth]);

  const handleInsert = useCallback(async () => {
    if (!base64File) return;

    setIsInserting(true);
    setInsertResult(null);

    try {
      const result = await insertRecords(base64File, selectedYearMonth);
      setValidationErrors(result.errs);
      setInsertResult({
        totalInserted: result.totalInserted,
        totalUpdated: result.totalUpdated,
      });

      if (result.totalInserted > 0 || result.totalUpdated > 0) {
        setSuccessDialog({
          open: true,
          totalInserted: result.totalInserted,
          totalUpdated: result.totalUpdated,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setValidationErrors((prev) => [
        ...prev,
        { row: 0, err: `Insert failed: ${errorMessage}` },
      ]);
    } finally {
      setIsInserting(false);
    }
  }, [base64File, selectedYearMonth]);

  const handleReset = useCallback(() => {
    setBase64File(null);
    setValidRows([]);
    setValidationErrors([]);
    setValidationSummary(null);
    setInsertResult(null);
    setSelectedTemplate("");
  }, []);

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="pu-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pu-grid)" />
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
            <line
              x1="100%"
              y1="0"
              x2="0"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-inner">
              <img
                src="/plan.png"
                alt="Production Planning"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              Plan Uploader
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Production Planning Upload &amp; Management
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Upload className="h-3 w-3" />
                {selectedYearMonth}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <div className="flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-sm border border-white/20">
              <img
                src="/logo_npax.png"
                alt="ISUZU"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(480px,0.9fr)_minmax(560px,1.1fr)]">
        {/* ── Left Panel ── */}
        <div className="space-y-6 flex flex-col">
          {/* ══ Month + Template + Upload ══ */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-4 px-5 pt-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <span>Upload Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 px-5 pb-5">
              <MonthSelector
                selectedYearMonth={selectedYearMonth}
                year={year}
                month={month}
                onMonthChange={handleMonthChange}
              />

              {/* History indicator */}
              {hasHistory && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Existing data found for this month
                  </span>
                </div>
              )}

              <TemplateSelector
                templates={templates}
                selectedTemplate={selectedTemplate}
                selectedYearMonth={selectedYearMonth}
                onTemplateChange={setSelectedTemplate}
                includeHistory={includeHistory}
                onIncludeHistoryChange={setIncludeHistory}
                hasHistory={hasHistory}
              />

              <FileUploader
                onFileSelect={handleFileSelect}
                disabled={isValidating || isInserting}
              />

              {/* Upload / Validate / Insert Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="default"
                  className="flex-1 h-11 rounded-xl shadow-sm gap-2 bg-[#005B96] hover:bg-[#005B96]/90 text-white"
                  onClick={handleValidate}
                  disabled={!base64File || isValidating || isInserting}
                >
                  {isValidating ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Validate
                    </>
                  )}
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  className="group flex-1 h-11 rounded-xl gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
                  onClick={handleReset}
                  disabled={isValidating || isInserting}
                >
                  <RotateCcw className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Panel ── */}
        <div className="space-y-6 flex flex-col">
          {/* ══ Preview Table ══ */}
          <Card className="rounded-2xl border-border/60 shadow-sm flex flex-1 flex-col">
            <CardHeader className="pb-4 px-5 pt-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <span>Excel Preview</span>
                <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {validRows.length} row{validRows.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1 flex flex-col">
              {isValidating ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <PreviewTable rows={validRows} columns={PREVIEW_COLUMNS} />
              )}

              {/* Summary + Insert */}
              {validationSummary && (
                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {validationSummary.totalRows}
                      </span>{" "}
                      rows processed
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-medium text-emerald-600">
                        {validationSummary.totalValid} valid
                      </span>
                    </div>
                    {validationSummary.totalErrors > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="font-medium text-amber-600">
                          {validationSummary.totalErrors} errors
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="default"
                      className={cn(
                        "flex-1 h-11 rounded-xl shadow-sm gap-2",
                        insertResult
                          ? "bg-emerald-600 hover:bg-emerald-600/90"
                          : "bg-[#005B96] hover:bg-[#005B96]/90",
                        "text-white",
                      )}
                      onClick={handleInsert}
                      disabled={
                        validRows.length === 0 || isInserting || isValidating
                      }
                    >
                      {isInserting ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Insert
                        </>
                      )}
                    </Button>
                    <Button
                      size="default"
                      variant="outline"
                      className="h-11 rounded-xl gap-2 border-slate-200 hover:bg-slate-50"
                      onClick={() => {
                        setValidRows([]);
                        setValidationErrors([]);
                        setValidationSummary(null);
                        setInsertResult(null);
                      }}
                      disabled={isInserting}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ══ Validation Logs ══ */}
        <Card className="rounded-2xl border-border/60 shadow-sm lg:col-span-2 xl:col-span-2">
          <CardHeader className="pb-4 px-5 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
                <ScrollText className="h-4 w-4" />
              </div>
              <span>Validation Logs</span>
              <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                {validationErrors.length} entr
                {validationErrors.length !== 1 ? "ies" : "y"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {isValidating ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <ValidationLog errors={validationErrors} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog */}
      <UploadSuccessDialog
        open={successDialog.open}
        onClose={() => setSuccessDialog((prev) => ({ ...prev, open: false }))}
        totalInserted={successDialog.totalInserted}
        totalUpdated={successDialog.totalUpdated}
      />
    </div>
  );
}
