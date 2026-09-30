import sql, { getPool } from '../config/database';

// ════════════════════════════════════════════════════════════════════════════
// Repository layer for Product Master.
// Responsible for database access only — all SQL Server queries for Product
// Master live in this file. No HTTP concerns, no business rules.
// Business logic belongs in productMasterService.ts.
// ════════════════════════════════════════════════════════════════════════════

export interface ProductListParams {
  size: number;
  offset: number;
  prodcode: string;
  prodname: string;
  prodspec: string;
  internalprodcode: string;
}

/**
 * List active products with filters + pagination.
 * Replicates legacy getProdMaster (node 05b4889b5e34d409): shows only
 * Pmt_status = 'A' rows, prefix-LIKE filters, ORDER BY code,
 * OFFSET/FETCH pagination.
 */
export async function listRecords(
  params: ProductListParams,
): Promise<{ rows: any[]; totalItems: number }> {
  const { size, offset, prodcode, prodname, prodspec, internalprodcode } = params;

  // ── WHERE building (same prefix-LIKE logic as the legacy builder) ────────
  const conditions: string[] = [`Pmt_Productcode IS NOT NULL AND Pmt_status = 'A'`];
  if (prodcode) conditions.push(`Pmt_Productcode LIKE @prodcode + '%' AND Pmt_status = 'A'`);
  if (prodname) conditions.push(`Pmt_Productname LIKE @prodname + '%' AND Pmt_status = 'A'`);
  if (prodspec) conditions.push(`Pmt_ProductSpecification LIKE @prodspec + '%' AND Pmt_status = 'A'`);
  if (internalprodcode) conditions.push(`Pmt_InternalProdCode LIKE @internalprodcode + '%' AND Pmt_status = 'A'`);

  const where = conditions.join(' AND ');

  const query = `
SELECT
    ISNULL(NULLIF(LOWER(TRIM(Pmt_Productcode)), 'null'), '') AS Pmt_Productcode,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_Productname)), 'null'), '') AS Pmt_Productname,
    ISNULL(NULLIF(LOWER(TRIM(REPLACE(Pmt_CostCenterCode, CHAR(160), ''))), 'null'), '') AS Pmt_CostCenterCode,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProdCategory)), 'null'), '') AS Pmt_ProdCategory,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProdSource)), 'null'), '') AS Pmt_ProdSource,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_BMstatus)), 'null'), '') AS Pmt_BMstatus,
    ISNULL(NULLIF(LOWER(TRIM(REPLACE(User_login, CHAR(160), ''))), 'null'), '') AS User_login,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProductSpecification)), 'null'), '') AS Pmt_ProductSpecification,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_InternalProdCode)), 'null'), '') AS Pmt_InternalProdCode,
    'false' AS selected
FROM T_ProductMaster
WHERE ${where}
ORDER BY Pmt_Productcode ASC
OFFSET @offset ROWS
FETCH NEXT @size ROWS ONLY;
`;

  const totalQuery = `
SELECT COUNT(*) AS TotalCount
FROM T_ProductMaster
WHERE ${where};
`;

  const pool = await getPool();

  const listRequest = pool.request();
  listRequest.input('size', sql.Int, size);
  listRequest.input('offset', sql.Int, offset);
  if (prodcode) listRequest.input('prodcode', sql.VarChar, prodcode);
  if (prodname) listRequest.input('prodname', sql.VarChar, prodname);
  if (prodspec) listRequest.input('prodspec', sql.VarChar, prodspec);
  if (internalprodcode) listRequest.input('internalprodcode', sql.VarChar, internalprodcode);
  const listResult = await listRequest.query(query);
  const rows = listResult.recordset ?? [];

  const totalRequest = pool.request();
  if (prodcode) totalRequest.input('prodcode', sql.VarChar, prodcode);
  if (prodname) totalRequest.input('prodname', sql.VarChar, prodname);
  if (prodspec) totalRequest.input('prodspec', sql.VarChar, prodspec);
  if (internalprodcode) totalRequest.input('internalprodcode', sql.VarChar, internalprodcode);
  const totalResult = await totalRequest.query(totalQuery);
  const totalItems = totalResult.recordset?.[0]?.TotalCount ?? 0;

  return { rows, totalItems };
}

/**
 * Single product for the edit modal.
 * Replicates legacy getProdDetails (node a221217ead06a1e8).
 */
export async function getDetails(prodcode: string): Promise<any[]> {
  const query = `
SELECT
    ISNULL(NULLIF(LOWER(TRIM(Pmt_Productcode)), 'null'), '') AS Pmt_Productcode,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_Productname)), 'null'), '') AS Pmt_Productname,
    ISNULL(NULLIF(LOWER(TRIM(REPLACE(Pmt_CostCenterCode, CHAR(160), ''))), 'null'), '') AS Pmt_CostCenterCode,
    ISNULL(NULLIF(LOWER(TRIM(CONVERT(VARCHAR, Pmt_ProdRegdate, 120))), 'null'), '') AS Pmt_ProdRegdate,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProdCategory)), 'null'), '') AS Pmt_ProdCategory,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProdSource)), 'null'), '') AS Pmt_ProdSource,
    Pmt_RequireCPO,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProductUnit)), 'null'), '') AS Pmt_ProductUnit,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_BOMControlNo)), 'null'), '') AS Pmt_BOMControlNo,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_BOMProdCode)), 'null'), '') AS Pmt_BOMProdCode,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_BOMType)), 'null'), '') AS Pmt_BOMType,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_BMstatus)), 'null'), '') AS Pmt_BMstatus,
    Pmt_HasCurMthPSched,
    Pmt_HasNxtMthPSched,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_PSGroupCode)), 'null'), '') AS Pmt_PSGroupCode,
    Pmt_MinLotSize,
    Pmt_MaxLotSize,
    Pmt_ProdLeadTime,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_LeadTimeUnit)), 'null'), '') AS Pmt_LeadTimeUnit,
    Pmt_StdPackingQty,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_StdPackingUnit)), 'null'), '') AS Pmt_StdPackingUnit,
    Pmt_BarcodeHeader,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_status)), 'null'), '') AS Pmt_status,
    ISNULL(NULLIF(LOWER(TRIM(REPLACE(User_login, CHAR(160), ''))), 'null'), '') AS User_login,
    ISNULL(NULLIF(LOWER(TRIM(CONVERT(VARCHAR, ludatetime, 120))), 'null'), '') AS ludatetime,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_AccountCode)), 'null'), '') AS Pmt_AccountCode,
    Pmt_IsHalfFinished,
    ISNULL(NULLIF(LOWER(TRIM(CONVERT(VARCHAR, Pmt_LastShipment, 120))), 'null'), '') AS Pmt_LastShipment,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProductSpecification)), 'null'), '') AS Pmt_ProductSpecification,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_ProductExtCode)), 'null'), '') AS Pmt_ProductExtCode,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_BusinessUnitCode)), 'null'), '') AS Pmt_BusinessUnitCode,
    Pmt_StdNetWeight,
    Pmt_StdGrossWeight,
    Pmt_NetGrossDecDigit,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_DescCategoryCode)), 'null'), '') AS Pmt_DescCategoryCode,
    ISNULL(NULLIF(LOWER(TRIM(Pmt_InternalProdCode)), 'null'), '') AS Pmt_InternalProdCode,
    'false' AS selected
FROM T_ProductMaster
WHERE Pmt_Productcode = @prodcode AND Pmt_status = 'A';
`;

  const pool = await getPool();
  const request = pool.request();
  request.input('prodcode', sql.VarChar, prodcode);
  const result = await request.query(query);
  return result.recordset ?? [];
}

/** Count how many products use the given code (duplicate guard). */
export async function countByCode(prodcode: string): Promise<number> {
  const pool = await getPool();
  const dupRequest = pool.request();
  dupRequest.input('prodcode', sql.VarChar, prodcode);
  const dupResult = await dupRequest.query(
    `SELECT COUNT(Pmt_Productcode) AS cnt FROM T_ProductMaster WHERE Pmt_Productcode = @prodcode;`,
  );
  return Number(dupResult.recordset?.[0]?.cnt ?? 0);
}

/**
 * Insert a new product (Pmt_status forced to 'A').
 * Replicates legacy addProdMaster (node c149067890bed961 → d99334dd7abfd1c1).
 */
export async function insertRecord(
  fields: Record<string, { value: string | number | Date | null; type: any }>,
  userlogin: string,
): Promise<void> {
  const pool = await getPool();
  const columns = Object.keys(fields);
  const insert = `
INSERT INTO T_ProductMaster (
    [Pmt_Productcode], [Pmt_Productname], [Pmt_CostCenterCode], [Pmt_ProdRegdate],
    [Pmt_ProdCategory], [Pmt_ProdSource], [Pmt_RequireCPO], [Pmt_ProductUnit],
    [Pmt_BOMControlNo], [Pmt_BOMProdCode], [Pmt_BOMType], [Pmt_BMstatus],
    [Pmt_HasCurMthPSched], [Pmt_HasNxtMthPSched], [Pmt_PSGroupCode], [Pmt_MinLotSize],
    [Pmt_MaxLotSize], [Pmt_ProdLeadTime], [Pmt_LeadTimeUnit], [Pmt_StdPackingQty],
    [Pmt_StdPackingUnit], [Pmt_BarcodeHeader], [Pmt_status], [User_login],
    [ludatetime], [Pmt_AccountCode], [Pmt_IsHalfFinished], [Pmt_LastShipment],
    [Pmt_ProductSpecification], [Pmt_ProductExtCode], [Pmt_BusinessUnitCode],
    [Pmt_StdNetWeight], [Pmt_StdGrossWeight], [Pmt_NetGrossDecDigit],
    [Pmt_DescCategoryCode], [Pmt_InternalProdCode]
)
VALUES (
    @Pmt_Productcode, @Pmt_Productname, @Pmt_CostCenterCode, @Pmt_ProdRegdate,
    @Pmt_ProdCategory, @Pmt_ProdSource, @Pmt_RequireCPO, @Pmt_ProductUnit,
    @Pmt_BOMControlNo, @Pmt_BOMProdCode, @Pmt_BOMType, @Pmt_BMstatus,
    @Pmt_HasCurMthPSched, @Pmt_HasNxtMthPSched, @Pmt_PSGroupCode, @Pmt_MinLotSize,
    @Pmt_MaxLotSize, @Pmt_ProdLeadTime, @Pmt_LeadTimeUnit, @Pmt_StdPackingQty,
    @Pmt_StdPackingUnit, @Pmt_BarcodeHeader, 'A', @User_login,
    GETDATE(), @Pmt_AccountCode, @Pmt_IsHalfFinished, @Pmt_LastShipment,
    @Pmt_ProductSpecification, @Pmt_ProductExtCode, @Pmt_BusinessUnitCode,
    @Pmt_StdNetWeight, @Pmt_StdGrossWeight, @Pmt_NetGrossDecDigit,
    @Pmt_DescCategoryCode, @Pmt_InternalProdCode
);
`;

  const insertRequest = pool.request();
  for (const col of columns) {
    const f = fields[col];
    insertRequest.input(col, f.type, f.value);
  }
  if (userlogin) insertRequest.input('User_login', sql.VarChar, userlogin);

  await insertRequest.query(insert);
}

/**
 * Full UPDATE keyed on Pmt_Productcode, ludatetime = GETDATE().
 * Replicates legacy updateProdMaster (node 24ef3f518b75bea8).
 */
export async function updateRecord(params: {
  prodcode: string;
  sets: string[];
  inputs: Array<{ name: string; type: any; value: any }>;
}): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('prodcode', sql.VarChar, params.prodcode);
  for (const inp of params.inputs) {
    request.input(inp.name, inp.type, inp.value);
  }

  const query = `
UPDATE T_ProductMaster
SET
    [ludatetime] = GETDATE(),
    ${params.sets.join(',\n    ')}
WHERE [Pmt_Productcode] = @prodcode;
`;

  const result = await request.query(query);
  return result.rowsAffected?.[0] ?? 0;
}

// Tables that reference a product code — used by the delete safety guard so
// historical/transactional data is never orphaned.
const REFERENCE_TABLES: Array<[string, string]> = [
  ['T_ProductionPlanning', 'Ppt_ProductCode'],
  ['T_JobOrderHeader', 'Joh_productCode'],
  ['E_DPRHeader', 'Dph_ProductCode'],
  ['T_CustomerPurchaseOrderDetail', 'Cpd_ProductCode'],
  ['T_PacklistDetail', 'Pld_ProductCode'],
  ['T_SalesInvoiceDetail', 'Ind_ProductCode'],
  ['T_TravelogHeader', 'Pth_ProductCode'],
  ['T_WarehouseRequisitionHeader', 'Wrh_ProductCode'],
  ['T_FGEndorsed', 'Fge_ProductCode'],
  ['E_KanbanTaggingHeader', 'Kth_ProductCode'],
  ['E_DailyProductionCycle', 'Dpc_ProductCode'],
  ['T_DailyProductionDetail', 'Dpd_Productcode'],
  ['T_DailyProductionHeader', 'Dph_Productcode'],
  ['T_ProductRouteMaster', 'Prm_ProductCode'],
  ['T_SalesPriceMaster', 'Spm_ProductCode'],
  ['T_StockAndProductLink', 'Spl_ProductCode'],
  ['E_DailyProductionLineMaster', 'Dpm_ProductCode'],
  ['E_DPRMaster', 'Dpm_ProductCode'],
  ['T_HoldUnholdTravelogDetail', 'Htd_ProductCode'],
  ['T_CustomerPartNumberMaster', 'Cpn_ProductCode'],
  ['T_ProductConversionMaster', 'Pcm_SourceProductCode'],
  ['T_ProductConversionMaster', 'Pcm_TargetProductCode'],
];

/**
 * Check every referencing table for the product code.
 * Returns the names of tables that still reference it (non-empty → block delete).
 */
export async function findReferences(prodcode: string): Promise<string[]> {
  const pool = await getPool();
  const refRequest = pool.request();
  refRequest.input('prodcode', sql.VarChar, prodcode);
  const refUnion = REFERENCE_TABLES.map(
    ([tbl, col], i) =>
      `SELECT ${i} AS refIdx, COUNT(*) AS refCount FROM ${tbl} WHERE ${col} = @prodcode`,
  ).join(' UNION ALL ');
  const refResult = await refRequest.query(refUnion);
  return (refResult.recordset ?? [])
    .filter((r: any) => Number(r.refCount) > 0)
    .map((r: any) => REFERENCE_TABLES[Number(r.refIdx)][0]);
}

/** Soft delete: Pmt_status = 'C' + User_login + GETDATE(). */
export async function softDelete(prodcode: string, userlogin: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('prodcode', sql.VarChar, prodcode);
  request.input('userlogin', sql.VarChar, userlogin);
  const result = await request.query(`
UPDATE T_ProductMaster
SET Pmt_status = 'C', ludatetime = GETDATE(), User_login = @userlogin
WHERE Pmt_Productcode = @prodcode;
`);
  return result.rowsAffected?.[0] ?? 0;
}

/** Dropdown lookups: cost centers, units, account codes, PS group codes. */
export async function getLookups(): Promise<Record<string, any[]>> {
  const queries: Record<string, string> = {
    costCenters: `
SELECT TRIM(Cct_CostCenterCode) AS Cct_CostCenterCode,
       TRIM(COALESCE(Pcm_ProcessDesc, Sscm_Sectiondesc, Scm_Sectiondesc, Dcm_Departmentdesc)) AS CostCenterDescription
FROM T_CostCenter
LEFT JOIN T_ProcessCodeMaster ON Cct_Processcode = Pcm_Processcode
LEFT JOIN T_SubSectionCodeMaster ON Cct_Subsectioncode = Sscm_Sectioncode
LEFT JOIN T_SectionCodeMaster ON Cct_Sectioncode = Scm_Sectioncode
LEFT JOIN T_DepartmentCodeMaster ON Cct_Departmentcode = Dcm_Departmentcode
LEFT JOIN T_CostCenterMappingMaster ON Cct_MappingCode = Ccm_MappingCode
WHERE Cct_status = 'A'
ORDER BY Cct_CostCenterCode ASC;`,
    prodUnits: `
SELECT TRIM(Umt_UnitmeasureCode) AS UnitCode, TRIM(Umt_UnitmeasureDesc) AS UnitDesc
FROM T_UnitOfMeasure
WHERE Umt_status = 'A';`,
    accountCodes: `
SELECT TRIM(Acm_AccountCode) AS AccountCode, TRIM(Acm_AccountDesc) AS AccountDesc
FROM T_AccountCodeMaster
WHERE Acm_Status = 'A';`,
    psGroupCodes: `
SELECT TRIM(Pgm_PSGroupCode) AS GroupCode, TRIM(Pgm_PSGroupDesc) AS GroupDesc
FROM T_PSGroupMaster
WHERE Pgm_status = 'A';`,
  };

  const pool = await getPool();
  const out: Record<string, any[]> = {};
  for (const [key, q] of Object.entries(queries)) {
    const result = await pool.request().query(q);
    out[key] = result.recordset ?? [];
  }
  return out;
}
