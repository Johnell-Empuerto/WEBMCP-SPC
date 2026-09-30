import apiClient from "@/api/client"
import type {
  NgPartLookup,
  NgTagDefect,
  NgTagHistoryFilter,
  NgTagHistoryRow,
  NgTagPayload,
  NgTagProcess,
} from "../types"

// Modern endpoints for the NG Tagging module (legacy POST /ngtagging +
// GetNG / spGetNGList / spHandyNGTagging).

interface TagListResponse {
  status: string
  rows: NgTagHistoryRow[]
  totalItems: number
}

// Active process codes (process dropdown).
export async function fetchTagProcesses(): Promise<NgTagProcess[]> {
  const res = await apiClient.get<{ status: string; rows: NgTagProcess[] }>("/ng-tagging/processes")
  return res.data.rows ?? []
}

// Active defects, optionally filtered by the process' category.
export async function fetchTagDefects(processCode?: string): Promise<NgTagDefect[]> {
  const res = await apiClient.get<{ status: string; rows: NgTagDefect[] }>("/ng-tagging/defects", {
    params: { processCode: processCode || undefined },
  })
  return res.data.rows ?? []
}

// Look up a scanned PartsID (validates + shows model + existing NG count).
export async function lookupNgPart(partsId: string): Promise<NgPartLookup> {
  const res = await apiClient.get<{ status: string; found: boolean } & NgPartLookup>("/ng-tagging/lookup", {
    params: { partsId },
  })
  return {
    found: Boolean(res.data.found),
    partsId: res.data.partsId,
    productCode: res.data.productCode,
    model: res.data.model,
    productName: res.data.productName,
    partStatus: res.data.partStatus,
    ngCount: Number(res.data.ngCount) || 0,
  }
}

// Tag a part as NG (runs dbo.spHandyNGTagging server-side).
export async function tagNg(
  payload: NgTagPayload,
): Promise<{ status: "success" | "error"; message?: string }> {
  const res = await apiClient.post<{ status: string; message?: string }>("/ng-tagging", payload)
  return {
    status: (res.data.status as "success" | "error") ?? "error",
    message: res.data.message,
  }
}

// NG history with filters + pagination.
export async function fetchNgTagHistory(
  filter: NgTagHistoryFilter,
): Promise<{ rows: NgTagHistoryRow[]; totalItems: number }> {
  const res = await apiClient.get<TagListResponse>("/ng-tagging", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      search: filter.search || undefined,
      processCode: filter.processCode || undefined,
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
    },
  })
  return { rows: res.data.rows ?? [], totalItems: Number(res.data.totalItems) || 0 }
}
