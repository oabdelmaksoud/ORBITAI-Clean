/**
 * Validation Middleware
 * Validates request bodies using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from './errorHandler.js';

/**
 * Middleware factory to validate request body against a Zod schema
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Validate and transform the request body
      req.body = schema.parse(req.body);
      next();
    } catch (error: unknown) {
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
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error: unknown) {
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
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error: unknown) {
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













