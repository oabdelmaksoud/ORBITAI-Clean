/**
 * LLM Chat Routes - Chat and streaming endpoints
 * Split from llm.routes.ts for maintainability
 */

import express from 'express';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { routeTimeout } from '../middleware/timeout.js';

const router = express.Router();

// Optional auth middleware - only authenticate if token is present
router.use((req: AuthRequest, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        authenticateToken(req, res, () => next());
    } else {
        next();
    }
});

/**
 * POST /api/llm/chat
 * Standard chat completion endpoint
 */
router.post('/chat', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
    try {
        const { prompt, context = {}, useInternet = false } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'Prompt is required'
            });
        }

        const userId = req.user?.id;
        const projectId = req.body.projectId;

        const result = await llmRouter.executeWithFallback({
            prompt,
            context: {
                agentRole: context.agentRole || 'Assistant',
                taskType: context.taskType || 'chat',
                systemInstruction: context.systemInstruction,
                tools: context.tools
            },
            routingContext: {
                userId,
                projectId
            },
            requestType: 'chat',
            contextType: 'workspace',
            useInternet,
            routerType: 'end-user'
        });

        res.json({
            success: true,
            data: {
                text: result.text,
                usage: result.usage,
                modelUsed: result.modelUsed,
                provider: result.provider
            }
        });
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Chat] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * POST /api/llm/chat/stream
 * Streaming chat completion endpoint
 */
router.post('/chat/stream', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
    try {
        const { prompt, context = {}, useInternet = false } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'Prompt is required'
            });
        }

        const userId = req.user?.id;
        const projectId = req.body.projectId;

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = llmRouter.executeWithFallbackStream({
            prompt,
            context: {
                agentRole: context.agentRole || 'Assistant',
                taskType: context.taskType || 'chat',
                systemInstruction: context.systemInstruction,
                tools: context.tools
            },
            routingContext: {
                userId,
                projectId
            },
            requestType: 'chat',
            contextType: 'workspace',
            useInternet,
            routerType: 'end-user'
        });

        for await (const chunk of stream) {
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Chat Stream] Error:', errorMessage);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: errorMessage
            });
        } else {
            res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
            res.end();
        }
    }
});

export default router;
