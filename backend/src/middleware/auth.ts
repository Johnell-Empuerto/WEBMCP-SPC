import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { sendError } from '../utils/response';
import { env } from '../config/env';

// JWT secret is required and loaded from eon_backend/.env (see config/env.ts).
const JWT_SECRET = env.jwt.secret;

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, 'Token expired', 401);
      return;
    }
    sendError(res, 'Invalid token', 401);
  }
}

export function authorize(...allowedRoleIds: number[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!allowedRoleIds.includes(req.user.roleId)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }

    next();
  };
}
