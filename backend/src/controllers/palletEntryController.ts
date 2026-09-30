import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/palletEntryService';
import { sendSuccess, sendError } from '../utils/response';

export async function filterPallets(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter } = req.body;
    const data = await svc.filterPallets(filter || {});
    sendSuccess(res, data);
  } catch (err) { next(err); }
}

export async function loadPallet(req: Request, res: Response, next: NextFunction) {
  try {
    const { plCode } = req.body;
    if (!plCode) {
      sendError(res, 'Missing Plh_PLCode', 400);
      return;
    }
    const data = await svc.loadPallet(plCode);
    sendSuccess(res, data ? [data] : []);
  } catch (err) { next(err); }
}

export async function loadProductDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { header } = req.body;
    const data = await svc.loadProductDetails({ orderDate: header?.orderDate, partNo: header?.partNo });
    sendSuccess(res, data);
  } catch (err) { next(err); }
}

export async function getCustomerCodes(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getCustomerCodes();
    sendSuccess(res, data);
  } catch (err) { next(err); }
}

export async function updatePalletLoading(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_login, header, details, palletIds } = req.body;
    const result = await svc.updatePalletLoading({ user_login, header, details, palletIds });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function cancelPallets(req: Request, res: Response, next: NextFunction) {
  try {
    const palletIds = req.body || {};
    const result = await svc.cancelPallets(palletIds);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function loadPalletForPrint(req: Request, res: Response, next: NextFunction) {
  try {
    const { plCode } = req.body;
    const data = await svc.loadPalletForPrint(plCode);
    sendSuccess(res, data);
  } catch (err) { next(err); }
}