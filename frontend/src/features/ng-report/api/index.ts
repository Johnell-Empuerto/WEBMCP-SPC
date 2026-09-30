import apiClient from "@/api/client"
import type { NgReportOptions, NgReportResult } from "../types"

// GET /ng-report/options — filter dropdown options for the selected period.
export async function fetchNgReportOptions(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<NgReportOptions> {
  const res = await apiClient.get("/ng-report/options", {
    params: { year, month },
    signal,
  })
  const data = res.data ?? {}
  return {
    years: Array.isArray(data.years) ? data.years : [],
    lines: Array.isArray(data.lines) ? data.lines : [],
    models: Array.isArray(data.models) ? data.models : [],
    shifts: Array.isArray(data.shifts) ? data.shifts : [],
    statuses: Array.isArray(data.statuses) ? data.statuses : [],
  }
}

// GET /ng-report — paginated NG records + summary KPIs.
export async function fetchNgReport(
  filter: {
    year: number
    month: number
    line: string
    model: string
    shift: string
    status: string
    search: string
    size: number
    pageno: number
  },
  signal?: AbortSignal,
): Promise<NgReportResult> {
  const res = await apiClient.get("/ng-report", {
    params: {
      year: filter.year,
      month: filter.month,
      line: filter.line || "",
      model: filter.model || "",
      shift: filter.shift || "",
      status: filter.status || "",
      // Free-text search matches travelog no., model, die no., problem,
      // PIC (name/login), process, status and shift — applied together with
      // the dropdown filters in one parameterized request.
      search: filter.search || "",
      size: filter.size,
      pageno: filter.pageno,
    },
    signal,
  })
  const data = res.data ?? {}
  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    totalItems: Number(data.totalItems ?? 0),
    summary: {
      totalRecords: Number(data.summary?.totalRecords ?? 0),
      totalNgQty: Number(data.summary?.totalNgQty ?? 0),
      topCause: data.summary?.topCause ?? "",
      mostAffectedLine: data.summary?.mostAffectedLine ?? "",
    },
  }
}