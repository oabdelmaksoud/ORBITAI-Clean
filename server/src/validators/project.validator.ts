/**
 * Project Route Validators
 * Using Zod for input validation and sanitization
 */

import { z } from 'zod';

/**
 * Project name validation schema
 */
const projectNameSchema = z.string()
  .min(3, 'Project name must be at least 3 characters')
  .max(200, 'Project name must not exceed 200 characters')
  .trim();

/**
 * Project description validation schema
 */
const projectDescriptionSchema = z.string()
  .max(5000, 'Project description must not exceed 5000 characters')
  .trim()
  .optional();

/**
 * Phase validation schema
 * Must match Phase enum in types.ts
 */
const phaseSchema = z.enum([
  'Initiation',
  'Requirements',
  'Architecture',
  'Test Planning',
  'Implementation',
  'Integration',
  'System/Acceptance',
  'Release Prep',
  'Post-Release'
], {
  errorMap: () => ({ message: 'Invalid phase value' })
});

/**
 * Methodology validation schema
 */
const methodologySchema = z.enum([
  'V-Model',
  'Agile',
  'Waterfall',
  'Scrum',
  'Kanban',
  'DevOps',
  'Lean',
  'Spiral'
], {
  errorMap: () => ({ message: 'Invalid methodology value' })
});

/**
 * Create project request validation schema
 * Accepts all fields that the Project model supports (similar to update schema)
 */
export const createProjectSchema = z.preprocess((data: any) => {
  // Remove legacy 'phase' field before validation (use currentPhase instead)
  if (data && typeof data === 'object') {
    const { phase, ...rest } = data;
    return rest;
  }
  return data;
}, z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  currentPhase: phaseSchema.optional(),
  currentSprint: z.number().int().min(1).optional(),
  methodology: methodologySchema.optional(),
  estimatedSprints: z.number().int().min(1).max(100).optional(),
  agents: z.array(z.any()).optional(),
  tasks: z.array(z.any()).optional(),
  artifacts: z.array(z.any()).optional(),
  logs: z.array(z.any()).optional(),
  selectedStandards: z.array(z.string()).optional(),
  useInternet: z.boolean().optional(),
  budget: z.object({
    cap: z.number().optional(),
    spent: z.number().optional()
  }).optional(),
  mcpServers: z.array(z.any()).optional(),
  shareTokens: z.array(z.any()).optional(),
  lastModified: z.date().or(z.string()).optional(),
  // Allow but ignore frontend-only fields
  id: z.string().optional(),
  userId: z.string().optional(),
  created: z.any().optional(),
  selectedTheme: z.any().optional(),
  isProcessing: z.boolean().optional(),
}).passthrough()); // Use passthrough to allow extra fields but still validate known ones

/**
 * Update project request validation schema
 * Accepts all fields that the Project model supports
 */
export const updateProjectSchema = z.preprocess((data: any) => {
  // Remove legacy 'phase' field before validation (use currentPhase instead)
  if (data && typeof data === 'object') {
    const { phase, ...rest } = data;
    return rest;
  }
  return data;
}, z.object({
  name: projectNameSchema.optional(),
  description: projectDescriptionSchema,
  currentPhase: phaseSchema.optional(),
  currentSprint: z.number().int().min(1).optional(),
  methodology: methodologySchema.optional(),
  estimatedSprints: z.number().int().min(1).max(100).optional(),
  agents: z.array(z.any()).optional(),
  tasks: z.array(z.any()).optional(),
  artifacts: z.array(z.any()).optional(),
  logs: z.array(z.any()).optional(),
  selectedStandards: z.array(z.string()).optional(),
  useInternet: z.boolean().optional(),
  budget: z.object({
    cap: z.number().optional(),
    spent: z.number().optional()
  }).optional(),
  mcpServers: z.array(z.any()).optional(),
  shareTokens: z.array(z.any()).optional(),
  lastModified: z.date().or(z.string()).optional(),
  // Allow but ignore frontend-only fields
  id: z.string().optional(),
  userId: z.string().optional(),
  created: z.any().optional(),
  selectedTheme: z.any().optional(),
  isProcessing: z.boolean().optional(),
}).passthrough()); // Use passthrough instead of strict to allow extra fields but still validate known ones

/**
 * Project ID validation schema
 */
export const projectIdSchema = z.string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid project ID format');

/**
 * Type exports for TypeScript
 */
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectIdInput = z.infer<typeof projectIdSchema>;


