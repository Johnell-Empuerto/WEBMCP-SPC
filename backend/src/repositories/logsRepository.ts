// Repository:
// Contains the SQL Server queries used by the Logs module.
// The stored procedures dbo.GetLogging / dbo.GetNG are the untouched source of
// truth — this file only reproduces the legacy temp-table flow (INSERT ... EXEC
// into #logs, then a paged SELECT + COUNT) so the results stay byte-for-byte
// identical to the legacy Node-RED /logs endpoint.
//
// All user input is bound as T-SQL parameters; the only strings interpolated
// into the batch are fixed column/alias/order-by values defined below.

import sql, { getPool } from '../config/database';

// Output columns of dbo.GetLogging / dbo.GetNG (the temp tables mirror the
// proc result shapes exactly; every column is NVARCHAR(MAX) so any driver type
// the procs emit — char(10) dates, time(0), datetime, varchars — converts
// cleanly and the text values stay byte-for-byte the same as the legacy API).
const PRODUCTION_COLUMNS = [
  '[Machine Code]',
  '[Date In]',
  '[Time In]',
  '[Parts ID]',
  '[Parts Name]',
  '[Work No.]',
  '[Model]',
  '[Shot No.]',
  '[Operator ID]',
  '[Date Out]',
  '[Time Out]',
  '[Product Judgement]',
];

const NG_COLUMNS = [
  '[Defect]',
  '[Parts ID]',
  '[Process]',
  '[Operator ID]',
  '[Operator Name]',
  '[Scanned Datetime]',
];

// Machine Code / Date In / Time In / Parts ID / Parts Name / Work No. / Model /
// Shot No. / Operator ID / Date Out / Time Out / Product Judgement
const PRODUCTION_ALIASES =
  '[Machine Code] AS machineCode, [Date In] AS dateIn, [Time In] AS timeIn, [Parts ID] AS partsId, [Parts Name] AS partsName, [Work No.] AS workNo, [Model] AS model, [Shot No.] AS shotNo, [Operator ID] AS operatorId, [Date Out] AS dateOut, [Time Out] AS timeOut, [Product Judgement] AS judgement';

// Defect / Parts ID / Process / Operator ID / Operator Name / Scanned Datetime
const NG_ALIASES =
  '[Defect] AS defect, [Parts ID] AS partsId, [Process] AS process, [Operator ID] AS operatorId, [Operator Name] AS operatorName, [Scanned Datetime] AS scannedDatetime';

export interface LogsQueryFilters {
  /** Validated machine value (ADC | MACHINING | KD | NG). */
  machine: string;
  /** true when machine === 'NG' — selects dbo.GetNG instead of dbo.GetLogging. */
  isNg: boolean;
  /** Validated + parsed start of the inclusive date range. */
  dateFrom: Date;
  /** Validated + parsed end of the inclusive date range. */
  dateTo: Date;
  /** Optional free text searched over every returned column. */
  search: string;
  /** Zero-based offset into the result set. */
  offset: number;
  /** Page size (capped by the service). */
  size: number;
}

// Builds the optional free-text search WHERE fragment over the given columns.
// Always parameterized — never string-concatenates user input.
function searchWhere(columns: string[]): string {
  const conds = columns.map(
    (col) => `       OR ${col} LIKE N'%' + @search + N'%'`,
  );
  return `      @search = N''\n${conds.join('\n')}`;
}

// Shared flow for both log types:
//   1. Temp table mirroring the proc output (dropped defensively first — pooled
//      connections keep session-scoped temp tables between batches).
//   2. INSERT … EXEC <proc> — the proc is the untouched source of truth.
//   3. Paged SELECT + COUNT with the optional search, then DROP.
function buildBatch(opts: {
  proc: string;
  columns: string[];
  aliases: string;
  orderBy: string;
}): string {
  const { proc, columns, aliases, orderBy } = opts;
  const create = columns
    .map((col) => `  ${col} NVARCHAR(MAX)`)
    .join(',\n');
  const where = searchWhere(columns);
  return `
SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#logs') IS NOT NULL DROP TABLE #logs;
CREATE TABLE #logs (
${create}
);
INSERT INTO #logs ${proc};

SELECT ${aliases}
FROM #logs
WHERE ${where}
ORDER BY ${orderBy}
OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;

SELECT COUNT(*) AS TotalCount
FROM #logs
WHERE ${where};

DROP TABLE #logs;
`;
}

// GET /logs — run the paged batch for one log type and return the rows plus the
// total item count. The first SELECT is the paged rows; the second is the
// COUNT. Parsed defensively so an extra driver-level resultset can never shift
// the order.
export async function getLogs(
  filters: LogsQueryFilters,
): Promise<{ rows: any[]; totalItems: number }> {
  const { machine, isNg, dateFrom, dateTo, search, offset, size } = filters;

  const batch = buildBatch(
    isNg
      ? {
          proc: `EXEC dbo.GetNG @dateFrom, @dateTo`,
          columns: NG_COLUMNS,
          aliases: NG_ALIASES,
          // 'Mon dd yyyy hh:miAM' strings (style-0 render) — parse back to a
          // datetime so ordering is chronological even across years.
          orderBy: `TRY_CONVERT(datetime, [Scanned Datetime]) DESC`,
        }
      : {
          proc: `EXEC dbo.GetLogging @machine, @dateFrom, @dateTo`,
          columns: PRODUCTION_COLUMNS,
          aliases: PRODUCTION_ALIASES,
          // ADC: sort by machine code (CX-NNN), then date/time.
          // MACHINING/KD: keep default date/time DESC order.
          // Legacy behavior: sort by machine code first, then time chronologically within each machine.
          // ADC: sort by prefix (CX), then date/time ASC.
          // MACHINING/KD: sort by Machine Code (groups AL, DP, WM together), then date/time ASC.
          orderBy: `CASE WHEN @machine = 'ADC' THEN LEFT([Machine Code], CHARINDEX(' ', [Machine Code] + ' ') - 1) ELSE [Machine Code] END ASC, CASE WHEN @machine = 'ADC' THEN CONVERT(datetime, [Date In], 101) ELSE CONVERT(datetime, [Date In], 101) END ASC, CASE WHEN @machine = 'ADC' THEN [Time In] ELSE [Time In] END ASC`,
        },
  );

  const pool = await getPool();
  const request = pool.request();
  if (!isNg) request.input('machine', sql.Char(10), machine);
  // The SP filters by ludatetime but displays Date In (input time).
  // Add 1 day to both dates so records whose Date In matches the target day
  // are captured by their ludatetime being on the next day.
  const dateFromAdj = new Date(dateFrom);
  dateFromAdj.setDate(dateFromAdj.getDate() + 1);
  request.input('dateFrom', sql.DateTime, dateFromAdj);
  const dateToEnd = new Date(dateTo);
  dateToEnd.setDate(dateToEnd.getDate() + 1);
  request.input('dateTo', sql.DateTime, dateToEnd);
  console.log(`[logs] machine=${machine} dateFrom=${dateFrom.toISOString().slice(0,10)} -> adjusted=${dateFromAdj.toISOString().slice(0,10)} dateTo=${dateTo.toISOString().slice(0,10)} -> adjusted=${dateToEnd.toISOString().slice(0,10)} page=${offset}/${size}`);
  request.input('search', sql.NVarChar(500), search);
  request.input('offset', sql.Int, offset);
  request.input('size', sql.Int, size);

  const result = await request.query(batch);
  const recordsets: any[][] = Array.isArray(result.recordsets)
    ? result.recordsets
    : [result.recordset ?? []];

  let rows: any[] = [];
  let totalItems = 0;
  for (const rs of recordsets) {
    if (!Array.isArray(rs)) continue;
    const first = rs[0] as any;
    if (rs.length > 0 && first && typeof first === 'object' && 'TotalCount' in first) {
      totalItems = Number(first.TotalCount) || 0;
    } else if (rows.length === 0) {
      rows = rs;
    }
  }

  return { rows, totalItems };
}