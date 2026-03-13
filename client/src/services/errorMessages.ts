/**
 * User-friendly error message mappings
 * Converts technical error messages to user-friendly explanations
 */

export const USER_FRIENDLY_ERRORS: Record<string, string> = {
    // Timeout errors
    'timeout': 'The AI is taking longer than expected. This can happen with complex tasks. Please try again.',
    'Orchestration timeout': 'The task planning is taking longer than expected. Please try again in a moment.',
    'after 6000ms': 'The request timed out. The AI service may be slow. Please try again.',
    'after 8000ms': 'The request timed out. The AI service may be slow. Please try again.',
    'after 15000ms': 'The request timed out. Complex tasks can take longer. Please try again.',
    'after 20000ms': 'The request timed out. Complex tasks can take longer. Please try again.',
    'after 25000ms': 'The request timed out. Complex tasks can take longer. Please try again.',
    
    // Backend API errors
    'Backend API required': 'A system configuration error occurred. Please ensure the backend server is running.',
    'Backend server is not running': 'The backend server is not running. Please start it from the terminal.',
    'Backend API failed': 'The backend service encountered an error. Please check the server logs.',
    'Failed to fetch': 'Cannot connect to the backend server. Please ensure it is running.',
    'ERR_CONNECTION_REFUSED': 'Cannot connect to the backend server. Please ensure it is running.',
    
    // Orchestration errors
    'Failed to orchestrate tasks': 'Failed to generate tasks for this phase. This may be due to incomplete project information or service issues. Please try again.',
    'after 3 attempts': 'The request failed after multiple attempts. Please check your project settings and try again.',
    
    // Agent errors
    'No agents available': 'No agents are configured for this project. Please check your agent settings.',
    'Agent not found': 'The assigned agent could not be found. The task will be reassigned automatically.',
    'Agent creation timeout': 'Creating a new agent profile is taking longer than expected. Using default agent.',
    
    // Model/API errors
    'Model unavailable': 'The AI model is currently unavailable. Please try again in a moment.',
    'API key': 'API configuration error. Please check your API key settings.',
    'quota': 'API quota exceeded. Please check your usage limits.',
    
    // General errors
    'Unknown error': 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    'cancelled': 'Operation was cancelled.',
};

/**
 * Convert a technical error message to a user-friendly version
 */
export function getUserFriendlyError(errorMessage: string): string {
    if (!errorMessage) {
        return USER_FRIENDLY_ERRORS['Unknown error'];
    }
    
    const messageLower = errorMessage.toLowerCase();
    
    // Check for exact matches first
    if (USER_FRIENDLY_ERRORS[errorMessage]) {
        return USER_FRIENDLY_ERRORS[errorMessage];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(USER_FRIENDLY_ERRORS)) {
        if (messageLower.includes(key.toLowerCase())) {
            return value;
        }
    }
    
    // Return original message if no mapping found (better than "Unknown error" for debugging)
    return errorMessage;
}

/**
 * Extract error message from various error formats
 */
export function extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
        return error;
    }
    
    if (error?.message) {
        return error.message;
    }
    
    if (error?.error?.message) {
        return error.error.message;
    }
    
    if (error?.response?.data?.error?.message) {
        return error.response.data.error.message;
    }
    
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }
    
    return 'An unexpected error occurred';
}

/**
 * Get user-friendly error from any error object
 */
export function getUserFriendlyErrorFromError(error: any): string {
    const errorMessage = extractErrorMessage(error);
    return getUserFriendlyError(errorMessage);
}

