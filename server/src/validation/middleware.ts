/**
 * Validation Middleware
 * Provides Express middleware for Zod schema validation
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error: unknown) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const path = err.path.join('.');
                    acc[path] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                res.status(400).json(
                    new ValidationError('Invalid request body', details).toJSON()
                );
                return;
            }
            next(error);
        }
    };
}

/**
 * Validate request query params against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.query = schema.parse(req.query) as any;
            next();
        } catch (error: unknown) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const path = err.path.join('.');
                    acc[path] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                res.status(400).json(
                    new ValidationError('Invalid query parameters', details).toJSON()
                );
                return;
            }
            next(error);
        }
    };
}

/**
 * Validate request params against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.params = schema.parse(req.params) as any;
            next();
        } catch (error: unknown) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const path = err.path.join('.');
                    acc[path] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                res.status(400).json(
                    new ValidationError('Invalid URL parameters', details).toJSON()
                );
                return;
            }
            next(error);
        }
    };
}

/**
 * Combined validation for body, query, and params
 */
export function validate(options: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            if (options.body) {
                req.body = options.body.parse(req.body);
            }
            if (options.query) {
                req.query = options.query.parse(req.query) as any;
            }
            if (options.params) {
                req.params = options.params.parse(req.params) as any;
            }
            next();
        } catch (error: unknown) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const path = err.path.join('.');
                    acc[path] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                res.status(400).json(
                    new ValidationError('Validation failed', details).toJSON()
                );
                return;
            }
            next(error);
        }
    };
}
