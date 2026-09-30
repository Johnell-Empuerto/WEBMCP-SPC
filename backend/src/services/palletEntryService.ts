import * as repo from '../repositories/palletEntryRepository';
import type { PalletFilter, UpdatePalletRequest } from '../types/palletEntry';

function formatDateToYYYYMMDD(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}

function toDateInput(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') {
    const datePart = v.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function filterPallets(filter: PalletFilter) {
  const formattedDate = formatDateToYYYYMMDD(filter.date);
  const data = await repo.getPallets({
    status: filter.status,
    formattedDate,
    partNo: filter.partNo,
  });

  // Legacy forces selected=false on all returned rows
  return data.map((item) => ({ ...item, selected: false }));
}

export async function loadPallet(plCode: string) {
  const rows = await repo.getPalletByPLCode(plCode);
  return rows[0] || null;
}

export async function loadProductDetails(header: { orderDate?: string | number | null; partNo?: string | null }) {
  const raw = header.orderDate;
  const orderDate = raw === null || raw === undefined ? '' : String(raw);
  const prefix = orderDate.substring(0, 2);

  const data = await repo.getProductByPartNo(header.partNo ?? '');
  const entryCount = await repo.countPalletsByOrderDatePrefix(prefix);

  // Legacy returns the product row fields merged with entryCount (data.rowKey is
  // the single product record in the Node-RED response).
  return {
    data: data[0] ?? null,
    entryCount,
  };
}

export async function getCustomerCodes() {
  const rows = await repo.getCustomerCodes();
  return rows.map((c) => ({
    code: c.Ccm_CustomerCode,
    name: c.Ccm_CustomerName || c.Ccm_CustomerCode,
  }));
}

export async function updatePalletLoading(payload: UpdatePalletRequest) {
  const { header, details, palletIds } = payload;

  const plCodes = Object.keys(palletIds)
    .filter((k) => k.startsWith('Plh_PLCode'))
    .map((k) => palletIds[k]);

  const user_login = payload.user_login;

  await repo.updatePallets(plCodes, {
    controlNo: header?.controlNo ?? null,
    date: header?.date ? formatDateToYYYYMMDD(String(header.date)) : null,
    customerCode: header?.customerCode ?? null,
    destination: header?.destination ?? null,
    poNumber: header?.poNumber ?? null,
    invoiceNo: header?.invoiceNo ?? null,
    orderDate: header?.orderDate ?? null,
    caseNo: header?.caseNo ?? null,
    partNo: header?.partNo ?? null,
    productName: details?.productName ?? null,
    packingDate: details?.packingDate ? formatDateToYYYYMMDD(String(details.packingDate)) : null,
    orderNo: details?.orderNo ?? null,
    quantity: details?.quantity ?? null,
    weight: details?.weight ?? null,
    boxNo: details?.boxNo ?? null,
    palletCount: details?.palletCount ?? null,
    user_login,
  });

  return { success: true, updated: plCodes.length };
}

export async function cancelPallets(palletIds: Record<string, string>) {
  const plCodes = Object.keys(palletIds)
    .filter((k) => k.startsWith('Plh_PLCode'))
    .map((k) => palletIds[k]);

  await repo.cancelPallets(plCodes);
  return { success: true, cancelled: plCodes.length };
}

export async function loadPalletForPrint(plCode: string) {
  const row = await repo.getPalletByPLCode(plCode);
  if (row.length === 0) return null;
  const r = row[0];
  return {
    Plh_PLCode: r.Plh_PLCode,
    Plh_PartNo: r.Plh_PartNo,
    Plh_CaseNo: r.Plh_CaseNo,
    Plh_PONo: r.Plh_PONo,
    Plh_InvoiceNo: r.Plh_InvoiceNo,
    Plh_BoxNo: r.Plh_BoxNo,
    Plh_Quantity: r.Plh_Quantity,
    Plh_ProductName: r.Plh_ProductName,
    Plh_Date: toDateInput(r.Plh_Date),
    Plh_PackingDate: toDateInput(r.Plh_PackingDate),
    Plh_OrderNo: r.Plh_OrderNo,
    Plh_Destination: r.Plh_Destination,
    Plh_Weight: r.Plh_Weight,
    Plh_ControlNo: r.Plh_ControlNo,
    Plh_OrderDate: r.Plh_OrderDate,
  };
}