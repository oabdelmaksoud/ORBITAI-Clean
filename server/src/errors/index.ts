/**
 * Error handling utilities - barrel export
 */
export {
    ApiError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    isApiError,
    getErrorMessage,
    getErrorForLogging,
    toApiError,
} from './ApiError';
