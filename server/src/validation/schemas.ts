/**
 * Zod Validation Schemas for API Routes
 * Provides type-safe input validation
 */
import { z } from 'zod';

// ============================================
// Auth Schemas
// ============================================

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    company: z.string().max(200).optional(),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token required'),
});

// ============================================
// Project Schemas
// ============================================

export const createProjectSchema = z.object({
    name: z.string().min(1, 'Project name required').max(200),
    description: z.string().max(5000).optional(),
    methodology: z.enum(['v-model', 'agile', 'waterfall', 'kanban']).optional(),
    industry: z.string().max(100).optional(),
    complianceStandards: z.array(z.string()).optional(),
});

export const updateProjectSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    currentPhase: z.string().optional(),
    methodology: z.enum(['v-model', 'agile', 'waterfall', 'kanban']).optional(),
});

export const projectIdSchema = z.object({
    projectId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid project ID format'),
});

// ============================================
// Conversation Schemas
// ============================================

export const createConversationSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    projectId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export const addMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1, 'Message content required').max(100000),
    metadata: z.record(z.unknown()).optional(),
});

// ============================================
// LLM Schemas
// ============================================

export const llmRouteSchema = z.object({
    prompt: z.string().min(1, 'Prompt required').max(200000),
    model: z.string().optional(),
    provider: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(200000).optional(),
    stream: z.boolean().optional(),
    systemPrompt: z.string().max(50000).optional(),
    tools: z.array(z.record(z.unknown())).optional(),
});

export const llmGenerateSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
    })).min(1, 'At least one message required'),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(200000).optional(),
});

// ============================================
// Task Schemas
// ============================================

export const createTaskSchema = z.object({
    title: z.string().min(1, 'Task title required').max(500),
    description: z.string().max(10000).optional(),
    assignedTo: z.string().optional(),
    phase: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    dueDate: z.string().datetime().optional(),
});

export const updateTaskSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).optional(),
    status: z.enum(['pending', 'in_progress', 'review', 'completed', 'failed', 'paused']).optional(),
    assignedTo: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

// ============================================
// Artifact Schemas
// ============================================

export const createArtifactSchema = z.object({
    title: z.string().min(1, 'Artifact title required').max(500),
    content: z.string().max(5000000), // 5MB text limit
    type: z.enum([
        'document', 'code', 'diagram', 'wireframe', 'test',
        'requirement', 'architecture', 'design', 'other'
    ]),
    phase: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
});

// ============================================
// Admin Schemas
// ============================================

export const updateUserSchema = z.object({
    userIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1, 'At least one user ID required'),
    action: z.enum(['activate', 'deactivate', 'delete', 'change_role']),
    role: z.enum(['user', 'admin', 'superadmin']).optional(),
});

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// Export Types
// ============================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type LLMRouteInput = z.infer<typeof llmRouteSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
