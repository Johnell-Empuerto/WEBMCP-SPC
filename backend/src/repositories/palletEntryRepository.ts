import sql, { getPool } from '../config/database';
import type { PalletHeaderRow } from '../types/palletEntry';

export async function getPallets(filter: {
  status?: string
  formattedDate?: string
  partNo?: string
}): Promise<PalletHeaderRow[]> {
  const pool = await getPool();
  const conditions: string[] = [];

  if (filter.status) {
    conditions.push(`Plh_Status = @status`);
  }
  if (filter.formattedDate) {
    conditions.push(`Plh_Date = @formattedDate`);
  }
  if (filter.partNo) {
    conditions.push(`Plh_PartNo = @partNo`);
  }

  const where = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : "WHERE Plh_Status = 'A'";

  const query = `SELECT * FROM E_PalletLoadingHeader ${where}`;
  const request = pool.request();
  if (filter.status) request.input('status', sql.NVarChar, filter.status);
  if (filter.formattedDate) request.input('formattedDate', sql.NVarChar, filter.formattedDate);
  if (filter.partNo) request.input('partNo', sql.NVarChar, filter.partNo);

  const result = await request.query(query);
  return result.recordset as PalletHeaderRow[];
}

export async function getPalletByPLCode(plCode: string): Promise<PalletHeaderRow[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('plCode', sql.NVarChar, plCode)
    .query(`SELECT * FROM E_PalletLoadingHeader WHERE Plh_PLCode = @plCode`);
  return result.recordset as PalletHeaderRow[];
}

export async function getCustomerCodes(): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .query(`SELECT Ccm_CustomerCode, Ccm_CustomerName FROM T_CustomerCodeMaster`);
  return result.recordset;
}

export async function getProductByPartNo(partNo: string): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('partNo', sql.NVarChar, partNo)
    .query(`SELECT * FROM T_ProductMaster WHERE Pmt_ProductCode = @partNo`);
  return result.recordset;
}

export async function countPalletsByOrderDatePrefix(prefix: string): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input('prefix', sql.NVarChar, prefix)
    .query(`SELECT COUNT(*) AS EntryCount FROM E_PalletLoadingHeader WHERE LEFT(CONVERT(varchar, Plh_OrderDate), 2) = @prefix`);
  const row = result.recordset[0];
  return row ? Number(row.EntryCount) : 0;
}

export async function updatePallets(plCodes: string[], update: {
  controlNo?: string | null
  date?: string | null
  customerCode?: string | null
  destination?: string | null
  poNumber?: string | null
  invoiceNo?: string | null
  orderDate?: string | number | null
  caseNo?: string | null
  partNo?: string | null
  productName?: string | null
  packingDate?: string | null
  orderNo?: string | null
  quantity?: number | null
  weight?: number | null
  boxNo?: string | null
  palletCount?: number | null
  user_login?: string
}): Promise<void> {
  const pool = await getPool();
  const request = pool.request();

  const sets: string[] = [];

  const push = (column: string, value: any, type?: any) => {
    if (value === null || value === undefined || value === '') {
      return;
    }
    const param = `${column}_0`;
    sets.push(`${column} = @${param}`);
    if (type) request.input(param, type, value);
    else request.input(param, value);
  };

  const pushNum = (column: string, value: any) => {
    if (value === null || value === undefined || value === '') {
      return;
    }
    const n = Number(value);
    if (isNaN(n)) return;
    const param = `${column}_0`;
    sets.push(`${column} = @${param}`);
    request.input(param, sql.Float, n);
  };

  push('Plh_ControlNo', update.controlNo);
  push('Plh_Date', update.date, sql.NVarChar);
  push('Plh_CustomerCode', update.customerCode);
  push('Plh_Destination', update.destination);
  push('Plh_PONo', update.poNumber);
  push('Plh_InvoiceNo', update.invoiceNo);
  push('Plh_OrderDate', update.orderDate === null || update.orderDate === undefined || update.orderDate === '' ? undefined : update.orderDate, sql.Int);
  push('Plh_CaseNo', update.caseNo);
  push('Plh_PartNo', update.partNo);
  push('Plh_ProductName', update.productName);
  push('Plh_PackingDate', update.packingDate, sql.NVarChar);
  push('Plh_OrderNo', update.orderNo);
  pushNum('Plh_Quantity', update.quantity);
  pushNum('Plh_Weight', update.weight);
  pushNum('Plh_BoxNo', update.boxNo);
  pushNum('Plh_PalletCount', update.palletCount);

  if (update.user_login) push('User_Login', update.user_login);

  // Legacy always ends with status F
  sets.push(`Plh_Status = 'F'`);

  const setClause = sets.join(', ');
  const whereClause = plCodes.map((_, i) => `Plh_PLCode = @id${i}`).join(' OR ');

  plCodes.forEach((code, i) => request.input(`id${i}`, sql.NVarChar, code));

  const query = `UPDATE E_PalletLoadingHeader SET ${setClause} WHERE ${whereClause}`;

  if (plCodes.length > 0) {
    await request.query(query);
  }
}

// Cancelling pallets is one business action that writes to TWO tables
// (E_PalletLoadingHeader and E_PalletLoadingDetail). Both updates run inside a
// single SQL Server transaction so a failure can never leave the header
// cancelled while its details are still active (or vice versa).
export async function cancelPallets(plCodes: string[]): Promise<void> {
  if (plCodes.length === 0) return;

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const request = transaction.request();
    const placeholders = plCodes.map((_, i) => `@id${i}`).join(', ');
    plCodes.forEach((code, i) => request.input(`id${i}`, sql.NVarChar, code));

    // Both UPDATE statements run through the same transaction.
    await request.query(`
      UPDATE E_PalletLoadingHeader SET Plh_Status = 'C'
      WHERE Plh_PLCode IN (${placeholders});

      UPDATE E_PalletLoadingDetail SET Pld_Status = 'C'
      WHERE Pld_PLCode IN (${placeholders});
    `);

    // Header and details were both cancelled — make it permanent.
    await transaction.commit();
  } catch (error) {
    // Undo the cancellation so no partial cancel state remains. If SQL Server
    // already aborted the transaction (e.g. a runtime error raised
    // "Transaction has been aborted"), rollback is a no-op — the server rolled
    // back everything and released the connection itself.
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Normally "Transaction has been aborted" — the server already rolled
      // everything back and released the connection. If anything else is
      // thrown, warn so a genuine rollback failure stays diagnosable.
      console.warn('[palletEntry] transaction.rollback() failed:', (rollbackError as Error)?.message);
    }
    throw error;
  }
}