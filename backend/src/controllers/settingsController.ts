import type { Request, Response, NextFunction } from 'express';
import * as svc from '../services/settingsService';
import { sendSuccess, sendError } from '../utils/response';
import type { AuthenticatedRequest } from '../types';

// ════════════════════════════════════════════════════════════════════════════
// Controller layer for Settings.
// Handles HTTP concerns only: reading request params, calling the service,
// and returning the response. This module deliberately keeps the
// { success, data, message } envelope (unlike the master modules' envelope)
// because the frontend depends on it.
// Business rules live in settingsService.ts; SQL lives in settingsRepository.ts.
// ════════════════════════════════════════════════════════════════════════════

// GET /api/settings/session-timeout — read the configured idle timeout
export async function getSessionTimeout(_req: Request, res: Response, next: NextFunction) {
  try {
    const minutes = await svc.getSessionTimeout();
    sendSuccess(res, { minutes }, 'Session timeout retrieved');
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/session-timeout — update the idle timeout
export async function updateSessionTimeout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const minutes = Number(req.body?.minutes);
    const userLogin = String(req.user?.userCode ?? '').slice(0, 15);

    const result = await svc.updateSessionTimeout(minutes, userLogin);
    if (!result.ok) {
      sendError(res, result.message, result.statusCode, result.errors);
      return;
    }

    sendSuccess(res, { minutes: result.minutes }, 'Session timeout updated');
  } catch (err) {
    next(err);
  }
}
