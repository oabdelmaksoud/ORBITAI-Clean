/**
 * Admin Authentication Route Validators
 * Using Zod for input validation and sanitization
 */

import { z } from 'zod';

/**
 * Email validation schema
 */
const emailSchema = z.string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must not exceed 255 characters')
  .toLowerCase()
  .trim();

/**
 * Password validation schema (for admin login, less strict than registration)
 */
const passwordSchema = z.string()
  .min(1, 'Password is required')
  .max(128, 'Password must not exceed 128 characters');

/**
 * Admin login request validation schema
 */
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
}).strict();

/**
 * Type exports for TypeScript
 */
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;






