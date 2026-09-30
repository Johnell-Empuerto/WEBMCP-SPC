import path from "path";
import ExcelJS from "exceljs";
import sql, { getPool } from "../config/database";

const TEMPLATE_FILE = path.resolve(
  __dirname,
  "../../assets/templates/CodeMarkingEntry.xlsx",
);

const PRODUCTION_LINES = ["ADC 1", "ADC 2", "ADC 3", "C4", "KD"];

const DATA_ROW_START = 2;
const DATA_ROW_END = 100;

export interface TemplateOptions {
  yearmonth: string;
  includeHistory: boolean;
}

/**
 * Generate a production-ready CodeMarkingEntry workbook by:
 *
 * 1. Opening the original legacy template as the base
 * 2. Setting the correct day headers for the requested month
 * 3. Adding Excel data-validation dropdown lists for:
 *    - Production Line (from config)
 *    - Cost Center Code (from SQL Server T_CostCenter)
 *    - Product Code (from SQL Server T_ProductMaster)
 * 4. Optionally populating existing planning records from T_ProductionPlanning
 *
 * The result is functionally identical to the legacy workbook while
 * being dynamically generated with current master data.
 */
export async function generateTemplate(
  options: TemplateOptions,
): Promise<ExcelJS.Workbook> {
  const { yearmonth, includeHistory } = options;
  const [yearStr, monthStr] = yearmonth.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const lastDay = new Date(year, month, 0).getDate();

  // ── 1. Open the original template workbook ──
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_FILE);

  const worksheet = workbook.getWorksheet("Worksheet");
  if (!worksheet) {
    throw new Error(
      'Template worksheet "Worksheet" not found in the base file.',
    );
  }

  // ── 2. Set day headers for the requested month ──
  const headerRow = worksheet.getRow(1);
  for (let i = 1; i <= lastDay; i++) {
    const cell = headerRow.getCell(i + 5); // Col F onward (1-based: 1=A, 6=F)
    cell.value = `${String(month).padStart(2, "0")}/${String(i).padStart(2, "0")}`;
  }
  // Clear any excess day columns beyond this month's lastDay
  for (let i = lastDay + 1; i <= 31; i++) {
    const cell = headerRow.getCell(i + 5);
    cell.value = "";
  }
  headerRow.commit();

  // ── 3. Load reference data from SQL Server ──
  let costCenters: string[] = [];
  let productCodes: string[] = [];

  try {
    const pool = await getPool();
    const [ccResult, pcResult] = await Promise.all([
      pool.request().query(`
        SELECT DISTINCT TRIM(Cct_CostCenterCode) AS CostCenter, Scm_ShiftCode as ShiftCode
        FROM T_SectionCodeMaster
        INNER JOIN T_CostCenter ON Scm_Sectioncode = Cct_Sectioncode
        INNER JOIN T_ShiftCodeMaster ON Scm_SectionHead = Scm_ShiftCode
        ORDER BY Scm_ShiftCode ASC
      `),
      pool.request().query(`
        SELECT TRIM(Pmt_Productcode) AS ProdCode, TRIM(Pmt_Productname) AS ProdName
        FROM T_ProductMaster
        WHERE Pmt_status = 'A' AND Pmt_Productcode IS NOT NULL
      `),
    ]);
    costCenters = ccResult.recordset.map(
      (r: any) => `${r.CostCenter} - ${r.ShiftCode}`,
    );
    productCodes = pcResult.recordset.map((r: any) => `${r.ProdCode} - ${r.ProdName}`);
  } catch (err) {
    console.error("[TemplateGenerator] Failed to load reference data:", err);
  }

  // ── 4. Add data-validation dropdowns ──
  const dataValidationRange = `A${DATA_ROW_START}:E${DATA_ROW_END}`;

  // Cast worksheet to any for dataValidations access (ExcelJS types may not cover all APIs)
  const ws = worksheet as any;

  // ── Clear existing data validations from base template ──
  const dvStore = ws.dataValidations;
  if (dvStore && dvStore.model && typeof dvStore.model === 'object') {
    const keysToDelete: string[] = [];
    for (const key of Object.keys(dvStore.model)) {
      if (/^[A-C]/.test(key)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      delete dvStore.model[key];
    }
  }

  // Production Line (col A) — static list from config
  if (PRODUCTION_LINES.length > 0) {
    ws.dataValidations.add(`A${DATA_ROW_START}:A${DATA_ROW_END}`, {
      type: "list",
      allowBlank: true,
      showInputMessage: true,
      showErrorMessage: true,
      formulae: [`"${PRODUCTION_LINES.join(",")}"`],
    });
  }

  // Cost Center Code (col B) — from SQL Server
  if (costCenters.length > 0) {
    ws.dataValidations.add(`B${DATA_ROW_START}:B${DATA_ROW_END}`, {
      type: "list",
      allowBlank: true,
      showInputMessage: true,
      showErrorMessage: true,
      formulae: [`"${costCenters.join(",")}"`],
    });
  }

  // Product Code (col C) — from SQL Server
  if (productCodes.length > 0) {
    ws.dataValidations.add(`C${DATA_ROW_START}:C${DATA_ROW_END}`, {
      type: "list",
      allowBlank: true,
      showInputMessage: true,
      showErrorMessage: true,
      formulae: [`"${productCodes.join(",")}"`],
    });
  }

  // ── Remove strikethrough from base template on cols A-C ──
  for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
    for (const col of [1, 2, 3]) {
      const cell = worksheet.getRow(r).getCell(col);
      if (cell.font) {
        cell.font = { ...cell.font, strike: false };
      }
    }
  }

  // ── 5. Optionally populate history data ──
  if (includeHistory) {
    const startDate = `${yearmonth}-01`;
    const endDate = `${yearmonth}-${String(lastDay).padStart(2, "0")}`;

    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input("startDate", sql.NVarChar, startDate)
        .input("endDate", sql.NVarChar, endDate).query(`
          SELECT
            Ppt_Line,
            Ppt_CostCenterCode,
            Ppt_ProductCode,
            Ppt_RevNo,
            Ppt_EditNo,
            Ppt_PlanDate,
            Ppt_PlanQty
          FROM T_ProductionPlanning
          WHERE Ppt_PlanDate >= @startDate AND Ppt_PlanDate <= @endDate
          ORDER BY Ppt_ProductCode, Ppt_PlanDate ASC
        `);

      const records = result.recordset;

      // Group by (line, costcenter, prodcode, revno, editno)
      const grouped = new Map<
        string,
        {
          prodline: string;
          costcenter: string;
          prodcode: string;
          revno: string;
          editno: string;
          daily: Map<number, number>;
        }
      >();

      for (const row of records) {
        const day = new Date(row.Ppt_PlanDate).getDate();
        const key = `${row.Ppt_Line}|${row.Ppt_CostCenterCode}|${row.Ppt_ProductCode}|${row.Ppt_RevNo}|${row.Ppt_EditNo}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            prodline: row.Ppt_Line,
            costcenter: row.Ppt_CostCenterCode,
            prodcode: row.Ppt_ProductCode,
            revno: row.Ppt_RevNo || "",
            editno: row.Ppt_EditNo || "",
            daily: new Map(),
          });
        }
        const entry = grouped.get(key)!;
        entry.daily.set(
          day,
          (entry.daily.get(day) || 0) + (row.Ppt_PlanQty || 0),
        );
      }

      // Write grouped data into the worksheet starting at row 2
      let rowIdx = DATA_ROW_START;
      for (const [, entry] of grouped) {
        if (rowIdx > DATA_ROW_END) break;

        const row = worksheet.getRow(rowIdx);
        row.getCell(1).value = entry.prodline;
        row.getCell(2).value = entry.costcenter;
        row.getCell(3).value = entry.prodcode;
        row.getCell(4).value = entry.revno;
        row.getCell(5).value = entry.editno;

        for (let d = 1; d <= lastDay; d++) {
          row.getCell(d + 5).value = entry.daily.get(d) ?? null;
        }

        row.commit();
        rowIdx++;
      }
    } catch (err) {
      console.error("[TemplateGenerator] Error loading history:", err);
    }
  }

  return workbook;
}
