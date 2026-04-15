/**
 * LLM Generation Routes - Content generation endpoints
 * Split from llm.routes.ts for maintainability
 */

import express from 'express';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Optional auth middleware
router.use((req: AuthRequest, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        authenticateToken(req, res, () => next());
    } else {
        next();
    }
});

/**
 * POST /api/llm/generate-embedding
 * Generate embedding vector for text
 */
router.post('/generate-embedding', async (req: AuthRequest, res, _next) => {
    try {
        const { text, model = 'text-embedding-004' } = req.body;

        if (!text) {
            res.status(400).json({
                success: false,
                error: 'Text is required'
            });
            return;
        }

        // TODO: Implement embedding generation via Google AI
        // For now, return a placeholder response
        logger.info(`[LLM Embedding] Generating embedding for text (${text.length} chars)`);

        res.json({
            success: true,
            data: {
                embedding: [], // Placeholder - implement with actual embedding service
                dimensions: 768,
                model
            }
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Embedding] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * POST /api/llm/enhance-prompt
 * Enhance a user prompt for better LLM responses
 */
router.post('/enhance-prompt', async (req: AuthRequest, res, _next) => {
    try {
        const { prompt, context = '' } = req.body;

        if (!prompt) {
            res.status(400).json({
                success: false,
                error: 'Prompt is required'
            });
            return;
        }

        const userId = req.user?.id;

        const enhancePrompt = `You are a prompt engineering expert. Enhance the following prompt to be:
- More specific and clear
- Better structured for LLM understanding
- Include relevant context

Original prompt: "${prompt}"
${context ? `Additional context: ${context}` : ''}

Return only the enhanced prompt, no explanations.`;

        const result = await llmRouter.executeWithFallback({
            prompt: enhancePrompt,
            context: {
                agentRole: 'Prompt Engineer',
                taskType: 'enhancement'
            },
            routingContext: { userId },
            requestType: 'enhancement',
            contextType: 'other',
            routerType: 'internal'
        });

        res.json({
            success: true,
            data: {
                enhancedPrompt: result.text,
                originalPrompt: prompt
            }
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Enhance Prompt] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * POST /api/llm/generate-agent-profile
 * Generate an AI agent profile
 */
router.post('/generate-agent-profile', async (req: AuthRequest, res, _next) => {
    try {
        const { role, capabilities = [], domain = '' } = req.body;

        if (!role) {
            res.status(400).json({
                success: false,
                error: 'Role is required'
            });
            return;
        }

        const userId = req.user?.id;

        const profilePrompt = `Generate a comprehensive AI agent profile for:

ROLE: ${role}
DOMAIN: ${domain || 'General'}
CAPABILITIES: ${capabilities.length > 0 ? capabilities.join(', ') : 'To be determined'}

Return a JSON object with:
{
  "name": "Agent name",
  "role": "Primary role",
  "description": "Brief description",
  "capabilities": ["capability1", "capability2"],
  "systemPrompt": "The system prompt for this agent",
  "personality": {
    "tone": "professional/friendly/technical",
    "style": "concise/detailed"
  },
  "limitations": ["limitation1"],
  "suggestedTools": ["tool1", "tool2"]
}`;

        const result = await llmRouter.executeWithFallback({
            prompt: profilePrompt,
            context: {
                agentRole: 'Agent Designer',
                taskType: 'generation'
            },
            routingContext: { userId },
            requestType: 'generation',
            contextType: 'other',
            routerType: 'internal'
        });

        // Try to parse as JSON
        let profile;
        try {
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                profile = JSON.parse(jsonMatch[0]);
            } else {
                profile = { raw: result.text };
            }
        } catch {
            profile = { raw: result.text };
        }

        res.json({
            success: true,
            data: {
                profile,
                modelUsed: result.modelUsed
            }
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Generate Agent Profile] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * POST /api/llm/quick-suggestions
 * Generate quick suggestions based on context
 */
router.post('/quick-suggestions', async (req: AuthRequest, res, _next) => {
    try {
        const { context, type = 'general', count = 5 } = req.body;

        if (!context) {
            res.status(400).json({
                success: false,
                error: 'Context is required'
            });
            return;
        }

        const userId = req.user?.id;

        const suggestionsPrompt = `Based on this context, generate ${count} ${type} suggestions:

CONTEXT: ${context}
TYPE: ${type}

Return a JSON array of suggestions:
["suggestion1", "suggestion2", ...]

Keep suggestions concise and actionable.`;

        const result = await llmRouter.executeWithFallback({
            prompt: suggestionsPrompt,
            context: {
                agentRole: 'Suggestions Agent',
                taskType: 'suggestions',
                maxTokens: 500 // Quick response
            },
            routingContext: { userId },
            requestType: 'suggestions',
            contextType: 'other',
            routerType: 'internal'
        });

        // Parse suggestions
        let suggestions: string[] = [];
        try {
            const jsonMatch = result.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            }
        } catch {
            suggestions = result.text.split('\n').filter((s: string) => s.trim());
        }

        res.json({
            success: true,
            data: {
                suggestions,
                count: suggestions.length
            }
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Quick Suggestions] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * POST /api/llm/generate-theme
 * Generate UI theme configuration
 */
router.post('/generate-theme', async (req: AuthRequest, res, _next) => {
    try {
        const { projectType, style = 'modern', colorPreference = '' } = req.body;

        if (!projectType) {
            res.status(400).json({
                success: false,
                error: 'Project type is required'
            });
            return;
        }

        const userId = req.user?.id;

        const themePrompt = `Generate a complete UI theme for:

PROJECT TYPE: ${projectType}
STYLE: ${style}
${colorPreference ? `COLOR PREFERENCE: ${colorPreference}` : ''}

Return a JSON theme object with:
{
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "text": "#hex",
    "textSecondary": "#hex",
    "error": "#hex",
    "success": "#hex",
    "warning": "#hex"
  },
  "typography": {
    "fontFamily": "font name",
    "headingFont": "font name",
    "fontSize": { "xs": "rem", "sm": "rem", "md": "rem", "lg": "rem", "xl": "rem" }
  },
  "spacing": { "xs": "rem", "sm": "rem", "md": "rem", "lg": "rem", "xl": "rem" },
  "borderRadius": { "sm": "rem", "md": "rem", "lg": "rem", "full": "rem" },
  "shadows": { "sm": "shadow", "md": "shadow", "lg": "shadow" }
}`;

        const result = await llmRouter.executeWithFallback({
            prompt: themePrompt,
            context: {
                agentRole: 'UI Designer',
                taskType: 'generation'
            },
            routingContext: { userId },
            requestType: 'generation',
            contextType: 'other',
            routerType: 'internal'
        });

        // Parse theme
        let theme;
        try {
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                theme = JSON.parse(jsonMatch[0]);
            } else {
                theme = { raw: result.text };
            }
        } catch {
            theme = { raw: result.text };
        }

        res.json({
            success: true,
            data: {
                theme,
                modelUsed: result.modelUsed
            }
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Generate Theme] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

export default router;
