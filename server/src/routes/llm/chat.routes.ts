
import express from 'express';
import { llmRouter } from '../../services/llm/LLMRouter.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthRequest } from '../../middleware/auth.js';
import { routeTimeout } from '../../middleware/timeout.js';

const router = express.Router();
export const path = '/api/llm'; // Mount at /api/llm

// Optional authentication
router.use((req: AuthRequest, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        authenticateToken(req, res, () => next());
    } else {
        next();
    }
});

/**
 * Chat endpoint - routes through LLM router
 * Optimized for fast responses with 30 second timeout
 */
router.post('/chat', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
    try {
        const { message, history, projectState, contextType, agentRole, systemContext } = req.body;

        if (!message) {
            res.status(400).json({
                success: false,
                message: 'message is required'
            });
            return;
        }

        logger.info(`[LLMRouter] Chat request received for agent: ${agentRole || 'Orchestrator'}`);

        // Build chat prompt from history
        let chatPrompt = history && history.length > 0
            ? `${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\nuser: ${message}`
            : message;

        // INTERNET RESEARCH INJECTION
        const useInternet = req.body.useInternet === true;
        const researchTopic = req.body.researchTopic || message;

        if (useInternet) {
            try {
                logger.info(`[LLMRouter] Performing internet research for chat topic: ${researchTopic.substring(0, 50)}...`);
                const researchPrompt = `Find the latest trends, technologies, and innovative examples for: "${researchTopic}"
        
        Focus on:
        1. Current market trends (2024-2025)
        2. Innovative features/mechanics
        3. Popular examples/competitors
        4. Technical best practices
        
        Keep concise/bulleted.`;

                const researchResult = await llmRouter.executeWithFallback({
                    prompt: researchPrompt,
                    context: { agentRole: 'Research Agent', taskType: 'research' },
                    routingContext: { userId: (req as any).user?.id },
                    requestType: 'research',
                    contextType: 'wizard',
                    useInternet: true
                });

                if (researchResult.text) {
                    const researchContext = `\n\n[REAL-TIME RESEARCH CONTEXT]\nThe following information was just retrieved from the internet to help with this request:\n${researchResult.text}\n[END RESEARCH CONTEXT]\n\n`;
                    chatPrompt = researchContext + chatPrompt;
                    logger.info(`[LLMRouter] Research injected (${researchResult.text.length} chars)`);
                }
            } catch (err) {
                logger.warn('[LLMRouter] Chat research failed, proceeding without it:', err);
            }
        }

        // Determine system instruction
        let systemInstruction = systemContext;

        // Add wizard-specific context to help AI decide when ready if not provided
        const isWizardContext = contextType === 'wizard' || (!projectState?.id && !systemContext);

        if (isWizardContext && !systemInstruction) {
            const conversationLength = history?.length || 0;

            const wizardInstructions = `\n\n[WIZARD MODE - Project Setup Assistant]
You are an engaging, friendly AI assistant helping a user describe their project idea. Your goal is to have a natural, conversational dialogue that helps them think through their project.

RESPONSE LENGTH:
- **Give SHORT, concise answers by default** (1-3 sentences)
- Only provide longer, detailed answers if the user explicitly asks for more detail, explanation, or a "long answer"
- Keep responses brief and focused to maintain a natural brainstorming flow
- This is a brainstorming session - be quick and conversational, not verbose

YOUR APPROACH:
1. **Be conversational and curious** - Ask follow-up questions based on what they tell you. Show genuine interest in their idea.
2. **Dig deeper** - When they mention something, ask "why" or "how" to understand their motivations and goals better.
3. **Be specific** - Instead of generic questions, ask targeted questions based on their previous answers.
4. **Show enthusiasm** - Use emojis sparingly, be encouraging, and celebrate their ideas.
5. **Guide the conversation** - Make sure to cover: project type, target audience, key features, technical preferences (if any), timeline, and any constraints.
6. **Keep it brief** - Short answers help maintain brainstorming momentum. Only elaborate if asked.

INFORMATION TO GATHER:
- What type of project (web app, mobile app, API, etc.)
- Who is the target audience
- What are the main features/functionality
- Any technology preferences
- Timeline expectations
- Budget considerations (if relevant)
- Special requirements (accessibility, performance, security, etc.)

WHEN TO INDICATE READINESS:
After you have gathered sufficient information (typically after 6-8 meaningful exchanges with the user), you can indicate readiness by saying phrases like:
- "I have enough information to generate your project blueprint"
- "I can now generate your project preview"
- "Perfect! I have everything I need to get started"
- "I'm ready to generate your project architecture"

IMPORTANT: Only indicate readiness after having a substantial conversation (6+ exchanges). Don't indicate readiness too early - continue asking questions to understand their project better.

CONVERSATION STYLE:
- Ask ONE question at a time (don't overwhelm)
- Build on their previous answers
- If they give a short answer, ask for more details
- If they're vague, ask for specifics
- Be warm, helpful, and encouraging

Current conversation length: ${conversationLength} messages
${conversationLength >= 6 ? 'NOTE: You have had a substantial conversation. Consider if you have enough information to proceed.' : ''}
${conversationLength < 3 ? 'NOTE: This is early in the conversation. Ask engaging, specific questions to understand their project better.' : ''}
${conversationLength >= 4 && conversationLength < 6 ? 'NOTE: You have good information. Consider asking 1-2 more clarifying questions, then indicate readiness.' : ''}

User's latest message: ${message}`;
        }

        // Optimize for fast responses - prefer fast models for conversation analysis
        const preferFastModel = req.body.preferFastModel === true;
        const maxTokens = req.body.maxTokens;

        const result = await llmRouter.executeWithFallback({
            prompt: chatPrompt,
            context: {
                agentRole: agentRole || 'Orchestrator',
                taskType: preferFastModel ? 'prompt-enhancement' : 'chat', // Use 'prompt-enhancement' to target Flash models which are recommended for this type
                maxTokens: maxTokens, // Limit tokens for faster responses
                systemInstruction: systemInstruction
            },
            routingContext: {
                userId: (req as any).user?.id,
                projectId: projectState?.id,
                userPreferences: preferFastModel ? {
                    costPreference: 'low' // Prefer cheaper/faster models
                } : undefined
            },
            requestType: 'chat',
            contextType: isWizardContext ? 'wizard' : 'general'
        });

        res.json({
            success: true,
            response: result.text,
            usage: result.usage,
            modelUsed: result.modelUsed,
            provider: result.provider
        });
    } catch (error: any) {
        logger.error('[LLMRouter] Chat failed:', error);
        res.status(500).json({
            success: false,
            message: 'Chat request failed',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Streaming chat endpoint - routes through LLM router with Server-Sent Events
 */
router.post('/chat/stream', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
    try {
        const { message, history, projectState, contextType, preferFastModel, maxTokens, systemContext, useInternet } = req.body;

        if (!message) {
            res.status(400).json({
                success: false,
                message: 'message is required'
            });
            return;
        }

        logger.info('[LLMRouter] Streaming chat request received');

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Build chat prompt from history
        let chatPrompt = history && history.length > 0
            ? `${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\nuser: ${message}`
            : message;

        // Use custom system context if provided (overrides default wizard context)
        let systemInstruction = systemContext;

        // Determine context type
        const isWizardContext = contextType === 'wizard' || (!projectState?.id && !systemContext);

        if (!systemContext && isWizardContext) {
            const conversationLength = history?.length || 0;

            systemInstruction = `[WIZARD MODE - Project Setup Assistant]
  You are an engaging, friendly AI assistant helping a user describe their project idea. Your goal is to have a natural, conversational dialogue that helps them think through their project.
  
  RESPONSE LENGTH:
  - **Give SHORT, concise answers by default** (1-3 sentences)
  - Only provide longer, detailed answers if the user explicitly asks for more detail, explanation, or a "long answer"
  - Keep responses brief and focused to maintain a natural brainstorming flow
  - This is a brainstorming session - be quick and conversational, not verbose
  
  YOUR APPROACH:
  1. **Be conversational and curious** - Ask follow-up questions based on what they tell you. Show genuine interest in their idea.
  2. **Dig deeper** - When they mention something, ask "why" or "how" to understand their motivations and goals better.
  3. **Be specific** - Instead of generic questions, ask targeted questions based on their previous answers.
  4. **Show enthusiasm** - Use emojis sparingly, be encouraging, and celebrate their ideas.
  5. **Guide the conversation** - Make sure to cover: project type, target audience, key features, technical preferences (if any), timeline, and any constraints.
  6. **Keep it brief** - Short answers help maintain brainstorming momentum. Only elaborate if asked.
  
  INFORMATION TO GATHER:
  - What type of project (web app, mobile app, API, etc.)
  - Who is the target audience
  - What are the main features/functionality
  - Any technology preferences
  - Timeline expectations
  - Budget considerations (if relevant)
  - Special requirements (accessibility, performance, security, etc.)
  - **PROJECT AGNOSTIC**: You handle ANY software project (Web, Mobile, Game, data, etc.). Do not assume one type unless the user specifies.
  
  WHEN TO INDICATE READINESS:
  After you have gathered sufficient information (typically after 6-8 meaningful exchanges with the user), you can indicate readiness by saying phrases like:
  - "I have enough information to generate your project blueprint"
  - "I can now generate your project preview"
  - "Perfect! I have everything I need to get started"
  - "I'm ready to generate your project architecture"
  
  IMPORTANT: Only indicate readiness after having a substantial conversation (6+ exchanges). Don't indicate readiness too early - continue asking questions to understand their project better.
  
  CONVERSATION STYLE:
  - Ask ONE question at a time (don't overwhelm)
  - Build on their previous answers
  - If they give a short answer, ask for more details
  - If they're vague, ask for specifics
  - Be warm, helpful, and encouraging
  
  Current conversation length: ${conversationLength} messages
  ${conversationLength >= 6 ? 'NOTE: You have had a substantial conversation. Consider if you have enough information to proceed.' : ''}
  ${conversationLength < 3 ? 'NOTE: This is early in the conversation. Ask engaging, specific questions to understand their project better.' : ''}
  ${conversationLength >= 4 && conversationLength < 6 ? 'NOTE: You have good information. Consider asking 1-2 more clarifying questions, then indicate readiness.' : ''}
  
  User's latest message: ${message}`;
        }


        try {
            // Stream the response
            const stream = llmRouter.executeWithFallbackStream({
                prompt: chatPrompt,
                context: {
                    agentRole: 'Orchestrator',
                    taskType: preferFastModel ? 'analysis' : 'chat',
                    maxTokens: maxTokens,
                    systemInstruction: systemInstruction // Pass explicitly here!
                },
                routingContext: {
                    userId: (req as any).user?.id,
                    projectId: projectState?.id,
                    userPreferences: preferFastModel ? {
                        costPreference: 'low'
                    } : undefined
                },
                requestType: 'chat',
                contextType: isWizardContext ? 'wizard' : 'general',
                useInternet: useInternet === true // Pass internet research flag
            });

            // Send chunks as they arrive
            for await (const chunk of stream) {
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }

            // Send completion signal
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        } catch (streamError: any) {
            logger.error('[LLMRouter] Streaming error:', streamError);
            res.write(`data: ${JSON.stringify({ error: streamError.message || 'Streaming failed' })}\n\n`);
            res.end();
        }
    } catch (error: any) {
        logger.error('[LLMRouter] Streaming chat setup failed:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Streaming chat request failed',
                error: error instanceof Error ? error.message : String(error)
            });
        } else {
            res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Streaming failed' })}\n\n`);
            res.end();
        }
    }
});

export default router;
