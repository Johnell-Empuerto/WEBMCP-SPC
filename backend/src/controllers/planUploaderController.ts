import type { Request, Response, NextFunction } from 'express';
import * as planUploaderService from '../services/planUploaderService';
import { generateTemplate } from '../services/templateGenerator';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';

// ── Reference Data ──

export async function getCostCenters(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await planUploaderService.getCostCenters();
    sendSuccess(res, { items: data, totalItems: data.length });
  } catch (err) {
    next(err);
  }
}

export async function getProductCodes(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await planUploaderService.getProductCodes();
    sendSuccess(res, { items: data, totalItems: data.length });
  } catch (err) {
    next(err);
  }
}

export async function getTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as any;
    const month = parseInt(query.month || String(new Date().getMonth() + 1));
    const templates = planUploaderService.getTemplates(month);
    sendSuccess(res, { templates });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateList(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as any;
    const month = parseInt(query.month || String(new Date().getMonth() + 1));
    const templates = planUploaderService.getTemplateList(month);
    sendSuccess(res, { templates });
  } catch (err) {
    next(err);
  }
}

// ── Validate Upload ──

export async function validateUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as any;
    const { base64File, selectedYearMonth, empId, curday, curyearmonth } = body;

    if (!base64File) {
      throw new AppError('No file uploaded', 400);
    }
    if (!selectedYearMonth) {
      throw new AppError('Selected year-month is required', 400);
    }

    const costCentersData = await planUploaderService.getCostCenters();
    const productCodesData = await planUploaderService.getProductCodes();

    const costCenterList = costCentersData.map((c: any) => c.CostCenter);
    const productCodeList = productCodesData.map((p: any) => p.ProdCode);

    const result = await planUploaderService.validateUpload(
      base64File,
      selectedYearMonth,
      costCenterList,
      productCodeList,
      empId || 'SYSTEM',
      curday || String(new Date().getDate()).padStart(2, '0'),
      curyearmonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    );

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Insert / Update Records ──

export async function insertRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as any;
    const { base64File, selectedYearMonth, empId } = body;

    if (!base64File) {
      throw new AppError('No file data provided', 400);
    }
    if (!selectedYearMonth) {
      throw new AppError('Selected year-month is required', 400);
    }

    const costCentersData = await planUploaderService.getCostCenters();
    const productCodesData = await planUploaderService.getProductCodes();

    const costCenterList = costCentersData.map((c: any) => c.CostCenter);
    const productCodeList = productCodesData.map((p: any) => p.ProdCode);

    const result = await planUploaderService.insertRecords(
      base64File,
      selectedYearMonth,
      costCenterList,
      productCodeList,
      empId || 'SYSTEM',
    );

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Template Download ──

export async function downloadTemplate(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const query = req.query as any;
  const yearmonth = query.yearmonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const includeHistory = query.includeHistory === 'true';

  console.log(`\n>> Template Download Request: yearmonth=${yearmonth}, includeHistory=${includeHistory}`);

  if (!/^\d{4}-\d{2}$/.test(yearmonth)) {
    throw new AppError('Invalid year-month format. Expected YYYY-MM', 400);
  }

  try {
    console.log(`   Generating workbook for ${yearmonth}...`);
    const workbook = await generateTemplate({ yearmonth, includeHistory });

    const buffer = Buffer.alloc(0);
    await workbook.xlsx.writeBuffer().then((buf: any) => {
      const b = buf as Buffer;
      console.log(`   Workbook generated: ${(b.length / 1024).toFixed(1)} KB`);

      const filename = `CodeMarkingEntry_${yearmonth}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', b.length);
      res.setHeader('Cache-Control', 'no-cache');

      res.send(b);

      console.log(`   Download complete in ${Date.now() - startTime}ms`);
    });
  } catch (err) {
    next(err);
  }
}

// ── History ──

export async function checkHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.params as any;
    const yearmonth = params.yearmonth;
    if (!yearmonth || !/^\d{4}-\d{2}$/.test(yearmonth)) {
      throw new AppError('Invalid year-month format. Expected YYYY-MM', 400);
    }
    const result = await planUploaderService.checkHistory(yearmonth);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
