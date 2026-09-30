import apiClient from "@/api/client"
import type {
  ProductDetail,
  ProductMasterFilter,
  ProductMasterLookups,
  ProductMasterPayload,
  ProductMasterRow,
} from "../types"

// Legacy endpoint mapping:
//   GET /getProdMaster          → GET  /product-master
//   GET /getProdDetails         → GET  /product-master/details
//   GET /addProdMaster          → POST /product-master
//   GET /updateProdMaster       → PUT  /product-master
//   GET /getDeleteProductMaster → DELETE /product-master
//   GET /getProdCostCenter | getProdUnit | getProdAccountCode | getProdGroupCode
//                              → GET  /product-master/lookups

interface LegacyResponse<T> {
  status: string
  result: T
  totalItems?: number
}

// List with filters + pagination (legacy getProdMaster).
export async function fetchProducts(
  filter: ProductMasterFilter,
): Promise<{ rows: ProductMasterRow[]; totalItems: number }> {
  const res = await apiClient.get<LegacyResponse<ProductMasterRow[]>>("/product-master", {
    params: {
      size: filter.size,
      pageno: filter.pageno,
      prodcode: filter.prodcode || undefined,
      prodname: filter.prodname || undefined,
      prodspec: filter.prodspec || undefined,
      internalprodcode: filter.internalprodcode || undefined,
    },
  })
  return { rows: res.data.result ?? [], totalItems: Number(res.data.totalItems) || 0 }
}

// Single product detail for the edit modal (legacy getProdDetails).
export async function fetchProductDetail(prodcode: string): Promise<ProductDetail | null> {
  const res = await apiClient.get<LegacyResponse<ProductDetail[]>>("/product-master/details", {
    params: { prodcode },
  })
  const rows = res.data.result ?? []
  return rows.length > 0 ? rows[0] : null
}

// Add product (legacy addProdMaster). Returns 'duplicate' when the code exists.
export async function addProduct(
  payload: ProductMasterPayload,
): Promise<{ status: "success" | "duplicate" | "error" }> {
  const res = await apiClient.post<{ status: string }>("/product-master", payload)
  return { status: (res.data.status as "success" | "duplicate") ?? "error" }
}

// Update product (legacy updateProdMaster).
export async function updateProduct(payload: ProductMasterPayload): Promise<void> {
  await apiClient.put("/product-master", payload)
}

// Soft delete product (legacy getDeleteProductMaster).
export async function deleteProduct(
  prodcode: string,
  userlogin: string,
): Promise<{ status: "success" | "blocked" | "error"; references?: string[]; message?: string }> {
  const res = await apiClient.delete<{ status: string; references?: string[]; message?: string }>("/product-master", {
    params: { prodcode, userlogin },
  })
  return {
    status: (res.data.status as "success" | "blocked") ?? "error",
    references: res.data.references,
    message: res.data.message,
  }
}

// All dropdown lookups in one call (legacy four sequential endpoints).
export async function fetchProductLookups(): Promise<ProductMasterLookups> {
  const res = await apiClient.get<LegacyResponse<ProductMasterLookups>>("/product-master/lookups")
  const result = res.data.result ?? ({} as ProductMasterLookups)
  return {
    costCenters: result.costCenters ?? [],
    prodUnits: result.prodUnits ?? [],
    accountCodes: result.accountCodes ?? [],
    psGroupCodes: result.psGroupCodes ?? [],
  }
}
