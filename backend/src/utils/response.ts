import { Response } from 'express';
import { ApiResponse, PaginatedData } from '../types';

export function sendSuccess<T>(res: Response, data: T, message = 'Success', statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(response);
}

export function sendError(res: Response, message: string, statusCode = 500, errors?: string[]): void {
  const response: ApiResponse = {
    success: false,
    message,
    errors,
  };
  res.status(statusCode).json(response);
}

export function sendPaginated<T>(res: Response, data: PaginatedData<T>, message = 'Success'): void {
  const response: ApiResponse<PaginatedData<T>> = {
    success: true,
    message,
    data,
  };
  res.status(200).json(response);
}
