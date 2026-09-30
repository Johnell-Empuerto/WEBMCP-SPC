import sql, { getPool } from "../config/database";
import * as XLSX from "xlsx";
import type {
  CostCenter,
  ProductCode,
  PlanUploaderTemplate,
  UploadValidationRow,
  ValidationError,
  UploadValidationResponse,
  InsertResult,
  HistoryResponse,
} from "../types/planUploader";

// ── Template Configuration ──

const PRODUCTION_LINES = ["ADC 1", "ADC 2", "ADC 3", "C4", "KD"];

function getTemplateId(month: number, lastDay: number): string {
  switch (month) {
    case 1:
      return "3";
    case 2:
      return lastDay === 29 ? "6" : "5";
    case 3:
      return "7";
    case 4:
      return "8";
    case 5:
      return "9";
    case 6:
      return "10";
    case 7:
      return "11";
    case 8:
      return "12";
    case 9:
      return "13";
    case 10:
      return "14";
    case 11:
      return "15";
    case 12:
      return "17";
    default:
      return "16";
  }
}

const TEMPLATES: PlanUploaderTemplate[] = [
  {
    id: "3",
    name: "CodeMarkingEntry (January)",
    month: 1,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "5",
    name: "CodeMarkingEntry (February)",
    month: 2,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "6",
    name: "CodeMarkingEntry (February Leap)",
    month: 2,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "7",
    name: "CodeMarkingEntry (March)",
    month: 3,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "8",
    name: "CodeMarkingEntry (April)",
    month: 4,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "9",
    name: "CodeMarkingEntry (May)",
    month: 5,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "10",
    name: "CodeMarkingEntry (June)",
    month: 6,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "11",
    name: "CodeMarkingEntry (July)",
    month: 7,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "12",
    name: "CodeMarkingEntry (August)",
    month: 8,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "13",
    name: "CodeMarkingEntry (September)",
    month: 9,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "14",
    name: "CodeMarkingEntry (October)",
    month: 10,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "15",
    name: "CodeMarkingEntry (November)",
    month: 11,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "17",
    name: "CodeMarkingEntry (December)",
    month: 12,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
  {
    id: "16",
    name: "CodeMarkingEntry (Default)",
    month: 0,
    columns:
      "PRODLINE,COSTCENTERCODE,PRODCODE,REVNO,EDITNO,D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28",
    folderName: "codemarkingentry",
    phpName: "codemarkingentry.php",
    phpIns: "codemarkingentry_ins.php",
  },
];

// ── Reference Data ──

export async function getCostCenters(): Promise<CostCenter[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TRIM(Cct_CostCenterCode) AS CostCenter, Scm_ShiftCode as ShiftCode
    FROM T_SectionCodeMaster
    INNER JOIN T_CostCenter ON Scm_Sectioncode = Cct_Sectioncode
    INNER JOIN T_ShiftCodeMaster ON Scm_SectionHead = Scm_ShiftCode
    ORDER BY Scm_ShiftCode ASC
  `);
  return result.recordset;
}

export async function getProductCodes(): Promise<ProductCode[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TRIM(Pmt_Productcode) AS ProdCode
    FROM T_ProductMaster
    WHERE Pmt_status = 'A'
  `);
  return result.recordset;
}

export function getTemplates(month: number): PlanUploaderTemplate[] {
  const date = new Date();
  date.setMonth(month - 1);
  const lastDay = new Date(date.getFullYear(), month, 0).getDate();
  const templateId = getTemplateId(month, lastDay);
  // Return the matching template
  const tmpl = TEMPLATES.find((t) => t.id === templateId);
  return tmpl ? [tmpl] : [];
}

export function getTemplateList(month: number): PlanUploaderTemplate[] {
  return getTemplates(month);
}

export function getTemplateById(id: string): PlanUploaderTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

// ── Excel Parsing & Validation ──

export async function validateUpload(
  base64File: string,
  selectedYearMonth: string,
  costCenters: string[],
  productCodes: string[],
  empId: string,
  curday: string,
  curyearmonth: string,
): Promise<UploadValidationResponse> {
  const errors: ValidationError[] = [];
  const validRows: UploadValidationRow[] = [];
  const maxRows = 500;

  // Decode and parse Excel file
  let workbook: XLSX.WorkBook;
  try {
    const buffer = Buffer.from(base64File, "base64");
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    errors.push({
      row: 0,
      err: "Failed to parse Excel file. Invalid file format.",
    });
    return {
      status: "error",
      errs: errors,
      ins: [],
      totalRows: 0,
      totalErrors: 1,
      totalValid: 0,
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    errors.push({ row: 0, err: "Excel file has no sheets." });
    return {
      status: "error",
      errs: errors,
      ins: [],
      totalRows: 0,
      totalErrors: 1,
      totalValid: 0,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  // ── Trim trailing fully-empty rows to match SimpleXLSX behavior ──
  // SimpleXLSX::rows() returns only rows that have at least one cell value.
  // xlsx's sheet_to_json() returns ALL rows within the !ref range, including
  // rows that are completely null (caused by data-validation ranges extending
  // the worksheet dimensions to row 100). We strip them before processing.
  while (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (
      !lastRow ||
      (Array.isArray(lastRow) &&
        (lastRow as any[]).every(
          (c) => c === null || c === undefined || c === "",
        ))
    ) {
      rows.pop();
    } else {
      break;
    }
  }

  if (rows.length === 0) {
    errors.push({ row: 0, err: "Excel file is empty." });
    return {
      status: "error",
      errs: errors,
      ins: [],
      totalRows: 0,
      totalErrors: 1,
      totalValid: 0,
    };
  }

  // Calculate month info
  const [yearStr, monthStr] = selectedYearMonth.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const datePlanPeriod = `${selectedYearMonth}-01 00:00:00`;

  // Process header row (row 0)
  const headerRow = rows[0];
  if (!headerRow || headerRow.length < 6) {
    errors.push({
      row: 1,
      err: "Invalid Excel template. Expected headers in row 1.",
    });
    return {
      status: "error",
      errs: errors,
      ins: [],
      totalRows: 0,
      totalErrors: 1,
      totalValid: 0,
    };
  }

  // Extract month from header (legacy: col 5 contains the month indicator like "07/01")
  const monthIndicator = String(headerRow[5] || "");
  const excelMonth = monthIndicator.substring(0, 2).replace(/[^0-9]/g, "");
  const monthStrPadded = monthStr.padStart(2, "0");

  if (excelMonth !== monthStrPadded) {
    // Try to get the month name for the error message
    const monthNames = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    errors.push({
      row: 1,
      err: `Invalid file date: the file is dated in ${monthNames[parseInt(excelMonth)] || excelMonth}`,
    });
    return {
      status: "error",
      errs: errors,
      ins: [],
      totalRows: 0,
      totalErrors: 1,
      totalValid: 0,
    };
  }

  // Build day headers
  const dayHeaders: Record<string, string> = {};
  for (let i = 1; i <= lastDay; i++) {
    const index = i + 4; // Columns 5+ are day columns
    if (headerRow[index] !== null && headerRow[index] !== undefined) {
      dayHeaders[`d${i}`] = String(headerRow[index]).trim();
    }
  }

  // Process data rows (rows 1+)
  const seenCombinations = new Set<string>();

  for (let kk = 1; kk < rows.length && kk <= maxRows; kk++) {
    const elt = rows[kk];
    if (!elt || elt.length < 3) continue;

    // Check if it's a valid data row (col 2 should not be "prodcode" header text)
    const col2 = String(elt[2] || "")
      .toLowerCase()
      .trim();
    if (col2 === "prodcode") {
      errors.push({ row: 0, err: "Product Code does not exist" });
      return {
        status: "error",
        errs: errors,
        ins: [],
        totalRows: 0,
        totalErrors: 0,
        totalValid: 0,
      };
    }

    const prodline = String(elt[0] || "").trim();
    const costcentercodeRaw = String(elt[1] || "").trim();
    const costcentercode = costcentercodeRaw.includes(" - ")
      ? costcentercodeRaw.split(" - ")[0].trim()
      : costcentercodeRaw;
    const prodcodeRaw = String(elt[2] || "").trim();
    const prodcode = prodcodeRaw.includes(" - ") ? prodcodeRaw.split(" - ")[0].trim() : prodcodeRaw;
    const revno = String(elt[3] || "").trim();
    const editno = String(elt[4] || "").trim();

    // Validate production line
    if (!PRODUCTION_LINES.includes(prodline)) {
      errors.push({
        row: kk + 1,
        err: `Production line (${prodline}) does not exist`,
      });
      continue;
    }

    // Validate cost center
    if (!costCenters.includes(costcentercode)) {
      errors.push({
        row: kk + 1,
        err: `Cost Center Code (${costcentercode}) does not exist`,
      });
      continue;
    }

    // Validate product code
    if (!productCodes.includes(prodcode)) {
      if (prodcode) {
        errors.push({
          row: kk + 1,
          err: `Product Code (${prodcode}) does not exist`,
        });
      }
      continue;
    }

    // Process each day column
    let hasValidDay = false;
    const dayValues: Record<string, number | string> = {};

    for (let i = 1; i <= lastDay; i++) {
      const key = `d${i}`;

      // Skip if day header doesn't match
      if (!dayHeaders[key]) continue;

      const expectedDate = `${monthStrPadded}/${String(i).padStart(2, "0")}`;
      if (dayHeaders[key] !== expectedDate) continue;

      const index = i + 4;
      const rawVal = elt[index];
      const planQtyVal =
        rawVal !== null && rawVal !== undefined && rawVal !== ""
          ? parseFloat(String(rawVal))
          : 0;

      const dayNumber = String(i).padStart(2, "0");
      const plandate = `${selectedYearMonth}-${dayNumber} 00:00:00`;

      const planQtyNumeric = isNaN(planQtyVal) ? 0 : planQtyVal;
      const combinationKey = `${prodline}|${prodcode}|${costcentercode}|${datePlanPeriod}|${plandate}`;

      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);

        validRows.push({
          row: kk + 1,
          prodline,
          costcentercode,
          prodcode,
          revno,
          editno,
          planperiod: datePlanPeriod,
          planqty: planQtyNumeric,
          dayValues: { ...dayValues, [key]: planQtyNumeric },
        });

        errors.push({
          row: kk + 1,
          err: `Successfully Validated (Prod Line: ${prodline}, Prod Code: ${prodcode}, Plan Date: ${dayHeaders[key]}, Plan Qty: ${planQtyNumeric})`,
        });

        hasValidDay = true;
      } else {
        errors.push({
          row: kk + 1,
          err: `Duplicate Entry (Prod Line: ${prodline}, Prod Code: ${prodcode}, Plan Date: ${dayHeaders[key]}, Plan Qty: ${planQtyNumeric})`,
        });
      }
    } // If we didn't process any day but prodcode is empty, it's an error
    if (!hasValidDay && !prodcode) {
      errors.push({
        row: kk + 1,
        err: `ProdCode not found`,
      });
    }
  }

  // Count ONLY actual validation failures (not success messages in the errs log)
  // The errs array contains ALL messages (both success and failure) matching legacy PHP behavior.
  // But totalErrors must only count real failures — messages not starting with "Successfully".
  const totalErrors = errors.filter(
    (e) => !e.err.startsWith("Successfully"),
  ).length;
  const totalValid = validRows.length;

  return {
    status: totalErrors > 0 ? "error" : "success",
    errs: errors,
    ins: validRows,
    totalRows: rows.length - 1,
    totalErrors,
    totalValid,
  };
}

// ── Insert / Update Records ──

export async function insertRecords(
  base64File: string,
  selectedYearMonth: string,
  costCenters: string[],
  productCodes: string[],
  empId: string,
): Promise<InsertResult> {
  const errors: ValidationError[] = [];
  const inserted: UploadValidationRow[] = [];
  const updated: UploadValidationRow[] = [];
  const maxRows = 500;

  // Parse Excel
  let workbook: XLSX.WorkBook;
  try {
    const buffer = Buffer.from(base64File, "base64");
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    errors.push({ row: 0, err: "Failed to parse Excel file." });
    return {
      status: "error",
      errs: errors,
      ins: [],
      update: [],
      totalInserted: 0,
      totalUpdated: 0,
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    errors.push({ row: 0, err: "Excel file has no sheets." });
    return {
      status: "error",
      errs: errors,
      ins: [],
      update: [],
      totalInserted: 0,
      totalUpdated: 0,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  // ── Trim trailing fully-empty rows (matching SimpleXLSX behavior) ──
  while (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (
      !lastRow ||
      (Array.isArray(lastRow) &&
        (lastRow as any[]).every(
          (c) => c === null || c === undefined || c === "",
        ))
    ) {
      rows.pop();
    } else {
      break;
    }
  }

  if (rows.length === 0) {
    errors.push({ row: 0, err: "Excel file is empty." });
    return {
      status: "error",
      errs: errors,
      ins: [],
      update: [],
      totalInserted: 0,
      totalUpdated: 0,
    };
  }

  const [yearStr, monthStr] = selectedYearMonth.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const datePlanPeriod = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);

  // Process header
  const headerRow = rows[0];
  const monthIndicator = String(headerRow?.[5] || "");
  const excelMonth = monthIndicator.substring(0, 2).replace(/[^0-9]/g, "");
  const monthStrPadded = monthStr.padStart(2, "0");

  if (excelMonth !== monthStrPadded) {
    errors.push({ row: 1, err: `Invalid file date.` });
    return {
      status: "error",
      errs: errors,
      ins: [],
      update: [],
      totalInserted: 0,
      totalUpdated: 0,
    };
  }

  // Build day headers
  const dayHeaders: Record<string, string> = {};
  for (let i = 1; i <= lastDay; i++) {
    const index = i + 4;
    if (headerRow[index] !== null && headerRow[index] !== undefined) {
      dayHeaders[`d${i}`] = String(headerRow[index]).trim();
    }
  }

  const pool = await getPool();

  for (let kk = 1; kk < rows.length && kk <= maxRows; kk++) {
    const elt = rows[kk];
    if (!elt || elt.length < 3) continue;

    const prodline = String(elt[0] || "").trim();
    const costcentercodeRaw = String(elt[1] || "").trim();
    const costcentercode = costcentercodeRaw.includes(" - ")
      ? costcentercodeRaw.split(" - ")[0].trim()
      : costcentercodeRaw;
    const prodcodeRaw = String(elt[2] || "").trim();
    const prodcode = prodcodeRaw.includes(" - ") ? prodcodeRaw.split(" - ")[0].trim() : prodcodeRaw;
    const revno = String(elt[3] || "").trim();
    const editno = String(elt[4] || "").trim();

    // Validate production line
    if (!PRODUCTION_LINES.includes(prodline)) {
      errors.push({
        row: kk + 1,
        err: `Production line (${prodline}) does not exist`,
      });
      continue;
    }

    // Validate cost center
    if (!costCenters.includes(costcentercode)) {
      errors.push({
        row: kk + 1,
        err: `Cost Center Code (${costcentercode}) does not exist`,
      });
      continue;
    }

    // Validate product code
    if (!productCodes.includes(prodcode)) {
      if (prodcode) {
        errors.push({
          row: kk + 1,
          err: `Product Code (${prodcode}) does not exist`,
        });
      }
      continue;
    }

    // Process each day
    for (let i = 1; i <= lastDay; i++) {
      const key = `d${i}`;
      if (!dayHeaders[key]) continue;

      const expectedDate = `${monthStrPadded}/${String(i).padStart(2, "0")}`;
      if (dayHeaders[key] !== expectedDate) continue;

      const index = i + 4;
      const rawVal = elt[index];
      if (rawVal === null || rawVal === undefined || rawVal === "") continue;

      const planqty = parseFloat(String(rawVal));
      if (isNaN(planqty)) continue;

      const plandate = `${yearStr}-${monthStr.padStart(2, '0')}-${String(i).padStart(2, '0')}`;

      // Check if record exists in SQL Server T_ProductionPlanning
      const checkResult = await pool
        .request()
        .input("prodline", sql.NVarChar(250), prodline)
        .input("prodcode", sql.NVarChar(250), prodcode)
        .input("costcentercode", sql.NVarChar(250), costcentercode)
        .input("planperiod", sql.NVarChar, datePlanPeriod)
        .input("plandate", sql.NVarChar, plandate).query(`
          SELECT COUNT(*) AS cnt FROM T_ProductionPlanning
          WHERE Ppt_Line = @prodline
            AND Ppt_ProductCode = @prodcode
            AND Ppt_CostCenterCode = @costcentercode
            AND Ppt_PlanPeriod = @planperiod
            AND Ppt_PlanDate = @plandate
        `);

      const recordCount = checkResult.recordset[0]?.cnt ?? 0;
      const recordExists = recordCount > 0;

      if (recordExists) {
        // UPDATE existing record
        await pool
          .request()
          .input("prodline", sql.NVarChar(250), prodline)
          .input("prodcode", sql.NVarChar(250), prodcode)
          .input("costcentercode", sql.NVarChar(250), costcentercode)
          .input("planperiod", sql.NVarChar, datePlanPeriod)
          .input("plandate", sql.NVarChar, plandate)
          .input("revno", sql.NVarChar(250), revno)
          .input("editno", sql.NVarChar(250), editno)
          .input("planqty", sql.Decimal(18, 2), planqty)
          .input("updateby", sql.NVarChar(250), empId)
          .input("ludatetime", sql.DateTime, new Date(now)).query(`
            UPDATE T_ProductionPlanning SET
              Ppt_RevNo = @revno,
              Ppt_EditNo = @editno,
              Ppt_PlanQty = @planqty,
              Ppt_UpdatedBy = @updateby,
              User_Login = @updateby,
              ludatetime = @ludatetime
            WHERE Ppt_Line = @prodline
              AND Ppt_ProductCode = @prodcode
              AND Ppt_CostCenterCode = @costcentercode
              AND Ppt_PlanPeriod = @planperiod
              AND Ppt_PlanDate = @plandate
          `);

        updated.push({
          row: kk + 1,
          prodline,
          costcentercode,
          prodcode,
          revno,
          editno,
          planperiod: datePlanPeriod,
          planqty,
          dayValues: { [key]: planqty },
        });

        errors.push({
          row: kk + 1,
          err: `Successfully Updated (Prod Line: ${prodline}, Prod Code: ${prodcode}, Date: ${dayHeaders[key]}, Qty: ${planqty})`,
        });
      } else {
        // INSERT new record
        await pool
          .request()
          .input("prodline", sql.NVarChar(250), prodline)
          .input("prodcode", sql.NVarChar(250), prodcode)
          .input("costcentercode", sql.NVarChar(250), costcentercode)
          .input("planperiod", sql.NVarChar, datePlanPeriod)
          .input("revno", sql.NVarChar(250), revno)
          .input("editno", sql.NVarChar(250), editno)
          .input("plandate", sql.NVarChar, plandate)
          .input("planqty", sql.Decimal(18, 2), planqty)
          .input("updateby", sql.NVarChar(250), empId)
          .input("status", sql.NVarChar(10), "A")
          .input("userlogin", sql.NVarChar(250), empId)
          .input("ludatetime", sql.DateTime, new Date(now)).query(`
            INSERT INTO T_ProductionPlanning
              (Ppt_Line, Ppt_ProductCode, Ppt_CostCenterCode, Ppt_PlanPeriod,
               Ppt_RevNo, Ppt_EditNo, Ppt_PlanDate, Ppt_PlanQty,
               Ppt_UpdatedBy, Ppt_Status, User_Login, ludatetime)
            VALUES
              (@prodline, @prodcode, @costcentercode, @planperiod,
               @revno, @editno, @plandate, @planqty,
               @updateby, @status, @userlogin, @ludatetime)
          `);

        inserted.push({
          row: kk + 1,
          prodline,
          costcentercode,
          prodcode,
          revno,
          editno,
          planperiod: datePlanPeriod,
          planqty,
          dayValues: { [key]: planqty },
        });

        errors.push({
          row: kk + 1,
          err: `Successfully Inserted (Prod Line: ${prodline}, Prod Code: ${prodcode}, Date: ${dayHeaders[key]}, Qty: ${planqty})`,
        });
      }
    }
  }

  return {
    status: inserted.length > 0 || updated.length > 0 ? "success" : "error",
    errs: errors,
    ins: inserted,
    update: updated,
    totalInserted: inserted.length,
    totalUpdated: updated.length,
  };
}

// ── History ──

export async function checkHistory(
  yearmonth: string,
): Promise<HistoryResponse> {
  const pool = await getPool();
  const [year, month] = yearmonth.split("-");
  const startDate = `${yearmonth}-01 00:00:00`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${yearmonth}-${String(lastDay).padStart(2, "0")} 00:00:00`;

  const result = await pool
    .request()
    .input("startDate", sql.DateTime, new Date(startDate))
    .input("endDate", sql.DateTime, new Date(endDate)).query(`
      SELECT COUNT(*) AS cnt FROM T_ProductionPlanning
      WHERE Ppt_PlanDate >= @startDate AND Ppt_PlanDate <= @endDate
    `);

  const count = result.recordset[0]?.cnt ?? 0;
  return { exists: count > 0, count };
}
