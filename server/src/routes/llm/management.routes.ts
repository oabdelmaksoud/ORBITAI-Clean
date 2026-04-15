
import express from 'express';
import { llmRouter } from '../../services/llm/LLMRouter.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthRequest } from '../../middleware/auth.js';
import { routeTimeout } from '../../middleware/timeout.js';
import { embeddingService } from '../../services/embedding.service.js';
import { functionCallProcessor, LLMResponseWithFunctionCalls } from '../../services/llm/FunctionCallProcessor.js';
import { evaluationService } from '../../services/evaluation.service.js';
import { usageTracker } from '../../services/llm/UsageTracker.js';
import { Type, Schema } from '@google/genai';
import { detectProjectType } from '../../utils/llmRouteHelpers.js';
import { modelRegistry } from '../../services/llm/models/ModelRegistry.js';

const router = express.Router();
export const path = '/api/llm';

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
 * Generate embedding - uses LLM router
 */
router.post('/generate-embedding', async (req: AuthRequest, res, _next) => {
    try {
        const { text } = req.body;

        if (!text) {
            res.status(400).json({
                success: false,
                message: 'text is required'
            });
            return;
        }

        // Embeddings typically use specific models, but route through router for consistency
        const embedding = await embeddingService.generateEmbedding(text);

        res.json({
            success: true,
            embedding
        });
    } catch (error: unknown) {
        logger.error('[LLMRouter] Embedding generation failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate embedding',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Enhance prompt - routes through LLM router
 */
router.post('/enhance-prompt', async (req: AuthRequest, res, _next) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            res.status(400).json({
                success: false,
                message: 'prompt is required'
            });
            return;
        }

        const enhancementPrompt = `Enhance and improve the following prompt to be more clear, specific, and effective:\n\n${prompt}\n\nReturn only the enhanced prompt, no additional explanation.`;

        const result = await llmRouter.executeWithFallback({
            prompt: enhancementPrompt,
            context: {
                agentRole: 'Orchestrator',
                taskType: 'text-generation'
            },
            routingContext: {
                userId: (req as any).user?.id
            },
            requestType: 'prompt-enhancement',
            contextType: 'other'
        });

        res.json({
            success: true,
            enhancedPrompt: result.text,
            modelUsed: result.modelUsed,
            provider: result.provider
        });
    } catch (error: unknown) {
        logger.error('[LLMRouter] Prompt enhancement failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enhance prompt',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Execute task - routes through LLM router with function calling support
 */
router.post('/execute-task', routeTimeout(300000), async (req: AuthRequest, res, _next) => {
    try {
        const { task, projectState, useInternet, mcpServers, selectedStandards } = req.body;

        if (!task) {
            res.status(400).json({
                success: false,
                message: 'task is required'
            });
            return;
        }

        logger.info(`[LLMRouter] Executing task: ${task.title}`);

        // Build tools for function calling
        const tools: any[] = []; // Function definitions would be built here

        const result = await llmRouter.executeWithFallback({
            prompt: task.description || task.title,
            context: {
                agentRole: task.assignedTo || 'Implementation Agent',
                taskType: 'code-generation',
                tools: tools.length > 0 ? tools : undefined,
                systemInstruction: `You are executing a task: ${task.title}`
            },
            routingContext: {
                userId: (req as any).user?.id,
                projectId: projectState?.id
            },
            requestType: 'task-execution',
            contextType: 'workspace',
            useInternet: useInternet || false
        });

        // Process function calls if present
        const responseWithFunctionCalls = result as LLMResponseWithFunctionCalls;
        if (responseWithFunctionCalls.functionCalls && responseWithFunctionCalls.functionCalls.length > 0) {
            const processedResult = await functionCallProcessor.processFunctionCalls(
                responseWithFunctionCalls.functionCalls,
                projectState,
                mcpServers || []
            );

            res.json({
                success: true,
                output: processedResult.output,
                resources: result.resources || [], // URLs from Google Search grounding
                functionCalls: processedResult.functionCalls,
                modelUsed: result.modelUsed,
                provider: result.provider
            });
            return;
        }

        // Parse output for detected issues and create tasks
        let createdTasks: any[] = [];
        const outputText = result.text || result.content || '';

        // ⭐ CALCULATE QUALITY SCORE ⭐
        // This is where the AI Quality Score is calculated
        let evaluation;
        if (outputText && outputText.trim().length >= 50) {
            try {
                evaluation = await evaluationService.evaluateTaskOutput({
                    taskTitle: task.title || 'Untitled Task',
                    taskDescription: task.description || '',
                    agentRole: task.assignedTo || 'Implementation Agent',
                    output: outputText,
                    standards: selectedStandards || [],
                    projectContext: projectState?.description || ''
                });
                logger.info(`[LLMRouter] Evaluation completed for task "${task.title}" - Score: ${evaluation.score}/100`);
            } catch (evalError: any) {
                logger.warn('[LLMRouter] Evaluation failed, using quick evaluate:', evalError);
                try {
                    evaluation = await evaluationService.quickEvaluate(outputText, task.description || '');
                } catch (quickEvalError: any) {
                    logger.error('[LLMRouter] Quick evaluation also failed:', quickEvalError);
                    // Return pending evaluation if both fail
                    evaluation = {
                        score: 0,
                        reasoning: 'Evaluation service encountered an error. Quality score will be calculated on retry.',
                        criteria: ['Evaluation Error'],
                        timestamp: Date.now()
                    };
                }
            }
        } else {
            // Output too short - return pending evaluation
            evaluation = {
                score: 0,
                reasoning: 'Output is too short to evaluate meaningfully. Please provide more substantial output.',
                criteria: ['Output Length'],
                timestamp: Date.now()
            };
        }

        if (outputText && projectState?.id && (req as any).user?.id) {
            try {
                const { issueParserService } = await import('../../services/issueParser.service.js');
                const { issueTaskCreationService } = await import('../../services/issueTaskCreation.service.js');

                // Parse issues from agent output
                const detectedIssues = issueParserService.parseIssuesFromOutput(
                    outputText,
                    task.assignedTo || 'Implementation Agent',
                    task.id // Use task ID as artifact reference
                );

                // Create tasks for detected issues (only critical/high severity to avoid spam)
                const importantIssues = detectedIssues.filter(
                    (issue: any) => issue.severity === 'critical' || issue.severity === 'high'
                );

                if (importantIssues.length > 0) {
                    const taskResults = await issueTaskCreationService.createTasksForIssues(
                        projectState.id,
                        importantIssues,
                        (req as any).user.id
                    );

                    createdTasks = taskResults
                        .filter((r: any) => r.created)
                        .map((r: any) => ({ taskId: r.taskId, message: r.message }));

                    if (createdTasks.length > 0) {
                        logger.info(`[LLMRouter] Created ${createdTasks.length} tasks for detected issues`);
                    }
                }
            } catch (issueError: any) {
                // Log but don't fail the task execution if issue parsing fails
                logger.warn('[LLMRouter] Failed to parse issues or create tasks:', issueError);
            }
        }

        res.json({
            success: true,
            data: {
                output: outputText,
                evaluation: evaluation, // ⭐ Quality score calculated here
                resources: result.resources || [], // URLs from Google Search grounding
                usage: result.usage,
                modelUsed: result.modelUsed,
                provider: result.provider,
                createdTasks: createdTasks.length > 0 ? createdTasks : undefined
            },
            // Also include at top level for backward compatibility
            output: outputText,
            evaluation: evaluation, // ⭐ Quality score at top level too
            resources: result.resources || [], // URLs from Google Search grounding
            usage: result.usage,
            modelUsed: result.modelUsed,
            provider: result.provider
        });
    } catch (error: unknown) {
        logger.error('[LLMRouter] Task execution failed:', error);
        res.status(500).json({
            success: false,
            message: 'Task execution failed',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Generate agent profile - routes through LLM router
 */
router.post('/generate-agent-profile', async (req: AuthRequest, res, _next) => {
    try {
        const { role, context: projectContext } = req.body;

        if (!role || !projectContext) {
            res.status(400).json({
                success: false,
                message: 'role and context are required'
            });
            return;
        }

        logger.info(`[LLMRouter] Generating agent profile for role: ${role}`);

        const prompt = `Generate a detailed profile for a ${role} agent working on this project: ${projectContext}

Return a JSON object with:
- name: A professional name for this agent
- role: The exact role (use: ${role})
- description: A brief description of the agent's expertise (2-3 sentences)
- goal: The agent's primary goal (1 sentence)
- backstory: A brief backstory explaining the agent's experience (2-3 sentences)

Be specific to the project context and role.`;

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                description: { type: Type.STRING },
                goal: { type: Type.STRING },
                backstory: { type: Type.STRING }
            },
            required: ['name', 'role', 'description', 'goal', 'backstory']
        };

        const startTime = Date.now();

        // Use LLM router with structured output support
        // For structured output, we need to use a model that supports it
        const result = await llmRouter.executeWithFallback({
            prompt,
            context: {
                agentRole: 'Orchestrator',
                taskType: 'structured',
                model: 'gemini-2.5-pro' // Use model that supports structured output
            },
            routingContext: {
                userId: (req as any).user?.id
            },
            requestType: 'agent-profile-generation',
            contextType: 'other'
        });

        // Parse structured output from text response
        let agentProfile;
        try {
            agentProfile = JSON.parse(result.text);
        } catch (parseError) {
            // If parsing fails, try to extract JSON from markdown code blocks
            const jsonMatch = result.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
                agentProfile = JSON.parse(jsonMatch[1]);
            } else {
                throw new Error('Failed to parse agent profile JSON');
            }
        }

        const finalProfile = {
            id: Math.random().toString(36).substring(7),
            name: agentProfile.name || role.split(' ')[0],
            role: agentProfile.role || role,
            mode: 'deterministic',
            avatar: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${role}`,
            description: agentProfile.description || "Specialist Agent",
            goal: agentProfile.goal || "Execute tasks efficiently.",
            backstory: agentProfile.backstory || "Experienced AI agent."
        };

        const latency = Date.now() - startTime;
        logger.info(`[LLMRouter] Agent profile generated in ${latency}ms`);

        res.json({
            success: true,
            data: finalProfile,
            latency: latency,
            modelUsed: result.modelUsed,
            provider: result.provider
        });
    } catch (error: unknown) {
        logger.error('[LLMRouter] Agent profile generation failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate agent profile',
            error: { message: error instanceof Error ? error.message : String(error) }
        });
    }
});

/**
 * Quick suggestions endpoint - optimized for speed
 */
router.post('/quick-suggestions', async (req: AuthRequest, res, _next) => {
    try {
        const { input, history } = req.body;

        if (!input || input.trim().length < 3) {
            res.json({
                success: true,
                data: []
            });
            return;
        }

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING },
                            prompt: { type: Type.STRING }
                        },
                        required: ['label', 'prompt']
                    }
                }
            },
            required: ['suggestions']
        };

        const conversationText = (history || [])
            .slice(-5)
            .map((m: any) => `${m.sender}: ${m.text}`)
            .join('\n')
            .substring(0, 800);

        const prompt = `You are an AI assistant helping a user refine their project idea. The user has typed: "${input}"

${conversationText ? `Previous conversation context:\n${conversationText}\n\n` : ""}Your task is to generate 3-5 ENHANCED and RELEVANT versions of their project idea. Each suggestion must:

1. **Build directly on their input** - Don't create unrelated ideas. Enhance what they wrote, don't replace it.
2. **Add relevant specifics** - Include:
   - Key features that make sense for this type of project
   - Technical considerations (platform, architecture, integrations)
   - User experience elements
   - Business/functional requirements
3. **Stay focused** - Each suggestion should be a variation/improvement of their core idea, not a completely different project.
4. **Be actionable** - Ready to use as a complete project description (2-4 sentences).

Examples:
- If user says "todo app" → suggest variations like "Todo app with categories and due dates", "Collaborative team todo app", "Todo app with calendar integration"
- If user says "e-commerce site" → suggest "E-commerce platform with payment integration", "E-commerce with inventory management", "E-commerce with customer reviews"

DO NOT suggest completely unrelated projects. Each suggestion must be clearly connected to their original idea.

Return a JSON array with label (short 2-4 words) and prompt (enhanced description).`;

        const startTime = Date.now();

        // Use LLM router with fast model for quick suggestions
        const result = await llmRouter.executeWithFallback({
            prompt,
            context: {
                agentRole: 'Orchestrator',
                taskType: 'structured',
                model: 'gemini-2.5-pro' // Use model that supports structured output
            },
            routingContext: {
                userId: (req as any).user?.id
            },
            requestType: 'quick-suggestions',
            contextType: 'wizard'
        });

        // Parse structured output
        let parsedResult;
        try {
            parsedResult = JSON.parse(result.text);
        } catch (parseError) {
            const jsonMatch = result.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
                parsedResult = JSON.parse(jsonMatch[1]);
            } else {
                parsedResult = { suggestions: [] };
            }
        }

        const suggestions = parsedResult.suggestions || [];
        const latency = Date.now() - startTime;

        // Track usage
        try {
            await usageTracker.trackUsage({
                userId: (req as any).user?.userId,
                modelId: result.modelUsed,
                provider: result.provider,
                modelIdentifier: result.modelUsed,
                inputTokens: result.usage?.promptTokens || result.usage?.promptTokenCount || 0,
                outputTokens: result.usage?.candidatesTokens || result.usage?.candidatesTokenCount || 0,
                requestType: 'quick-suggestions',
                context: 'wizard',
                success: true,
                latencyMs: latency
            });
        } catch (trackError) {
            logger.error('Failed to track usage for quick suggestions:', trackError);
        }

        res.json({
            success: true,
            data: suggestions,
            latency: latency
        });
    } catch (error: unknown) {
        logger.error('[LLMRouter] Quick suggestions failed:', error);
        // Don't fail - return empty array so UI doesn't break
        res.json({
            success: true,
            data: [],
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Generate app theme (for theme studio)
 */
router.post('/generate-theme', async (req: AuthRequest, res, _next) => {
    try {
        const { description, projectContext } = req.body;

        if (!description || !description.trim()) {
            res.status(400).json({
                success: false,
                message: 'description is required'
            });
            return;
        }

        logger.info('[LLMRouter] Generating comprehensive theme with assets:', description);

        const projectType = detectProjectType(projectContext || '');
        const isGame = projectType === 'game';
        const isWebsite = projectType === 'website' || projectType === 'web-app';
        const isMobile = projectType === 'mobile-app';

        // Build the comprehensive theme prompt (simplified version - full version is very long)
        const prompt = `You are a creative UI/UX designer and game artist specializing in comprehensive theme design. Generate a complete, immersive theme with full assets based on this user request: "${description}".

IMPORTANT: This can be ANY type of theme - seasonal (Halloween, Christmas), aesthetic (Cyberpunk, Minimalist, Retro), era-based (1950s Diner, Victorian, Futuristic), nature-based (Ocean, Forest, Desert), or any creative concept the user describes.

${projectContext ? `PROJECT CONTEXT: ${projectContext.substring(0, 2000)}\n\n` : ''}
${projectType ? `PROJECT TYPE DETECTED: ${projectType.toUpperCase()}\n\n` : ''}

You must generate a COMPLETE SKIN TRANSFORMATION that includes:
1. Complete Theme Object with colors, fonts, graphics, styles
2. Interactive Prototype HTML (wireframeHtml)
3. Theme CSS (themeCss)
4. Asset Description
5. Character Designs (for games only)
6. Game Mechanics (for games only)
7. UI Assets (for websites/web apps only)

Be creative, immersive, and ensure ALL elements work together cohesively!`;

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                primary: { type: Type.STRING },
                secondary: { type: Type.STRING },
                accent: { type: Type.STRING },
                background: { type: Type.STRING },
                textColor: { type: Type.STRING },
                fontFamily: { type: Type.STRING },
                graphics: { type: Type.STRING },
                styles: { type: Type.STRING },
                wireframeHtml: { type: Type.STRING },
                themeCss: { type: Type.STRING },
                assetDescription: { type: Type.STRING },
                characterDesigns: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            description: { type: Type.STRING },
                            spriteCss: { type: Type.STRING },
                            animations: { type: Type.STRING },
                            themeIntegration: { type: Type.STRING },
                            mechanics: { type: Type.STRING },
                            physics: { type: Type.STRING }
                        }
                    }
                },
                gameMechanics: {
                    type: Type.OBJECT,
                    properties: {
                        movement: { type: Type.STRING },
                        controls: { type: Type.STRING },
                        physics: { type: Type.STRING },
                        gameplay: { type: Type.STRING },
                        progression: { type: Type.STRING },
                        interactions: { type: Type.STRING },
                        code: { type: Type.STRING }
                    }
                },
                uiAssets: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            name: { type: Type.STRING },
                            svgCode: { type: Type.STRING },
                            cssClass: { type: Type.STRING },
                            usage: { type: Type.STRING }
                        }
                    }
                }
            },
            required: ['id', 'label', 'primary', 'secondary', 'accent', 'background', 'textColor', 'fontFamily', 'graphics', 'styles', 'wireframeHtml', 'themeCss', 'assetDescription', 'characterDesigns', 'gameMechanics', 'uiAssets']
        };

        const startTime = Date.now();

        // Use LLM router with structured output model
        const result = await llmRouter.executeWithFallback({
            prompt,
            context: {
                agentRole: 'UX Designer',
                taskType: 'structured',
                model: 'gemini-2.0-flash-exp' // Use model that supports structured output
            },
            routingContext: {
                userId: (req as any).user?.id
            },
            requestType: 'theme-generation',
            contextType: 'other'
        });

        // Parse structured output with robust cleaning
        let theme;

        // Helper to clean malformed JSON from LLM
        const cleanJsonString = (str: string): string => {
            let cleaned = str.trim();
            // Remove markdown code fences
            cleaned = cleaned.replace(/^```(?:json)?[\s\n]*/gi, '').replace(/[\s\n]*```$/gi, '');
            // Fix single quotes to double quotes (but not in strings)
            cleaned = cleaned.replace(/'/g, '"');
            // Fix unquoted keys: { key: value } -> { "key": value }
            cleaned = cleaned.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            // Remove trailing commas before } or ]
            cleaned = cleaned.replace(/,(\s*[\}\]])/g, '$1');
            // Fix "undefined" to null
            cleaned = cleaned.replace(/:\s*undefined\b/g, ': null');
            return cleaned;
        };

        try {
            // First try direct parse
            theme = typeof result.text === 'string' ? JSON.parse(result.text) : result.text;
        } catch (parseError) {
            // Try to extract and clean JSON from response
            let jsonText = result.text;
            const jsonMatch = result.text.match(/```(?:json)?[\s\n]*([\s\S]*?)[\s\n]*```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1];
            }

            const cleanedJson = cleanJsonString(jsonText);
            try {
                theme = JSON.parse(cleanedJson);
                logger.info('[LLMRouter] Theme JSON parsed after cleaning');
            } catch (cleanParseError) {
                logger.error('[LLMRouter] Failed to parse cleaned theme JSON:', cleanParseError);
                logger.debug('[LLMRouter] Raw JSON text:', jsonText.substring(0, 500));
                // Return a default theme instead of throwing
                theme = {
                    id: 'fallback-' + Math.random().toString(36).substring(7),
                    label: description || 'Generated Theme',
                    primary: '#6366f1',
                    secondary: '#8b5cf6',
                    accent: '#ec4899',
                    background: '#f8fafc',
                    textColor: '#1e293b'
                };
                logger.warn('[LLMRouter] Using fallback theme due to JSON parse failure');
            }
        }

        const finalTheme = {
            id: theme.id || 'generated-' + Math.random().toString(36).substring(7),
            label: theme.label || 'AI Generated Theme',
            primary: theme.primary || '#6366f1',
            secondary: theme.secondary || '#8b5cf6',
            accent: theme.accent || '#ec4899',
            background: theme.background || '#f8fafc',
            textColor: theme.textColor || '#1e293b',
            fontFamily: theme.fontFamily || 'system-ui, -apple-system, sans-serif',
            graphics: theme.graphics || '',
            styles: theme.styles || '',
            wireframeHtml: theme.wireframeHtml || '',
            themeCss: theme.themeCss || '',
            assetDescription: theme.assetDescription || '',
            characterDesigns: Array.isArray(theme.characterDesigns) ? theme.characterDesigns : [],
            gameMechanics: theme.gameMechanics || (isGame ? {
                movement: 'Platformer movement with arrow keys/WASD',
                controls: 'Keyboard and touch controls',
                physics: 'Gravity-based physics with collision detection',
                gameplay: 'Collect items, avoid enemies, reach goal',
                progression: 'Score-based progression with level completion',
                interactions: 'Jump, collect, defeat enemies',
                code: '// Game mechanics code will be in wireframeHtml'
            } : null),
            uiAssets: Array.isArray(theme.uiAssets) ? theme.uiAssets : []
        };

        const latency = Date.now() - startTime;
        logger.info(`[LLMRouter] Comprehensive theme with assets generated in ${latency}ms`);

        res.json({
            success: true,
            data: finalTheme,
            latency: latency
        });
    } catch (error: unknown) {
        logger.error('[LLMRouter] Theme generation failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate theme',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Orchestrate next steps (task generation) - OPTIMIZED FOR SPEED
 */
router.post('/orchestrate', async (req: AuthRequest, res, _next) => {
    try {
        const { phase, description, completedTasks, useInternet, mcpServers, maxTasks, agents } = req.body;

        if (!phase || !description || !agents) {
            res.status(400).json({ success: false, message: 'phase, description, and agents are required' });
            return;
        }

        logger.info(`[LLMRouter] Orchestrating tasks for phase: ${phase}${useInternet ? ' (with internet research)' : ''}`);

        // RESEARCH-BASED: Perform online research if internet is enabled
        let researchContext = '';
        if (useInternet) {
            try {
                logger.info(`[Orchestration] Performing online research for project: ${description.substring(0, 100)}...`);

                const projectKeywords = description
                    .split(/\s+/)
                    .filter((word: string) => word.length > 4)
                    .slice(0, 10)
                    .join(' ');

                const researchPrompt = `Research the following project concept and provide current best practices, technologies, and implementation approaches:

Project Description: ${description.substring(0, 1000)}
Key Concepts: ${projectKeywords}

Provide:
1. Current industry best practices for this type of project
2. Recommended technologies and frameworks
3. Common implementation patterns
4. Important considerations and potential challenges
5. Relevant standards or compliance requirements

Keep the research concise and focused on actionable insights for task generation.`;

                // Use LLM router with internet search enabled
                const researchResult = await llmRouter.executeWithFallback({
                    prompt: researchPrompt,
                    context: {
                        agentRole: 'Research Agent',
                        taskType: 'research'
                    },
                    routingContext: {
                        userId: (req as any).user?.id
                    },
                    requestType: 'research',
                    contextType: 'workspace',
                    useInternet: true
                });

                researchContext = researchResult.text || '';
                if (researchContext) {
                    researchContext = researchContext.substring(0, 2000);
                }
                logger.info(`[Orchestration] Research completed: ${researchContext.length} characters`);
            } catch (researchError: any) {
                logger.warn(`[Orchestration] Research failed, continuing without it: ${researchError.message}`);
            }
        }

        // Limit completed tasks to last 3 to reduce prompt size
        const recentCompletedTasks = (completedTasks || []).slice(-3);

        // Use enhanced prompt engineering
        const { enhanceOrchestrationPrompt } = await import('../../services/promptEngineering.service.js');
        const enhancedPromptResult = enhanceOrchestrationPrompt(
            phase,
            description,
            recentCompletedTasks,
            agents,
            researchContext,
            maxTasks || 8
        );
        const prompt = enhancedPromptResult.prompt;

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                tasks: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            assignedTo: { type: Type.STRING },
                            dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                            traceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["title", "description", "assignedTo"]
                    }
                }
            },
            required: ["tasks"]
        };

        // Smart model selection based on complexity
        const complexPhases = ['ARCHITECTURE', 'INTEGRATION', 'TEST_PLANNING'];
        const isComplexPhase = complexPhases.includes(phase.toUpperCase());
        const isLargeTaskCount = (maxTasks || 8) > 12;
        const hasManyAgents = agents.length > 5;
        const shouldUseBetterModel = isComplexPhase || isLargeTaskCount || hasManyAgents;

        const startTime = Date.now();
        let result: any;
        let modelUsed = shouldUseBetterModel ? 'gemini-3-pro-preview' : 'gemini-2.5-pro';
        let attempt = 0;
        const maxRetries = 2;

        while (attempt <= maxRetries) {
            try {
                // Use LLM router with structured output
                const llmResult = await llmRouter.executeWithFallback({
                    prompt,
                    context: {
                        agentRole: 'Orchestrator',
                        taskType: 'structured',
                        model: modelUsed
                    },
                    routingContext: {
                        userId: (req as any).user?.id
                    },
                    requestType: 'orchestration',
                    contextType: 'workspace'
                });

                // Parse structured output
                try {
                    result = JSON.parse(llmResult.text);
                } catch (parseError) {
                    const jsonMatch = llmResult.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                    if (jsonMatch) {
                        result = JSON.parse(jsonMatch[1]);
                    } else {
                        throw new Error('Failed to parse orchestration JSON');
                    }
                }

                modelUsed = llmResult.modelUsed;
                break; // Success - exit retry loop
            } catch (error: unknown) {
                attempt++;
                const isLastAttempt = attempt > maxRetries;
                const errMap = error instanceof Error ? error : new Error(String(error));

                if (isLastAttempt) {
                    logger.error(`[Orchestration] Failed after ${maxRetries + 1} attempts:`, errMap);
                    const errorMsg = errMap.message?.includes('timeout')
                        ? `The orchestration request timed out after ${maxRetries + 1} attempts. This can happen with complex projects or slow API responses. Please try again or reduce the number of tasks.`
                        : `Failed to orchestrate tasks: ${errMap.message || 'Unknown error'}`;
                    throw new Error(errorMsg);
                }

                // Switch to fallback model on retry
                modelUsed = shouldUseBetterModel ? 'gemini-2.5-pro' : 'gemini-3-pro-preview';
                logger.warn(`[Orchestration] Attempt ${attempt} failed, retrying with ${modelUsed}...`);
                await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 2000)));
            }
        }

        const latency = Date.now() - startTime;
        const taskCount = result.tasks?.length || 0;

        logger.info(`[LLMRouter] Orchestration completed in ${latency}ms using ${modelUsed}, generated ${taskCount} tasks`);

        // Track usage
        try {
            const userId = (req as AuthRequest).user?.id;
            if (userId) {
                usageTracker.trackUsage({
                    userId,
                    modelId: modelUsed,
                    provider: 'gemini',
                    modelIdentifier: modelUsed,
                    inputTokens: 0, // Will be tracked by LLM router
                    outputTokens: 0,
                    requestType: 'orchestration',
                    context: 'workspace',
                    success: true,
                    latencyMs: latency,
                    metadata: { phase, tasksGenerated: taskCount }
                }).catch((trackErr) => {
                    logger.debug('Usage tracking failed (non-critical):', trackErr);
                });
            }
        } catch (trackErr) {
            logger.debug('Usage tracking setup failed (non-critical):', trackErr);
        }

        res.json({
            success: true,
            data: { tasks: result.tasks || [] },
            latency,
            metrics: {
                latencyMs: latency,
                tasksGenerated: taskCount,
                phase,
                modelUsed,
                attempt: attempt + 1
            }
        });
    } catch (error: unknown) {
        logger.error('[LLMRouter] Orchestration failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const userMessage = errorMessage.includes('timeout')
            ? 'The orchestration request timed out. This can happen with complex projects. Please try again or reduce the number of tasks requested.'
            : errorMessage.includes('API key') || errorMessage.includes('authentication')
                ? 'API configuration error. Please check your API key settings in the backend configuration.'
                : 'Failed to generate tasks. Please try again or check your project settings.';
        const isDev = process.env.NODE_ENV === 'development';
        const stack = error instanceof Error ? error.stack : undefined;
        res.status(500).json({
            success: false,
            message: userMessage,
            error: isDev ? { message: errorMessage, stack: stack } : { message: errorMessage }
        });
    }
});

/**
 * Interrogate Agent - Ask agent questions about their work
 */
router.post('/interrogate', async (req: AuthRequest, res, _next) => {
    try {
        const { agentRole, question, context } = req.body;

        if (!agentRole || !question) {
            res.status(400).json({
                success: false,
                message: 'agentRole and question are required'
            });
            return;
        }

        logger.info(`[LLMRouter] Interrogating agent: ${agentRole}`);

        const prompt = `You are a ${agentRole} agent. Answer the following question based on your expertise and the project context:

Question: ${question}

Project Context: ${context || 'No context provided'}

Provide a clear, concise answer based on your role and expertise.`;

        const result = await llmRouter.executeWithFallback({
            prompt,
            context: {
                agentRole,
                taskType: 'chat'
            },
            routingContext: {
                userId: (req as any).user?.id
            },
            requestType: 'agent-interrogation',
            contextType: 'other'
        });

        res.json({
            success: true,
            data: {
                text: result.text
            }
        });
    } catch (error: unknown) {
        logger.error('Failed to interrogate agent:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to interrogate agent'
        });
    }
});

/**
 * Modify Task with AI - Use AI to modify task based on instruction
 */
router.post('/modify-task', async (req: AuthRequest, res, _next) => {
    try {
        const { task, instruction } = req.body;

        if (!task || !instruction) {
            res.status(400).json({
                success: false,
                message: 'task and instruction are required'
            });
            return;
        }

        logger.info(`[LLMRouter] Modifying task: ${task.title || task.id}`);

        const prompt = `Modify the following task based on the instruction:

Original Task:
Title: ${task.title}
Description: ${task.description || ''}
Assigned To: ${task.assignedTo || ''}
Phase: ${task.phase || ''}

Instruction: ${instruction}

Return a JSON object with the modified task fields:
{
  "title": "modified title",
  "description": "modified description",
  "assignedTo": "agent role (if changed)",
  "phase": "phase (if changed)",
  "dependencies": ["dependency ids if changed"]
}

Only include fields that should be modified. Keep other fields unchanged.`;

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                assignedTo: { type: Type.STRING },
                phase: { type: Type.STRING },
                dependencies: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        };

        const result = await llmRouter.executeWithFallback({
            prompt,
            context: {
                agentRole: 'Orchestrator',
                taskType: 'structured'
            },
            routingContext: {
                userId: (req as any).user?.id
            },
            requestType: 'task-modification',
            contextType: 'workspace'
        });

        // Parse structured output
        let modifications;
        try {
            modifications = JSON.parse(result.text);
        } catch (parseError) {
            // Fallback: extract JSON from text if not pure JSON
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                modifications = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Failed to parse modifications from response');
            }
        }

        // Merge modifications with original task
        const modifiedTask = {
            ...task,
            ...modifications
        };

        res.json({
            success: true,
            data: {
                task: modifiedTask
            }
        });
    } catch (error: unknown) {
        logger.error('Failed to modify task:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to modify task'
        });
    }
});

export default router;
