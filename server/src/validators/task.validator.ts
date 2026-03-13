/**
 * Task Route Validators
 * Using Zod for input validation and sanitization
 */

import { z } from 'zod';

/**
 * Task title validation schema
 */
const taskTitleSchema = z.string()
  .min(3, 'Task title must be at least 3 characters')
  .max(200, 'Task title must not exceed 200 characters')
  .trim();

/**
 * Task description validation schema
 */
const taskDescriptionSchema = z.string()
  .max(10000, 'Task description must not exceed 10000 characters')
  .trim()
  .optional();

/**
 * Task status validation schema
 */
const taskStatusSchema = z.enum([
  'pending',
  'in-progress',
  'completed',
  'blocked',
  'cancelled'
], {
  errorMap: () => ({ message: 'Invalid task status' })
});

/**
 * Create task request validation schema
 */
export const createTaskSchema = z.object({
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  agentId: z.string().min(1, 'Agent ID is required'),
  phase: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  dependencies: z.array(z.string()).optional(),
}).strict();

/**
 * Update task request validation schema
 */
export const updateTaskSchema = z.object({
  title: taskTitleSchema.optional(),
  description: taskDescriptionSchema,
  status: taskStatusSchema.optional(),
  progress: z.number().min(0).max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
}).strict();

/**
 * Task ID validation schema
 */
export const taskIdSchema = z.string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid task ID format');

/**
 * Type exports for TypeScript
 */
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskIdInput = z.infer<typeof taskIdSchema>;


