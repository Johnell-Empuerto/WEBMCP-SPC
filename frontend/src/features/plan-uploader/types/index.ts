export interface CostCenter {
  CostCenter: string
  ShiftCode: string
}

export interface ProductCode {
  ProdCode: string
}

export interface PlanUploaderTemplate {
  id: string
  name: string
  month: number
  columns: string
  folderName: string
  phpName: string
  phpIns: string
}

export interface ValidationError {
  row: number
  err: string
}

export interface UploadValidationRow {
  row: number
  prodline: string
  costcentercode: string
  prodcode: string
  revno: string
  editno: string
  planperiod: string
  planqty: number
  dayValues: Record<string, number | string>
}

export interface UploadValidationResponse {
  status: "success" | "error"
  errs: ValidationError[]
  ins: UploadValidationRow[]
  totalRows: number
  totalErrors: number
  totalValid: number
}

export interface InsertResult {
  status: "success" | "error"
  errs: ValidationError[]
  ins: UploadValidationRow[]
  update: UploadValidationRow[]
  totalInserted: number
  totalUpdated: number
}

export interface HistoryResponse {
  exists: boolean
  count: number
}

export interface PlanUploaderFilters {
  selectedYearMonth: string
  selectedMonth: number
  selectedYear: number
}
