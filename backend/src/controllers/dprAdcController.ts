import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/dprAdcService';
import { sendSuccess, sendError } from '../utils/response';

export async function getDistinctDieNo(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter } = req.body;
    const counter = await svc.getDistinctDieNo(filter);
    if (counter > 0) {
      sendSuccess(res, { DATA: counter, MESSAGE: 'Success', CODE: 200 });
    } else {
      sendSuccess(res, { DATA: 0, MESSAGE: 'No data to generate.', CODE: 204 });
    }
  } catch (err) { next(err); }
}

export async function getDieNo(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter } = req.body;
    const dieNo = await svc.getDieNo(filter);
    if (dieNo) {
      sendSuccess(res, { DATA: dieNo, MESSAGE: 'Success', CODE: 200 });
    } else {
      sendSuccess(res, { DATA: null, MESSAGE: 'No die number to return.', CODE: 204 });
    }
  } catch (err) { next(err); }
}

export async function getDPRData(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter } = req.body;
    const data = await svc.getDPRData(filter);
    sendSuccess(res, data);
  } catch (err) { next(err); }
}

export async function getDPRDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter } = req.body;
    const details = await svc.getDPRDetails(filter);
    sendSuccess(res, details);
  } catch (err) { next(err); }
}

export async function insertHeader(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter, footer } = req.body;
    const result = await svc.insertHeader(filter, footer);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function updateHeader(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter, footer } = req.body;
    const result = await svc.updateHeader(filter, footer);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function insertDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const details = req.body;
    const result = await svc.insertDetails(details);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function updateDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const details = req.body;
    const result = await svc.updateDetails(details);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function getShifts(req: Request, res: Response, next: NextFunction) {
  try {
    const shifts = await svc.getShifts();
    sendSuccess(res, { result: shifts });
  } catch (err) { next(err); }
}

export async function getProductCodes(req: Request, res: Response, next: NextFunction) {
  try {
    const codes = await svc.getProductCodes();
    sendSuccess(res, codes);
  } catch (err) { next(err); }
}

export async function checkExistingHeader(req: Request, res: Response, next: NextFunction) {
  try {
    const { filter } = req.body;
    const dprCode = await svc.checkExistingHeader(filter);
    sendSuccess(res, { dprCode });
  } catch (err) { next(err); }
}
