/**
 * Agent Route Validators
 * Using Zod for input validation and sanitization
 */

import { z } from 'zod';

/**
 * Agent role validation schema
 */
// @ts-ignore TS6133
const _agentRoleSchema = z.enum([
  'Orchestrator',
  'Requirements Agent',
  'UI/UX Designer',
  'QA/Audit Agent',
  'Design/Architecture Agent',
  'Test Requirements Engineer',
  'Implementation Agent',
  'Integration Agent',
  'Test Agent',
  'Remediation/Bug Agent'
], {
  errorMap: () => ({ message: 'Invalid agent role' })
});

/**
 * Agent mode validation schema
 */
const agentModeSchema = z.enum(['Reasoning', 'Deterministic'], {
  errorMap: () => ({ message: 'Invalid agent mode' })
});

/**
 * Execute agent task request validation schema
 */
export const executeAgentTaskSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  taskId: z.string().min(1, 'Task ID is required').optional(),
  projectId: z.string().min(1, 'Project ID is required'),
  prompt: z.string().min(1, 'Prompt is required').max(10000, 'Prompt must not exceed 10000 characters'),
  context: z.string().max(50000, 'Context must not exceed 50000 characters').optional(),
  useInternet: z.boolean().optional(),
  mcpServers: z.array(z.string()).optional(),
  standards: z.array(z.string()).optional(),
}).strict();

/**
 * Agent ID validation schema
 */
export const agentIdSchema = z.string()
  .regex(/^a\d+$/, 'Invalid agent ID format (should be like a1, a2, etc.)');

/**
 * Create/Update custom agent validation schema
 */
export const customAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must not exceed 50 characters'),
  title: z.string().max(100, 'Title must not exceed 100 characters').optional(),
  role: z.string().min(1, 'Role is required').max(100, 'Role must not exceed 100 characters'),
  reportsTo: z.string().optional().refine(
    (val) => !val || /^[a-f\d]{24}$/i.test(val),
    { message: 'Invalid reportsTo agent ID format' }
  ),
  mode: agentModeSchema.optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description must not exceed 500 characters'),
  goal: z.string().min(1, 'Goal is required').max(1000, 'Goal must not exceed 1000 characters'),
  backstory: z.string().min(1, 'Backstory is required').max(2000, 'Backstory must not exceed 2000 characters'),
  systemPrompt: z.string().max(10000, 'System prompt must not exceed 10000 characters').optional(),
  capabilities: z.array(z.string()).optional(),
  preferredLLM: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(100).max(128000).optional(),
  tools: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

/**
 * Type exports for TypeScript
 */
export type ExecuteAgentTaskInput = z.infer<typeof executeAgentTaskSchema>;
export type AgentIdInput = z.infer<typeof agentIdSchema>;
export type CustomAgentInput = z.infer<typeof customAgentSchema>;


