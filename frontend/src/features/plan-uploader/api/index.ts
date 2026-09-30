import apiClient from "@/api/client"
import type { ApiResponse } from "@/types"
import type {
  CostCenter,
  ProductCode,
  PlanUploaderTemplate,
  UploadValidationResponse,
  InsertResult,
  HistoryResponse,
} from "../types"

export async function fetchCostCenters(): Promise<{ items: CostCenter[]; totalItems: number }> {
  const res = await apiClient.get<ApiResponse<{ items: CostCenter[]; totalItems: number }>>(
    "/plan-uploader/cost-centers",
  )
  return res.data.data ?? { items: [], totalItems: 0 }
}

export async function fetchProductCodes(): Promise<{ items: ProductCode[]; totalItems: number }> {
  const res = await apiClient.get<ApiResponse<{ items: ProductCode[]; totalItems: number }>>(
    "/plan-uploader/product-codes",
  )
  return res.data.data ?? { items: [], totalItems: 0 }
}

export async function fetchTemplates(month: number): Promise<{ templates: PlanUploaderTemplate[] }> {
  const res = await apiClient.get<ApiResponse<{ templates: PlanUploaderTemplate[] }>>(
    "/plan-uploader/templates",
    { params: { month } },
  )
  return res.data.data ?? { templates: [] }
}

export async function fetchTemplateList(month: number): Promise<{ templates: PlanUploaderTemplate[] }> {
  const res = await apiClient.get<ApiResponse<{ templates: PlanUploaderTemplate[] }>>(
    "/plan-uploader/template-list",
    { params: { month } },
  )
  return res.data.data ?? { templates: [] }
}

export async function validateUpload(
  base64File: string,
  selectedYearMonth: string,
): Promise<UploadValidationResponse> {
  const res = await apiClient.post<ApiResponse<UploadValidationResponse>>("/plan-uploader/validate", {
    base64File,
    selectedYearMonth,
  })
  return (
    res.data.data ?? {
      status: "error",
      errs: [],
      ins: [],
      totalRows: 0,
      totalErrors: 0,
      totalValid: 0,
    }
  )
}

export async function insertRecords(
  base64File: string,
  selectedYearMonth: string,
): Promise<InsertResult> {
  const res = await apiClient.post<ApiResponse<InsertResult>>("/plan-uploader/insert", {
    base64File,
    selectedYearMonth,
  })
  return (
    res.data.data ?? {
      status: "error",
      errs: [],
      ins: [],
      update: [],
      totalInserted: 0,
      totalUpdated: 0,
    }
  )
}

export async function checkHistory(yearmonth: string): Promise<HistoryResponse> {
  const res = await apiClient.get<ApiResponse<HistoryResponse>>(
    `/plan-uploader/history/${yearmonth}`,
  )
  return res.data.data ?? { exists: false, count: 0 }
}
