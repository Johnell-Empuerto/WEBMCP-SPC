import { Request } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userCode: string;
    userName: string;
    roleId: number;
    roleName: string;
  };
}
