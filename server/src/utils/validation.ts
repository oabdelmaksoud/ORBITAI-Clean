/**
 * Validation Utilities
 * Common validation functions for email, password, etc.
 */

/**
 * Validate email address format
 * @param email - Email address to validate
 * @returns true if email is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate password strength
 * Requirements: At least 8 characters, 1 uppercase, 1 lowercase, 1 number
 * @param password - Password to validate
 * @returns true if password meets requirements, false otherwise
 */
export function validatePassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Validate MongoDB ObjectId format
 * @param id - ID to validate
 * @returns true if valid ObjectId format, false otherwise
 */
export function validateObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return /^[0-9a-fA-F]{24}$/.test(id);
}






