// ════════════════════════════════════════════════════════════════════════════
// NG TAGGING — TYPES
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the fields exposed by the modern /ng-tagging endpoints. The tag
// action runs the legacy dbo.spHandyNGTagging procedure (same behaviour as the
// old POST /ngtagging Node-RED endpoint).

// A selectable process from T_ProcessCodeMaster (e.g. '04' → Case Machining OP-4).
export interface NgTagProcess {
  code: string
  descr: string
}

// A selectable defect from T_DefectMaster (already category-filtered by process).
export interface NgTagDefect {
  code: string
  shortName: string
  descr: string
}

// Result of looking up a scanned PartsID.
export interface NgPartLookup {
  found: boolean
  partsId?: string
  productCode?: string
  model?: string
  productName?: string
  partStatus?: string
  ngCount: number
}

// The payload sent to tag a part as NG.
export interface NgTagPayload {
  partsId: string
  processCode: string
  defectCode: string
  userCode: string
}

// One row from the NG history list (legacy GetNG report shape).
export interface NgTagHistoryRow {
  travelogNo: string
  partId: string
  processCode: string
  processDesc: string
  defectCode: string
  defectDesc: string
  defectShortName: string
  operatorId: string
  operatorName: string
  scannedAt: string | null
}

// Filters used by the history list endpoint.
export interface NgTagHistoryFilter {
  size: number
  pageno: number
  search?: string
  processCode?: string
  dateFrom?: string
  dateTo?: string
}
