/**
 * Unified LLM Routes - All LLM requests go through the intelligent router
 * Replaces provider-specific routes (e.g., /api/gemini/*) with unified /api/llm/*
 */

import express from 'express';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { logger } from '../utils/logger.js';
import { usageTracker } from '../services/llm/UsageTracker.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { routeTimeout } from '../middleware/timeout.js';
import {
  functionCallProcessor,
  LLMResponseWithFunctionCalls,
} from '../services/llm/FunctionCallProcessor.js';
import { Type, Schema } from '@google/genai';
import { evaluationService } from '../services/evaluation.service.js';
import { agentMemory } from '../services/agentMemory.service.js';
import { detectProjectType } from '../utils/llmRouteHelpers.js';
import { embeddingService } from '../services/embedding.service.js';
import { toApiError } from '../errors/ApiError.js';
import previewRouter from './llm/preview.routes.js';

export const path = '/api/llm';

const router = express.Router();

// Project preview + prototype generation (split module; must be mounted on /api/llm)
router.use(previewRouter);

// Optional authentication - allows unauthenticated requests but extracts user if available
router.use((req: AuthRequest, res, next) => {
  console.log(`[llm.routes.ts] Request matched /api/llm router. Path: ${req.path}`);
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authenticateToken(req, res, () => {
      console.log(`[llm.routes.ts] Auth passed for ${req.path}`);
      next();
    });
  } else {
    console.log(`[llm.routes.ts] No auth header for ${req.path}`);
    next();
  }
});

// ============================================================================
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
        message: 'message is required',
      });
      return;
    }

    logger.info(`[LLMRouter] Chat request received for agent: ${agentRole || 'Orchestrator'}`);

    // Build chat prompt from history
    let chatPrompt =
      history && history.length > 0
        ? `${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\nuser: ${message}`
        : message;

    // INTERNET RESEARCH INJECTION
    // If enabled, perform research first and inject context
    const useInternet = req.body.useInternet === true;
    const researchTopic = req.body.researchTopic || message;

    if (useInternet) {
      try {
        logger.info(
          `[LLMRouter] Performing internet research for chat topic: ${researchTopic.substring(0, 50)}...`
        );
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
          useInternet: true,
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
      const collectedInfo = conversationLength >= 4;

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
        systemInstruction: systemInstruction,
      },
      routingContext: {
        userId: (req as any).user?.id,
        projectId: projectState?.id,
        userPreferences: preferFastModel
          ? {
              costPreference: 'low', // Prefer cheaper/faster models
            }
          : undefined,
      },
      requestType: 'chat',
      contextType: isWizardContext ? 'wizard' : 'other',
    });

    res.json({
      success: true,
      response: result.text,
      usage: result.usage,
      modelUsed: result.modelUsed,
      provider: result.provider,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Chat failed:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Chat request failed',
      error: apiError.message,
    });
  }
});

/**
 * Streaming chat endpoint - routes through LLM router with Server-Sent Events
 */
router.post('/chat/stream', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
  try {
    const {
      message,
      history,
      projectState,
      contextType,
      preferFastModel,
      maxTokens,
      systemContext,
      useInternet,
    } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        message: 'message is required',
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
    let chatPrompt =
      history && history.length > 0
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
          systemInstruction: systemInstruction, // Pass explicitly here!
        },
        routingContext: {
          userId: (req as any).user?.id,
          projectId: projectState?.id,
          userPreferences: preferFastModel
            ? {
                costPreference: 'low',
              }
            : undefined,
        },
        requestType: 'chat',
        contextType: isWizardContext ? 'wizard' : 'other',
        useInternet: useInternet === true, // Pass internet research flag
      });

      // Send chunks as they arrive
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (streamError: unknown) {
      const apiError = toApiError(streamError);
      logger.error('[LLMRouter] Streaming error:', apiError);
      res.write(`data: ${JSON.stringify({ error: apiError.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Streaming chat setup failed:', apiError);
    if (!res.headersSent) {
      res.status(apiError.statusCode).json({
        success: false,
        message: 'Streaming chat request failed',
        error: apiError.message,
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: apiError.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
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
        message: 'text is required',
      });
      return;
    }

    // Embeddings typically use specific models, but route through router for consistency
    const embedding = await embeddingService.generateEmbedding(text);

    res.json({
      success: true,
      embedding,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Embedding generation failed:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Failed to generate embedding',
      error: apiError.message,
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
        message: 'prompt is required',
      });
      return;
    }

    const enhancementPrompt = `Enhance and improve the following prompt to be more clear, specific, and effective:\n\n${prompt}\n\nReturn only the enhanced prompt, no additional explanation.`;

    const result = await llmRouter.executeWithFallback({
      prompt: enhancementPrompt,
      context: {
        agentRole: 'Orchestrator',
        taskType: 'text-generation',
      },
      routingContext: {
        userId: (req as any).user?.id,
      },
      requestType: 'prompt-enhancement',
      contextType: 'other',
    });

    res.json({
      success: true,
      enhancedPrompt: result.text,
      modelUsed: result.modelUsed,
      provider: result.provider,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Prompt enhancement failed:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Failed to enhance prompt',
      error: apiError.message,
    });
  }
});

/**
 * Execute task - routes through LLM router with function calling support
 */
router.post('/execute-task', routeTimeout(300000), async (req: AuthRequest, res, _next) => {
  try {
    const {
      task,
      projectState,
      projectContext,
      useInternet,
      mcpServers,
      selectedStandards,
      standards,
      tools: clientTools,
      functionDeclarations,
    } = req.body;

    if (!task) {
      res.status(400).json({
        success: false,
        message: 'task is required',
      });
      return;
    }

    logger.info(`[LLMRouter] Executing task: ${task.title}`);

    // WI-1: forward the tool declarations the client already builds, so the model can call tools.
    // Gated behind HARNESS_TOOLS_ENABLED until the MCP exec hardening (WI-2) lands.
    // `functionDeclarations` (flat [{ name, description, parameters }]) is the source of truth; it is
    // wrapped into the [{ functionDeclarations }] shape the router's provider converters expect.
    // `clientTools` is only trusted when already wrapped, since its shape is built client-side.
    const toolsEnabled = (process.env.HARNESS_TOOLS_ENABLED || '').toLowerCase() === 'true';
    const looksWrapped = (arr: any[]): boolean =>
      arr.every(t => t && Array.isArray(t.functionDeclarations));
    const tools: any[] = !toolsEnabled
      ? []
      : Array.isArray(functionDeclarations) && functionDeclarations.length
        ? [{ functionDeclarations }]
        : Array.isArray(clientTools) && clientTools.length && looksWrapped(clientTools)
          ? clientTools
          : [];
    if (tools.length > 0) {
      logger.info(
        `[LLMRouter] execute-task: forwarding ${functionDeclarations?.length ?? clientTools?.length ?? 0} tool declaration(s) to the model`
      );
    }

    // Contract reconciliation: the client sends `standards` (string[]); the server historically read
    // `selectedStandards`. Fall back across both so standards actually reach evaluation.
    const standardsList = selectedStandards ?? standards ?? [];

    // RAG memory (dim 7): retrieve relevant past experiences for this agent + task and inject them
    // into the system instruction. Flag-gated (HARNESS_MEMORY_ENABLED); returns '' when disabled.
    const agentRoleForRun = task.assignedTo || 'Implementation Agent';
    const memoryContext = await agentMemory.retrieveRelevantMemory(
      agentRoleForRun,
      task.description || task.title
    );
    const systemInstruction = `You are executing a task: ${task.title}${memoryContext}`;

    const result = await llmRouter.executeWithFallback({
      prompt: task.description || task.title,
      context: {
        agentRole: agentRoleForRun,
        taskType: 'code-generation',
        tools: tools.length > 0 ? tools : undefined,
        systemInstruction,
      },
      routingContext: {
        userId: (req as any).user?.id,
        projectId: projectState?.id,
      },
      requestType: 'task-execution',
      contextType: 'workspace',
      useInternet: useInternet || false,
    });

    // Process function calls if present
    const responseWithFunctionCalls = result as LLMResponseWithFunctionCalls;
    if (
      responseWithFunctionCalls.functionCalls &&
      responseWithFunctionCalls.functionCalls.length > 0
    ) {
      const processedResult = await functionCallProcessor.processWithFunctionCalls(
        responseWithFunctionCalls,
        task.description || task.title,
        tools,
        systemInstruction,
        agentRoleForRun,
        projectState?.id,
        task.id
      );

      res.json({
        success: true,
        output: processedResult.text,
        resources: result.resources || [], // URLs from Google Search grounding
        functionCalls: processedResult.functionCallsExecuted,
        modelUsed: processedResult.modelUsed,
        provider: processedResult.provider,
      });
      return;
    }

    // Parse output for detected issues and create tasks
    let createdTasks: any[] = [];
    const outputText = result.text || '';

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
          standards: standardsList,
          projectContext: projectState?.description || projectContext || '',
        });
        logger.info(
          `[LLMRouter] Evaluation completed for task "${task.title}" - Score: ${evaluation.score}/100`
        );
      } catch (evalError: any) {
        logger.warn('[LLMRouter] Evaluation failed, using quick evaluate:', evalError);
        try {
          evaluation = await evaluationService.quickEvaluate(outputText, task.description || '');
        } catch (quickEvalError: any) {
          logger.error('[LLMRouter] Quick evaluation also failed:', quickEvalError);
          // Return pending evaluation if both fail
          evaluation = {
            score: 0,
            reasoning:
              'Evaluation service encountered an error. Quality score will be calculated on retry.',
            criteria: ['Evaluation Error'],
            timestamp: Date.now(),
          };
        }
      }
    } else {
      // Output too short - return pending evaluation
      evaluation = {
        score: 0,
        reasoning:
          'Output is too short to evaluate meaningfully. Please provide more substantial output.',
        criteria: ['Output Length'],
        timestamp: Date.now(),
      };
    }

    // RAG memory (dim 7): record this task's outcome so future runs of this agent can retrieve it.
    void agentMemory.recordExperience({
      agentRole: agentRoleForRun,
      taskTitle: task.title || 'Untitled Task',
      output: outputText,
      score: evaluation?.score,
      projectId: projectState?.id,
    });

    if (outputText && projectState?.id && (req as any).user?.id) {
      try {
        const { issueParserService } = await import('../services/issueParser.service.js');
        const { issueTaskCreationService } =
          await import('../services/issueTaskCreation.service.js');

        // Parse issues from agent output
        const detectedIssues = issueParserService.parseIssuesFromOutput(
          outputText,
          task.assignedTo || 'Implementation Agent',
          task.id // Use task ID as artifact reference
        );

        // Create tasks for detected issues (only critical/high severity to avoid spam)
        const importantIssues = detectedIssues.filter(
          issue => issue.severity === 'critical' || issue.severity === 'high'
        );

        if (importantIssues.length > 0) {
          const taskResults = await issueTaskCreationService.createTasksForIssues(
            projectState.id,
            importantIssues,
            (req as any).user.id
          );

          createdTasks = taskResults
            .filter(r => r.created)
            .map(r => ({ taskId: r.taskId, message: r.message }));

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
        createdTasks: createdTasks.length > 0 ? createdTasks : undefined,
      },
      // Also include at top level for backward compatibility
      output: outputText,
      evaluation: evaluation, // ⭐ Quality score at top level too
      resources: result.resources || [], // URLs from Google Search grounding
      usage: result.usage,
      modelUsed: result.modelUsed,
      provider: result.provider,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Task execution failed:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Task execution failed',
      error: apiError.message,
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
        message: 'role and context are required',
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
        backstory: { type: Type.STRING },
      },
      required: ['name', 'role', 'description', 'goal', 'backstory'],
    };

    const startTime = Date.now();

    // Use LLM router with structured output support
    // For structured output, we need to use a model that supports it
    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Orchestrator',
        taskType: 'structured',
        model: 'gemini-2.5-pro', // Use model that supports structured output
      },
      routingContext: {
        userId: (req as any).user?.id,
      },
      requestType: 'agent-profile-generation',
      contextType: 'other',
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
      description: agentProfile.description || 'Specialist Agent',
      goal: agentProfile.goal || 'Execute tasks efficiently.',
      backstory: agentProfile.backstory || 'Experienced AI agent.',
    };

    const latency = Date.now() - startTime;
    logger.info(`[LLMRouter] Agent profile generated in ${latency}ms`);

    res.json({
      success: true,
      data: finalProfile,
      latency: latency,
      modelUsed: result.modelUsed,
      provider: result.provider,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Agent profile generation failed:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Failed to generate agent profile',
      error: { message: apiError.message || 'Unknown error' },
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
        data: [],
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
              prompt: { type: Type.STRING },
            },
            required: ['label', 'prompt'],
          },
        },
      },
      required: ['suggestions'],
    };

    const conversationText = (history || [])
      .slice(-5)
      .map((m: any) => `${m.sender}: ${m.text}`)
      .join('\n')
      .substring(0, 800);

    const prompt = `You are an AI assistant helping a user refine their project idea. The user has typed: "${input}"

${conversationText ? `Previous conversation context:\n${conversationText}\n\n` : ''}Your task is to generate 3-5 ENHANCED and RELEVANT versions of their project idea. Each suggestion must:

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
        model: 'gemini-2.5-pro', // Use model that supports structured output
      },
      routingContext: {
        userId: (req as any).user?.id,
      },
      requestType: 'quick-suggestions',
      contextType: 'wizard',
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
        latencyMs: latency,
      });
    } catch (trackError) {
      logger.error('Failed to track usage for quick suggestions:', trackError);
    }

    res.json({
      success: true,
      data: suggestions,
      latency: latency,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Quick suggestions failed:', apiError);
    // Don't fail - return empty array so UI doesn't break
    res.json({
      success: true,
      data: [],
      error: apiError.message,
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
        message: 'description is required',
      });
      return;
    }

    logger.info('[LLMRouter] Generating comprehensive theme with assets:', description);

    const projectType = detectProjectType(projectContext || '');
    const isGame = projectType === 'game';

    // Removed unused vars: isWebsite, isMobile

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

    // Schema removed (unused)

    const startTime = Date.now();

    // Use LLM router with structured output model
    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'UX Designer',
        taskType: 'structured',
        model: 'gemini-2.0-flash-exp', // Use model that supports structured output
      },
      routingContext: {
        userId: (req as any).user?.id,
      },
      requestType: 'theme-generation',
      contextType: 'other',
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
          textColor: '#1e293b',
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
      gameMechanics:
        theme.gameMechanics ||
        (isGame
          ? {
              movement: 'Platformer movement with arrow keys/WASD',
              controls: 'Keyboard and touch controls',
              physics: 'Gravity-based physics with collision detection',
              gameplay: 'Collect items, avoid enemies, reach goal',
              progression: 'Score-based progression with level completion',
              interactions: 'Jump, collect, defeat enemies',
              code: '// Game mechanics code will be in wireframeHtml',
            }
          : null),
      uiAssets: Array.isArray(theme.uiAssets) ? theme.uiAssets : [],
    };

    const latency = Date.now() - startTime;
    logger.info(`[LLMRouter] Comprehensive theme with assets generated in ${latency}ms`);

    res.json({
      success: true,
      data: finalTheme,
      latency: latency,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Theme generation failed:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Failed to generate theme',
      error: apiError.message,
    });
  }
});

/**
 * Orchestrate next steps (task generation) - OPTIMIZED FOR SPEED
 */
router.post('/orchestrate', async (req: AuthRequest, res, _next) => {
  try {
    const { phase, description, completedTasks, useInternet, mcpServers, maxTasks, agents } =
      req.body;

    if (!phase || !description || !agents) {
      res
        .status(400)
        .json({ success: false, message: 'phase, description, and agents are required' });
      return;
    }

    logger.info(
      `[LLMRouter] Orchestrating tasks for phase: ${phase}${useInternet ? ' (with internet research)' : ''}`
    );

    // RESEARCH-BASED: Perform online research if internet is enabled
    let researchContext = '';
    if (useInternet) {
      try {
        logger.info(
          `[Orchestration] Performing online research for project: ${description.substring(0, 100)}...`
        );

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
            taskType: 'research',
          },
          routingContext: {
            userId: (req as any).user?.id,
          },
          requestType: 'research',
          contextType: 'workspace',
          useInternet: true,
        });

        researchContext = researchResult.text || '';
        if (researchContext) {
          researchContext = researchContext.substring(0, 2000);
        }
        logger.info(`[Orchestration] Research completed: ${researchContext.length} characters`);
      } catch (researchError: any) {
        logger.warn(
          `[Orchestration] Research failed, continuing without it: ${researchError.message}`
        );
      }
    }

    // Limit completed tasks to last 3 to reduce prompt size
    const recentCompletedTasks = (completedTasks || []).slice(-3);

    // Use enhanced prompt engineering
    const { enhanceOrchestrationPrompt } = await import('../services/promptEngineering.service.js');
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
              traceRefs: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'description', 'assignedTo'],
          },
        },
      },
      required: ['tasks'],
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
            model: modelUsed,
          },
          routingContext: {
            userId: (req as any).user?.id,
          },
          requestType: 'orchestration',
          contextType: 'workspace',
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
        const apiError = toApiError(error);

        if (isLastAttempt) {
          logger.error(`[Orchestration] Failed after ${maxRetries + 1} attempts:`, apiError);
          const errorMsg = apiError.message?.includes('timeout')
            ? `The orchestration request timed out after ${maxRetries + 1} attempts. This can happen with complex projects or slow API responses. Please try again or reduce the number of tasks.`
            : `Failed to orchestrate tasks: ${apiError.message || 'Unknown error'}`;
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

    logger.info(
      `[LLMRouter] Orchestration completed in ${latency}ms using ${modelUsed}, generated ${taskCount} tasks`
    );

    // Track usage
    try {
      const userId = (req as AuthRequest).user?.id;
      if (userId) {
        usageTracker
          .trackUsage({
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
            metadata: { phase, tasksGenerated: taskCount },
          })
          .catch(trackErr => {
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
        attempt: attempt + 1,
      },
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Orchestration failed:', apiError);
    const errorMessage = apiError.message || 'Unknown error';
    const userMessage = errorMessage.includes('timeout')
      ? 'The orchestration request timed out. This can happen with complex projects. Please try again or reduce the number of tasks requested.'
      : errorMessage.includes('API key') || errorMessage.includes('authentication')
        ? 'API configuration error. Please check your API key settings in the backend configuration.'
        : 'Failed to generate tasks. Please try again or check your project settings.';
    const isDev = process.env.NODE_ENV === 'development';
    res.status(apiError.statusCode || 500).json({
      success: false,
      message: userMessage,
      error: isDev ? { message: errorMessage, stack: apiError.stack } : { message: errorMessage },
    });
  }
});

/**
 * Deep research endpoint (Research button)
 */
/**
 * Interrogate Agent - Ask agent questions about their work
 */
router.post('/interrogate', async (req: AuthRequest, res, _next) => {
  try {
    const { agentRole, question, context } = req.body;

    if (!agentRole || !question) {
      res.status(400).json({
        success: false,
        message: 'agentRole and question are required',
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
        taskType: 'chat',
      },
      routingContext: {
        userId: (req as any).user?.id,
      },
      requestType: 'agent-interrogation',
      contextType: 'other',
    });

    res.json({
      success: true,
      data: {
        text: result.text,
      },
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to interrogate agent:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: apiError.message || 'Failed to interrogate agent',
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
        message: 'task and instruction are required',
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
        dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    };

    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Orchestrator',
        taskType: 'structured',
      },
      routingContext: {
        userId: (req as any).user?.id,
      },
      requestType: 'task-modification',
      contextType: 'workspace',
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
    // Merge modifications with original task
    const modifiedTask = {
      ...task,
      ...modifications,
    };

    res.json({
      success: true,
      data: {
        task: modifiedTask,
      },
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to modify task:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: apiError.message || 'Failed to modify task',
    });
  }
});

/**
 * Generate project research (Feasibility, Market, Business Analysis)
 */
router.post('/generate-research', async (req: AuthRequest, res) => {
  try {
    const { topic, ideas } = req.body;

    if (!topic) {
      res.status(400).json({ success: false, message: 'Topic is required' });
      return;
    }

    logger.info(`[Research] Generating research for topic: ${topic}`);

    const prompt = `
      You are a senior market research analyst. Create a comprehensive, professional research report for the following project idea.
      Be specific with numbers, percentages, and market data. Provide realistic estimates based on industry standards.
      Include citations and data sources where applicable.
      
      TOPIC: "${topic}"
      
      KEY IDEAS:
      ${ideas?.map((i: any) => `- ${i.text} (${i.category})`).join('\n') || 'No specific ideas provided yet.'}
      
      Generate a JSON response with this comprehensive structure:
      {
        "executiveSummary": {
          "overview": "2-3 sentence overview of the opportunity",
          "keyPoints": ["Point 1: opportunity insight", "Point 2: market potential", "Point 3: key risk", "Point 4: main conclusion", "Point 5: recommended action"]
        },
        "overallScore": 75,
        "objectivesAndScope": {
          "researchQuestions": ["Is there market demand?", "Who is the target user?", "Who are the main competitors?", "What is the pricing strategy?"],
          "geography": "Global with focus on North America and Europe",
          "segments": "B2B SaaS, SMB to Enterprise",
          "timeframe": "Current market with 3-5 year projections"
        },
        "methodology": {
          "dataSources": ["Industry reports (Gartner, Forrester)", "Competitor analysis", "Market trend data", "User behavior patterns"],
          "timeWindow": "2023-2024 data",
          "limitations": "Based on publicly available data and AI analysis"
        },
        "marketOverview": {
          "definition": "Clear definition of the market category",
          "size": "$X billion",
          "sizeValue": 5000000000,
          "growthStage": "Growth/Mature/Emerging",
          "growthRate": "15% CAGR",
          "macroTrends": ["Macro trend 1 shaping the market", "Macro trend 2", "Macro trend 3"]
        },
        "targetAudience": {
          "description": "Overall target customer description",
          "segments": [
            {"name": "Segment 1", "size": "40%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"},
            {"name": "Segment 2", "size": "35%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"},
            {"name": "Segment 3", "size": "25%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"}
          ]
        },
        "demandAndBehavior": {
          "demandEvidence": ["Evidence 1: search trends", "Evidence 2: review volume", "Evidence 3: community activity"],
          "searchInterest": "Growing/Stable/Declining with X% change",
          "buyingJourney": "Typical customer journey description",
          "adoptionBarriers": ["Barrier 1", "Barrier 2", "Barrier 3"]
        },
        "competitorLandscape": [
          {"name": "Competitor 1", "offering": "Product description", "pricing": "$X/month", "marketShare": "35%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"},
          {"name": "Competitor 2", "offering": "Product description", "pricing": "$X/month", "marketShare": "25%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"},
          {"name": "Competitor 3", "offering": "Product description", "pricing": "$X/month", "marketShare": "15%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"}
        ],
        "pricingSnapshot": {
          "typicalRange": "$X - $Y per month",
          "models": ["Subscription", "Freemium", "Usage-based"],
          "priceSensitivity": "Description of price sensitivity in the market",
          "recommendedStrategy": "Recommended pricing approach"
        },
        "swotAnalysis": {
          "strengths": ["Strength 1", "Strength 2", "Strength 3"],
          "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
          "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
          "threats": ["Threat 1", "Threat 2", "Threat 3"]
        },
        "keyInsights": {
          "topPains": ["Pain 1 from reviews/research", "Pain 2", "Pain 3"],
          "desiredFeatures": ["Feature 1 users want", "Feature 2", "Feature 3"],
          "commonObjections": ["Objection 1", "Objection 2"],
          "trendingUp": ["Rising trend 1", "Rising trend 2"],
          "trendingDown": ["Declining pattern 1"],
          "surprisingFindings": ["Unexpected insight 1", "Unexpected insight 2"]
        },
        "validationChecklist": {
          "targetMarketClarity": {"status": "pass", "notes": "Clear target market identified"},
          "realProblem": {"status": "pass", "notes": "Evidence of genuine pain point"},
          "demandEvidence": {"status": "caution", "notes": "Moderate evidence of demand"},
          "competitionIntensity": {"status": "pass", "notes": "Manageable competition level"},
          "feasibleDifferentiation": {"status": "pass", "notes": "Clear differentiation possible"}
        },
        "feasibility": {
          "technical": "Technical feasibility assessment...",
          "technicalScore": 80,
          "financial": "Financial viability assessment...",
          "financialScore": 70,
          "estimatedCosts": {"development": 50000, "marketing": 25000, "operationsPerYear": 15000},
          "operational": "Operational requirements...",
          "operationalScore": 75,
          "timeToMarket": "6-12 months"
        },
        "keyMetrics": {
          "breakEvenMonths": 18,
          "projectedROI": "150%",
          "customerAcquisitionCost": 50,
          "lifetimeValue": 500
        },
        "recommendations": ["Strategic recommendation 1", "Strategic recommendation 2", "Strategic recommendation 3"]
      }
      
      Be realistic and professional. Use actual market data patterns for similar projects.
      All numeric values should be realistic estimates. Do not include markdown formatting in JSON values.
    `;

    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Business Analyst',
        taskType: 'analysis',
      },
      routingContext: { userId: req.user?.id },
      requestType: 'research',
      contextType: 'other',
    });

    let researchData;
    try {
      // Clean up potential markdown formatting in response
      const cleanJson = result.text.replace(/```json\n?|\n?```/g, '').trim();
      researchData = JSON.parse(cleanJson);
    } catch (parseError) {
      logger.warn(
        '[Research] Failed to parse JSON, returning structure with text content',
        parseError
      );
      // Fallback structure
      researchData = {
        executiveSummary: result.text.substring(0, 500) + '...',
        feasibility: {
          technical: 'Analysis included in full report.',
          financial: 'Analysis included in full report.',
          operational: 'Analysis included in full report.',
        },
        marketAnalysis: {
          targetAudience: 'Analysis included in full report.',
          marketSize: 'Analysis included in full report.',
          trends: [],
        },
        competitors: [],
        challenges: [],
      };
    }

    res.json({
      success: true,
      data: researchData,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Error generating research:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Failed to generate research',
      error: apiError.message,
    });
  }
});

router.post('/deep-research', async (req: AuthRequest, res, _next) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'query is required and must be a string',
      });
      return;
    }

    logger.info('[LLMRouter] Performing deep research using best practices...');

    // Build comprehensive research prompt (simplified - full version is very long)
    const researchPrompt = `You are a senior software architect and technical researcher with 20+ years of experience. Conduct thorough, evidence-based research on the provided project topic using online sources and deliver a comprehensive technical specification document.

Research Topic: ${query}

Follow a structured chain-of-thought research process:
1. Topic Decomposition & Analysis
2. Information Gathering & Validation (using online sources)
3. Critical Analysis & Evaluation
4. Synthesis & Recommendation

Provide comprehensive technical specifications covering:
- Core Features & Functionality
- Technical Architecture (including full-stack considerations)
- Backend Architecture Requirements (API design, server architecture, microservices vs monolith)
- Admin Console & Management Interfaces (if needed)
- Infrastructure Needs (deployment, containerization, CI/CD, monitoring, logging)
- Security & Compliance Requirements (authentication, authorization, data protection)
- Database Architecture (SQL/NoSQL selection, schema design, caching)
- API Design & Integrations (REST/GraphQL, external APIs, third-party services)
- Frontend Architecture (client-side architecture, state management, routing)
- DevOps & Deployment Strategy
- Testing Strategy (unit, integration, E2E, performance)
- Technical Requirements
- Implementation Details
- Best Practices & Industry Standards
- Recommendations & Next Steps

**IMPORTANT**: Consider the complete project scope, not just the frontend. Think about what backend services, admin panels, infrastructure, security measures, and other components are needed to create a production-ready, full-stack application.

Use clear, professional technical language. Include specific technologies with versions, concrete examples, measurable metrics, and industry standards. Structure content for easy scanning and implementation. This research will be used for subsequent full architecture analysis, so be thorough and comprehensive.`;

    const startTime = Date.now();

    // Use LLM router with internet search enabled for deep research
    const result = await llmRouter.executeWithFallback({
      prompt: researchPrompt,
      context: {
        agentRole: 'Research Agent',
        taskType: 'research',
      },
      routingContext: {
        userId: (req as any).user?.id,
      },
      requestType: 'deep-research',
      contextType: 'other',
      useInternet: true, // Enable internet search for comprehensive research
    });

    const latency = Date.now() - startTime;
    logger.info(`[LLMRouter] Deep research completed in ${latency}ms`);

    // Track usage
    try {
      await usageTracker.trackUsage({
        userId: (req as any).user?.userId,
        modelId: result.modelUsed,
        provider: result.provider,
        modelIdentifier: result.modelUsed,
        inputTokens: result.usage?.promptTokens || result.usage?.promptTokenCount || 0,
        outputTokens: result.usage?.candidatesTokens || result.usage?.candidatesTokenCount || 0,
        requestType: 'deep-research',
        success: true,
        latencyMs: latency,
      });
    } catch (trackError) {
      logger.error('Failed to track usage for deep-research:', trackError);
    }

    res.json({
      success: true,
      data: {
        research: result.text || '',
      },
      latency: latency,
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('[LLMRouter] Deep research failed:', apiError);
    res.status(apiError.statusCode).json({
      success: false,
      message: 'Failed to perform deep research',
      error: apiError.message,
    });
  }
});

/**
 * Full Project Architecture Analysis
 * Analyzes project requirements and identifies all necessary components for a complete project
 */
router.post(
  '/full-architecture-analysis',
  routeTimeout(120000),
  async (req: AuthRequest, res, _next) => {
    try {
      const { projectDescription, researchFindings, userRequirements, projectType } = req.body;

      if (!projectDescription || typeof projectDescription !== 'string') {
        res.status(400).json({
          success: false,
          message: 'projectDescription is required and must be a string',
        });
        return;
      }

      logger.info('[LLMRouter] Performing full project architecture analysis...');

      const { fullProjectArchitectureAnalyzer } =
        await import('../services/fullProjectArchitectureAnalyzer.service.js');

      const startTime = Date.now();

      const analysis = await fullProjectArchitectureAnalyzer.analyzeArchitecture({
        projectDescription,
        researchFindings,
        userRequirements,
        projectType,
      });

      const latency = Date.now() - startTime;
      logger.info(`[LLMRouter] Full architecture analysis completed in ${latency}ms`);

      res.json({
        success: true,
        data: {
          analysis,
        },
        latency: latency,
      });
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('[LLMRouter] Full architecture analysis failed:', apiError);
      res.status(apiError.statusCode).json({
        success: false,
        message: 'Failed to perform full architecture analysis',
        error: apiError.message,
      });
    }
  }
);

export default router;
