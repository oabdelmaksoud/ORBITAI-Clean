/**
 * Typed Error Classes for API Routes
 * Replaces `catch (error: any)` patterns with proper typing
 */

/**
 * Base API Error
 */
export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                details: this.details,
            },
        };
    }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends ApiError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends ApiError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization Error (403)
 */
export class AuthorizationError extends ApiError {
    constructor(message: string = 'Permission denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends ApiError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends ApiError {
    public readonly retryAfter?: number;

    constructor(message: string = 'Too many requests', retryAfter?: number) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

/**
 * External Service Error (502)
 */
export class ExternalServiceError extends ApiError {
    constructor(service: string, originalError?: Error) {
        super(
            `External service error: ${service}`,
            502,
            'EXTERNAL_SERVICE_ERROR',
            { service, originalMessage: originalError?.message }
        );
        this.name = 'ExternalServiceError';
    }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unknown error occurred';
}

/**
 * Safely extract error for logging (no sensitive data)
 */
export function getErrorForLogging(error: unknown): Record<string, unknown> {
    if (error instanceof ApiError) {
        return {
            name: error.name,
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            stack: error.stack,
        };
    }
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return { raw: String(error) };
}

/**
 * Convert unknown error to ApiError for consistent handling
 */
export function toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
        return error;
    }
    if (error instanceof Error) {
        return new ApiError(error.message, 500, 'INTERNAL_ERROR');
    }
    return new ApiError(String(error), 500, 'INTERNAL_ERROR');
}
