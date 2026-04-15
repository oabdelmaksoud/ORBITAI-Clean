import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export async function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Error:', {
    message,
    statusCode,
    path: req.path,
    method: req.method,
  });

  if (err.stack) {
    logger.debug('Error stack trace:', { stack: err.stack });
  }

  // Send to error tracking service (non-blocking)
  try {
    const { captureException } = await import('../services/errorTracking.service.js');
    captureException(err as Error, {
      path: req.path,
      method: req.method,
      statusCode,
    });
  } catch (trackingError) {
    // Error tracking not available or failed, continue
  }

  // Ensure Content-Type is set to JSON
  res.setHeader('Content-Type', 'application/json');

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}
