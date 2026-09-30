import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboardService';
import { sendSuccess, sendError } from '../utils/response';

export async function getMachineList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const machines = await dashboardService.getMachineList();
    sendSuccess(res, machines, 'Machine list retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getMonthlyCharts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const selmonth = parseInt(req.query.selmonth as string) || new Date().getMonth() + 1;
    const selyears = parseInt(req.query.selyears as string) || new Date().getFullYear();
    const machine = req.query.machine as string | undefined;

    const charts = await dashboardService.getMonthlyCharts(selmonth, selyears, machine);
    sendSuccess(res, charts, 'Monthly charts retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getDashboardTotals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const totals = await dashboardService.getDashboardTotals();
    sendSuccess(res, totals, 'Dashboard totals retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await dashboardService.getDashboardSummary();
    sendSuccess(res, summary, 'Dashboard summary retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getProductionTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trend = await dashboardService.getProductionTrend(days);
    sendSuccess(res, { days, data: trend }, 'Production trend retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getPlanVsActual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const machine = req.query.machine as string | undefined;

    if (!startDate || !endDate) {
      sendError(res, 'startDate and endDate are required', 400);
      return;
    }

    const data = await dashboardService.getPlanVsActual(startDate, endDate, machine);
    sendSuccess(res, data, 'Plan vs actual data retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getNGSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const machine = req.query.machine as string | undefined;

    if (!startDate || !endDate) {
      sendError(res, 'startDate and endDate are required', 400);
      return;
    }

    const data = await dashboardService.getNGSummary(startDate, endDate, machine);
    sendSuccess(res, data, 'NG summary retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getDailyProduction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const machine = req.query.machine as string | undefined;

    const data = await dashboardService.getDailyProduction(date, machine);
    sendSuccess(res, data, 'Daily production retrieved');
  } catch (err) {
    next(err);
  }
}
