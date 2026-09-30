import sql from '../config/database';
import * as repo from '../repositories/productMasterRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for Product Master.
// Contains business/use-case logic:
//   - Reads and trims request values
//   - Validates required fields
//   - Normalizes empty → NULL (legacy strOrNull / numOrNull builders)
//   - Builds the add field map and the update SET clause
//   - Orchestrates the duplicate check, reference guard and CRUD calls
// SQL belongs in productMasterRepository.ts; HTTP concerns belong in
// productMasterController.ts.
// ════════════════════════════════════════════════════════════════════════════

type ServiceError = { ok: false; statusCode: number; message: string };

type ListResult =
  | ServiceError
  | { ok: true; result: any[]; totalItems: number };

type DetailsResult =
  | ServiceError
  | { ok: true; result: any[]; totalItems: number };

type AddResult =
  | ServiceError
  | { ok: true; duplicate: boolean; prodcode: string };

type UpdateResult =
  | ServiceError
  | { ok: true; prodcode: string };

type DeleteResult =
  | ServiceError
  | { ok: true; blocked: boolean; prodcode: string; references: string[]; message: string };

// ── SQL Server query string helper for a nullable numeric literal ─────────
// Mirrors the legacy builder: empty/undefined → NULL, else the raw number.
function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Mirrors the legacy builder: empty/undefined → NULL, else the quoted string.
function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

// Column-name → legacy body-key map (needed because the nullable field set has
// different naming in the legacy controller than the DB column).
function reqBodyKey(col: string): string {
  const map: Record<string, string> = {
    Pmt_ProdRegdate: 'prodregdate',
    Pmt_LastShipment: 'last_shipment',
    Pmt_MinLotSize: 'minlotsize',
    Pmt_MaxLotSize: 'maxlotsize',
    Pmt_ProdLeadTime: 'prodleadtime',
    Pmt_StdPackingQty: 'stdpackingqty',
    Pmt_BarcodeHeader: 'barcodeheader',
    Pmt_AccountCode: 'accountcode',
    Pmt_IsHalfFinished: 'ishalffinished',
    Pmt_StdNetWeight: 'stdnetweight',
    Pmt_StdGrossWeight: 'stdgrossweight',
    Pmt_NetGrossDecDigit: 'netgrossdecdigit',
  };
  return map[col] ?? col;
}

// ════════════════════════════════════════════════════════════════════════════
// GET /product-master — list (filters + pagination)
// Query: { size, pageno, prodcode, prodname, prodspec, internalprodcode }
// Replicates legacy getProdMaster (node 05b4889b5e34d409).
// ════════════════════════════════════════════════════════════════════════════
export async function listRecords(query: any): Promise<ListResult> {
  const size = Math.max(1, Number(query.size) || 10);
  const pageno = Math.max(1, Number(query.pageno) || 1);
  const offset = (pageno - 1) * size;

  const prodcode = String(query.prodcode ?? '').trim();
  const prodname = String(query.prodname ?? '').trim();
  const prodspec = String(query.prodspec ?? '').trim();
  const internalprodcode = String(query.internalprodcode ?? '').trim();

  const { rows, totalItems } = await repo.listRecords({
    size,
    offset,
    prodcode,
    prodname,
    prodspec,
    internalprodcode,
  });

  // Legacy LoopDataArrangementEvents — same projected row shape.
  const result = rows.map((row: any) => ({
    Pmt_Productcode: row.Pmt_Productcode,
    Pmt_Productname: row.Pmt_Productname,
    Pmt_CostCenterCode: row.Pmt_CostCenterCode,
    Pmt_ProdCategory: row.Pmt_ProdCategory,
    Pmt_ProdSource: row.Pmt_ProdSource,
    Pmt_BMstatus: row.Pmt_BMstatus,
    Pmt_ProductSpecification: row.Pmt_ProductSpecification,
    Pmt_InternalProdCode: row.Pmt_InternalProdCode,
    Pmt_status: 'A',
    User_login: row.User_login,
    ludatetime: row.ludatetime,
    selected: false,
  }));

  return { ok: true, result, totalItems };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /product-master/details — single product for the edit modal
// Query: { prodcode } — replicates legacy getProdDetails (node a221217ead06a1e8).
// ════════════════════════════════════════════════════════════════════════════
export async function getDetails(query: any): Promise<DetailsResult> {
  const prodcode = String(query.prodcode ?? '').trim();
  const rows = await repo.getDetails(prodcode);
  return { ok: true, result: rows, totalItems: rows.length };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /product-master — add (duplicate check + INSERT)
// Body: full product field set (same names the legacy controller sent).
// Replicates legacy addProdMaster (node c149067890bed961): count first → if
// the code exists return { status: 'duplicate' }, else INSERT with
// Pmt_status = 'A'.
// ════════════════════════════════════════════════════════════════════════════
export async function addRecord(body: any): Promise<AddResult> {
  const b = body ?? {};
  const prodcode = String(b.prodcode ?? '').trim();

  if (!prodcode) {
    return { ok: false, statusCode: 400, message: 'Product code is required' };
  }

  const fields: Record<string, { value: string | number | Date | null; type: any }> = {
    Pmt_Productcode: { value: prodcode, type: sql.VarChar },
    Pmt_Productname: { value: strOrNull(b.prodname), type: sql.VarChar },
    Pmt_CostCenterCode: { value: strOrNull(b.prodcostcenter), type: sql.VarChar },
    Pmt_ProdRegdate: { value: b.prodregdate ? new Date(b.prodregdate) : null, type: sql.DateTime },
    Pmt_ProdCategory: { value: strOrNull(b.prodcategory), type: sql.VarChar },
    Pmt_ProdSource: { value: strOrNull(b.prodsource), type: sql.VarChar },
    Pmt_RequireCPO: { value: b.reqcpo ? 1 : 0, type: sql.Bit },
    Pmt_ProductUnit: { value: strOrNull(b.produnit), type: sql.VarChar },
    Pmt_BOMControlNo: { value: strOrNull(b.bomcontrolno), type: sql.VarChar },
    Pmt_BOMProdCode: { value: strOrNull(b.bomprodcode), type: sql.VarChar },
    Pmt_BOMType: { value: strOrNull(b.bomtype), type: sql.VarChar },
    Pmt_BMstatus: { value: strOrNull(b.bmstatus), type: sql.VarChar },
    Pmt_HasCurMthPSched: { value: b.hascurpsched ? 1 : 0, type: sql.Bit },
    Pmt_HasNxtMthPSched: { value: b.hasnxtpsched ? 1 : 0, type: sql.Bit },
    Pmt_PSGroupCode: { value: strOrNull(b.psgroupcode) ?? '0', type: sql.VarChar },
    Pmt_MinLotSize: { value: numOrNull(b.minlotsize), type: sql.Int },
    Pmt_MaxLotSize: { value: numOrNull(b.maxlotsize), type: sql.Int },
    Pmt_ProdLeadTime: { value: numOrNull(b.prodleadtime), type: sql.Decimal(18, 2) },
    Pmt_LeadTimeUnit: { value: strOrNull(b.leadtimeunit), type: sql.VarChar },
    Pmt_StdPackingQty: { value: numOrNull(b.stdpackingqty), type: sql.Decimal(18, 2) },
    Pmt_StdPackingUnit: { value: strOrNull(b.stdpackingunit), type: sql.VarChar },
    Pmt_BarcodeHeader: { value: numOrNull(b.barcodeheader), type: sql.Bit },
    Pmt_AccountCode: { value: strOrNull(b.accountcode), type: sql.VarChar },
    Pmt_IsHalfFinished: { value: numOrNull(b.ishalffinished), type: sql.Bit },
    Pmt_LastShipment: { value: b.last_shipment ? new Date(b.last_shipment) : null, type: sql.DateTime },
    Pmt_ProductSpecification: { value: strOrNull(b.prodspec), type: sql.VarChar },
    Pmt_ProductExtCode: { value: strOrNull(b.prodextcode), type: sql.VarChar },
    Pmt_BusinessUnitCode: { value: strOrNull(b.businessunitcode), type: sql.VarChar },
    Pmt_StdNetWeight: { value: numOrNull(b.stdnetweight), type: sql.Decimal(18, 2) },
    Pmt_StdGrossWeight: { value: numOrNull(b.stdgrossweight), type: sql.Decimal(18, 2) },
    Pmt_NetGrossDecDigit: { value: numOrNull(b.netgrossdecdigit), type: sql.SmallInt },
    Pmt_DescCategoryCode: { value: strOrNull(b.desccategorycode), type: sql.VarChar },
    Pmt_InternalProdCode: { value: strOrNull(b.internalprodcode), type: sql.VarChar },
  };

  // ── Duplicate check (legacy node 79764e7672d3f8f7 → switch) ────────────
  const count = await repo.countByCode(prodcode);
  if (count > 0) {
    return { ok: true, duplicate: true, prodcode };
  }

  // ── INSERT (legacy node d99334dd7abfd1c1) — Pmt_status forced to 'A' ───
  const userlogin = String(b.userlogin ?? '').trim();
  await repo.insertRecord(fields, userlogin);

  return { ok: true, duplicate: false, prodcode };
}

// ════════════════════════════════════════════════════════════════════════════
// PUT /product-master — update
// Body: full product field set (same names the legacy controller sent).
// Replicates legacy updateProdMaster (node 24ef3f518b75bea8): full UPDATE
// keyed on Pmt_Productcode, ludatetime = GETDATE().
// ════════════════════════════════════════════════════════════════════════════
export async function updateRecord(body: any): Promise<UpdateResult> {
  const b = body ?? {};
  const prodcode = String(b.prodcode ?? '').trim();

  if (!prodcode) {
    return { ok: false, statusCode: 400, message: 'Product code is required' };
  }

  const sets: string[] = [];
  const inputs: Array<{ name: string; type: any; value: any }> = [];
  const reqToType: Record<string, any> = {
    Pmt_ProdRegdate: sql.DateTime,
    Pmt_LastShipment: sql.DateTime,
    Pmt_MinLotSize: sql.Int,
    Pmt_MaxLotSize: sql.Int,
    Pmt_ProdLeadTime: sql.Decimal(18, 2),
    Pmt_StdPackingQty: sql.Decimal(18, 2),
    Pmt_BarcodeHeader: sql.Bit,
    Pmt_AccountCode: sql.VarChar,
    Pmt_IsHalfFinished: sql.Bit,
    Pmt_StdNetWeight: sql.Decimal(18, 2),
    Pmt_StdGrossWeight: sql.Decimal(18, 2),
    Pmt_NetGrossDecDigit: sql.SmallInt,
  };

  const stringFields: [string, string][] = [
    ['Pmt_Productname', 'prodname'],
    ['Pmt_CostCenterCode', 'prodcostcenter'],
    ['Pmt_ProdCategory', 'prodcategory'],
    ['Pmt_ProdSource', 'prodsource'],
    ['Pmt_ProductUnit', 'produnit'],
    ['Pmt_BOMControlNo', 'bomcontrolno'],
    ['Pmt_BOMProdCode', 'bomprodcode'],
    ['Pmt_BOMType', 'bomtype'],
    ['Pmt_BMstatus', 'bmstatus'],
    ['Pmt_PSGroupCode', 'psgroupcode'],
    ['Pmt_LeadTimeUnit', 'leadtimeunit'],
    ['Pmt_StdPackingUnit', 'stdpackingunit'],
    ['Pmt_ProductSpecification', 'prodspec'],
    ['Pmt_ProductExtCode', 'prodextcode'],
    ['Pmt_BusinessUnitCode', 'businessunitcode'],
    ['Pmt_DescCategoryCode', 'desccategorycode'],
    ['Pmt_InternalProdCode', 'internalprodcode'],
  ];

  const bitFields: [string, string][] = [
    ['Pmt_RequireCPO', 'reqcpo'],
    ['Pmt_HasCurMthPSched', 'hascurpsched'],
    ['Pmt_HasNxtMthPSched', 'hasnxtpsched'],
  ];

  for (const [col, bodyKey] of stringFields) {
    const raw = b[bodyKey];
    const value = raw === undefined || raw === null ? '' : String(raw).trim();
    inputs.push({ name: col, type: sql.VarChar, value });
    sets.push(`[${col}] = @${col}`);
  }

  // Bit columns — treated as flags (legacy sent '0'/'1' raw values).
  for (const [col, bodyKey] of bitFields) {
    const raw = b[bodyKey];
    const value = raw === '0' || raw === 0 || raw === false ? 0 : 1;
    inputs.push({ name: col, type: sql.Bit, value });
    sets.push(`[${col}] = @${col}`);
  }

  // Status passes through from the form (legacy behavior).
  const status = strOrNull(b.status) ?? 'A';
  inputs.push({ name: 'Pmt_status', type: sql.VarChar, value: status });
  sets.push(`[Pmt_status] = @Pmt_status`);

  // User login passes through.
  const userlogin = String(b.userlogin ?? '').trim();
  inputs.push({ name: 'User_login', type: sql.VarChar, value: userlogin });
  sets.push(`[User_login] = @User_login`);

  // Numeric / date / nullable fields (legacy NULL handling).
  for (const [col, type] of Object.entries(reqToType)) {
    const bodyKey = reqBodyKey(col);
    const raw = b[bodyKey];
    if (type === sql.DateTime) {
      const value = raw ? new Date(raw) : null;
      inputs.push({ name: col, type, value });
    } else {
      inputs.push({ name: col, type, value: numOrNull(raw) });
    }
    sets.push(`[${col}] = @${col}`);
  }

  await repo.updateRecord({ prodcode, sets, inputs });

  return { ok: true, prodcode };
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE /product-master — soft delete
// Query: { prodcode, userlogin } — replicates legacy getDeleteProductMaster
// (node 918924e0ea154ba0): UPDATE Pmt_status = 'C'.
// SAFETY GUARD: if any table still references the product, the delete is
// blocked ({ status: 'blocked', references: [...] }).
// ════════════════════════════════════════════════════════════════════════════
export async function deleteRecord(query: any): Promise<DeleteResult> {
  const prodcode = String(query.prodcode ?? '').trim();
  const userlogin = String(query.userlogin ?? '').trim();

  if (!prodcode) {
    return { ok: false, statusCode: 400, message: 'Product code is required' };
  }

  // ── Safety guard: block delete if the product is referenced anywhere ───
  const references = await repo.findReferences(prodcode);
  if (references.length > 0) {
    return {
      ok: true,
      blocked: true,
      prodcode,
      references,
      message: `Product "${prodcode}" cannot be deleted because it is referenced by other records.`,
    };
  }

  await repo.softDelete(prodcode, userlogin);

  return {
    ok: true,
    blocked: false,
    prodcode,
    references: [],
    message: `Product "${prodcode}" deleted successfully.`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /product-master/lookups — all dropdown data in one call
// Combines the four legacy lookup endpoints (getProdCostCenter, getProdUnit,
// getProdAccountCode, getProdGroupCode).
// ════════════════════════════════════════════════════════════════════════════
export async function getLookups() {
  return repo.getLookups();
}
