import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { authService } from '../services/authService';
import { sendSuccess, sendError } from '../utils/response';

const loginSchema = z.object({
  userCode: z.string().min(1, 'User code is required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class AuthController {
  async login(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userCode, password } = loginSchema.parse(req.body);
      const result = await authService.login(userCode, password);
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, 'Validation failed', 400, error.errors.map((e) => e.message));
        return;
      }
      next(error);
    }
  }

  async refresh(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await authService.refreshToken(refreshToken);
      sendSuccess(res, result, 'Token refreshed');
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, 'Validation failed', 400, error.errors.map((e) => e.message));
        return;
      }
      next(error);
    }
  }

  async profile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getProfile(req.user!.userCode);
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: AuthenticatedRequest, res: Response): Promise<void> {
    sendSuccess(res, null, 'Logged out successfully');
  }
}

export const authController = new AuthController();
