/**
 * LLM Research Routes - Research and analysis endpoints
 * Split from llm.routes.ts for maintainability
 */

import express from 'express';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { routeTimeout } from '../middleware/routeTimeout.js';

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
 * POST /api/llm/generate-research
 * Generate research summary for a topic
 */
router.post('/generate-research', async (req: AuthRequest, res) => {
    try {
        const { topic, context = '', depth = 'standard' } = req.body;

        if (!topic) {
            return res.status(400).json({
                success: false,
                error: 'Topic is required'
            });
        }

        const userId = req.user?.id;
        const projectId = req.body.projectId;

        const researchPrompt = `Research the following topic comprehensively:

TOPIC: ${topic}
${context ? `CONTEXT: ${context}` : ''}
DEPTH: ${depth}

Provide:
1. Overview and key concepts
2. Current state of the art
3. Best practices and recommendations
4. Potential challenges and solutions
5. Resources and references

Format the response in a clear, structured manner.`;

        const result = await llmRouter.executeWithFallback({
            prompt: researchPrompt,
            context: {
                agentRole: 'Research Agent',
                taskType: 'research'
            },
            routingContext: {
                userId,
                projectId
            },
            requestType: 'research',
            contextType: 'workspace',
            useInternet: true,
            routerType: 'internal'
        });

        res.json({
            success: true,
            data: {
                research: result.text,
                resources: result.resources || [],
                modelUsed: result.modelUsed,
                provider: result.provider
            }
        });
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Research] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * POST /api/llm/deep-research
 * Perform deep research with multiple iterations
 */
router.post('/deep-research', async (req: AuthRequest, res, _next) => {
    try {
        const { topic, questions = [], maxIterations = 3 } = req.body;

        if (!topic) {
            return res.status(400).json({
                success: false,
                error: 'Topic is required'
            });
        }

        const userId = req.user?.id;
        const projectId = req.body.projectId;

        const researchResults: string[] = [];

        // Initial research
        const initialPrompt = `Conduct deep research on: "${topic}"

${questions.length > 0 ? `Address these specific questions:\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}` : ''}

Provide comprehensive analysis with citations where possible.`;

        const initialResult = await llmRouter.executeWithFallback({
            prompt: initialPrompt,
            context: {
                agentRole: 'Deep Research Agent',
                taskType: 'research'
            },
            routingContext: { userId, projectId },
            requestType: 'research',
            contextType: 'workspace',
            useInternet: true,
            routerType: 'internal'
        });

        researchResults.push(initialResult.text);

        // Synthesis
        const synthesisPrompt = `Synthesize the following research findings into a comprehensive report:

${researchResults.join('\n\n---\n\n')}

Create a well-structured summary with:
1. Executive Summary
2. Key Findings
3. Recommendations
4. Conclusions`;

        const synthesisResult = await llmRouter.executeWithFallback({
            prompt: synthesisPrompt,
            context: {
                agentRole: 'Research Synthesizer',
                taskType: 'synthesis'
            },
            routingContext: { userId, projectId },
            requestType: 'research',
            contextType: 'workspace',
            routerType: 'internal'
        });

        res.json({
            success: true,
            data: {
                report: synthesisResult.text,
                iterations: researchResults.length,
                modelUsed: synthesisResult.modelUsed
            }
        });
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Deep Research] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * POST /api/llm/full-architecture-analysis
 * Analyze project architecture comprehensively
 */
router.post('/full-architecture-analysis', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
    try {
        const { projectDescription, requirements, techStack = [] } = req.body;

        if (!projectDescription) {
            return res.status(400).json({
                success: false,
                error: 'Project description is required'
            });
        }

        const userId = req.user?.id;
        const projectId = req.body.projectId;

        const analysisPrompt = `Perform a comprehensive architecture analysis for:

PROJECT: ${projectDescription}
${requirements ? `REQUIREMENTS: ${JSON.stringify(requirements)}` : ''}
${techStack.length > 0 ? `TECH STACK: ${techStack.join(', ')}` : ''}

Analyze and provide:
1. System Architecture Overview
2. Component Breakdown
3. Data Flow Diagrams (describe in markdown)
4. API Design Recommendations
5. Database Schema Suggestions
6. Security Considerations
7. Scalability Analysis
8. Deployment Architecture
9. Cost Estimates
10. Technical Risks and Mitigations

Format as structured JSON where applicable.`;

        const result = await llmRouter.executeWithFallback({
            prompt: analysisPrompt,
            context: {
                agentRole: 'Architecture Analyst',
                taskType: 'analysis'
            },
            routingContext: { userId, projectId },
            requestType: 'analysis',
            contextType: 'workspace',
            routerType: 'internal'
        });

        res.json({
            success: true,
            data: {
                analysis: result.text,
                modelUsed: result.modelUsed,
                provider: result.provider
            }
        });
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[LLM Architecture Analysis] Error:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

export default router;
