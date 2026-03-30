/**
 * Validation Middleware
 * Validates request bodies using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from './errorHandler.js';

const MAX_PAGINATION_LIMIT = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Sanitize and enforce pagination parameters from query params.
 * Enforces a max limit of 100 to prevent excessive data fetching.
 * Returns { page, limit, skip } with safe defaults.
 */
export function sanitizePagination(query: Record<string, any>): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page as string) || DEFAULT_PAGE);
  const limit = Math.min(Math.max(1, parseInt(query.limit as string) || DEFAULT_LIMIT), MAX_PAGINATION_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Middleware factory to validate request body against a Zod schema
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate and transform the request body
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new AppError(
          `Validation failed: ${errors.map(e => e.message).join(', ')}`,
          400
        );
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new AppError(
          `Query validation failed: ${errors.map(e => e.message).join(', ')}`,
          400
        );
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate URL parameters
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new AppError(
          `Parameter validation failed: ${errors.map(e => e.message).join(', ')}`,
          400
        );
      }
      next(error);
    }
  };
}













