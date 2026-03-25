/**
 * LLM Router - Routes LLM requests to appropriate providers
 * Uses intelligent routing engine for automatic model selection
 */

import { geminiService } from '../gemini.service.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';
import { routingEngine, RoutingContext as RoutingContextType } from './RoutingEngine.js';
import { taskAnalyzer, TaskContext } from './TaskAnalyzer.js';
import { modelRegistry } from './models/ModelRegistry.js';
import { functionCallProcessor, LLMResponseWithFunctionCalls } from './FunctionCallProcessor.js';
import { usageTracker } from './UsageTracker.js';
import { responseCache } from './ResponseCache.js';
import { openAIService } from './providers/OpenAIService.js';
import { anthropicService } from './providers/AnthropicService.js';
import { deepSeekService } from './providers/DeepSeekService.js';
import { grokService } from './providers/GrokService.js';
import { mistralService } from './providers/MistralService.js';
import { qwenService } from './providers/QwenService.js';
import { openRouterService } from './providers/OpenRouterService.js';
import { groqService } from './providers/GroqService.js';
import { vertexService } from './providers/VertexService.js';
import { azureOpenAIService } from './providers/AzureOpenAIService.js';
import { OllamaService } from './providers/OllamaService.js';
import { VLLMService } from './providers/VLLMService.js';
import { OpenAICompatibleService } from './providers/OpenAICompatibleService.js';
import { apiKeyProvider } from '../apiKeyProvider.service.js';
import { UserSettings } from '../../models/UserSettings.model.js';
import { internalTaskRouter } from '../internalTaskRouter.service.js';
import { generationStatusService } from '../GenerationStatus.service.js';

import { llmCircuitBreaker } from './CircuitBreaker.js';
import { toApiError } from '../../errors/ApiError.js';

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  modelUsed: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'ollama' | 'vllm' | 'openai_compatible' | 'custom';
  fallbackUsed?: boolean;
  resources?: string[]; // URLs from Google Search grounding (when useInternet is enabled)
}

export interface LLMContext {
  agentRole?: string;
  taskType?: string;
  tools?: any[];
  systemInstruction?: string;
  model?: string;
  maxTokens?: number; // Limit response length for faster processing
  skipCache?: boolean; // Force fresh generation
  generationSessionId?: string; // For real-time status updates to Mission Control
  disableStreaming?: boolean;
}

export interface RoutingContext {
  userId?: string;
  projectId?: string;
  packageLimits?: {
    maxMonthlyBudget?: number;
    maxAPICalls?: number;
    maxTokensPerMonth?: number;
  };
  userPreferences?: {
    preferredModels?: string[];
    costPreference?: 'low' | 'balanced' | 'quality';
  };
  projectState?: {
    currentPhase: string;
    budgetUsed: number;
    tokensUsed: number;
  };
}

class LLMRouter {
  /**
   * Execute with intelligent routing - automatically selects best model based on task analysis
   */
  private rateLimitBackoff = new Map<string, { attempts: number; nextRetry: number }>();

  /**
   * Handle rate limit with exponential backoff
   * NOTE: Reduced retries and delays for faster fallback on provider failures
   */
  private async handleRateLimit(
    provider: string,
    modelId: string,
    error: unknown
  ): Promise<number> {
    const apiError = toApiError(error);
    const key = `${provider}:${modelId}`;
    const isRateLimit = apiError.statusCode === 429 ||
      apiError.message?.toLowerCase().includes('rate limit') ||
      (error as any)?.code === 'rate_limit_exceeded';

    if (!isRateLimit) {
      return 0; // No backoff needed
    }

    const backoff = this.rateLimitBackoff.get(key) || { attempts: 0, nextRetry: 0 };
    backoff.attempts++;

    // Reduced backoff: max 10s instead of 60s for faster fallback
    const delay = Math.min(10000, Math.pow(2, backoff.attempts - 1) * 500);
    backoff.nextRetry = Date.now() + delay;

    this.rateLimitBackoff.set(key, backoff);

    logger.warn(`Rate limit hit for ${provider}:${modelId}, backing off for ${delay}ms`);

    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, delay));

    return delay;
  }

  async executeWithFallback(params: {
    prompt: string;
    context: LLMContext;
    routingContext?: RoutingContext;
    requestType?: string;
    contextType?: 'wizard' | 'workspace' | 'other';
    useInternet?: boolean; // Enable internet search
    routerType?: 'end-user' | 'internal'; // Which router is handling this request
  }): Promise<LLMResponse> {
    const { prompt, context, routingContext, requestType = 'chat', contextType = 'other', routerType = 'end-user' } = params;
    const startTime = Date.now();

    // If model is explicitly specified, use it (backward compatibility)
    if (context.model) {
      return this.executeWithSpecificModel(prompt, context.model, {
        systemInstruction: context.systemInstruction,
        tools: context.tools
      }, true, routingContext, requestType, contextType, routerType);
    }

    // Use intelligent routing to select the best model
    try {
      // Analyze the task
      const taskContext: TaskContext = {
        agentRole: context.agentRole,
        tools: context.tools
      };

      const taskAnalysis = taskAnalyzer.analyzeTask(
        prompt,
        context.taskType as any,
        taskContext
      );

      // Build routing context
      const routingContextForEngine: RoutingContextType = {
        userId: routingContext?.userId,
        projectId: routingContext?.projectId,
        packageLimits: routingContext?.packageLimits,
        userPreferences: routingContext?.userPreferences,
        projectState: routingContext?.projectState
      };

      // Get user's API key preference
      const userId = routingContext?.userId;
      const apiKeyPreference = userId
        ? await apiKeyProvider.getUserApiKeyPreference(userId)
        : 'platform';

      // Select best model using routing engine (now async to load settings)
      const modelSelection = await routingEngine.selectModel(taskAnalysis, routingContextForEngine);
      let selectedModel = modelSelection.primaryModel;

      // For user-specific models, check user's local LLMs first
      if (userId) {
        const userActiveModels = modelRegistry.getActiveModelsForUser(userId);
        if (userActiveModels.length > 0) {
          // Prefer user's local models if available
          const userModel = userActiveModels.find(m =>
            m.provider === selectedModel.provider ||
            ['ollama', 'vllm', 'openai_compatible'].includes(m.provider)
          );
          if (userModel) {
            selectedModel = userModel;
            logger.info(`[LLMRouter] Using user's local model: ${selectedModel.name}`);
          }
        }
      }

      logger.info(`[LLMRouter] Intelligent routing selected: ${selectedModel.name} (${selectedModel.modelIdentifier}) for ${context.agentRole || 'unknown'} agent. Reasoning: ${modelSelection.reasoning}`);

      // Emit status update for Mission Control (if session is provided)
      if (context.generationSessionId) {
        generationStatusService.emitModelSelection(
          context.generationSessionId,
          selectedModel.name,
          selectedModel.provider,
          modelSelection.reasoning
        );
      }

      // Check cache first (skip for function calling tasks or if explicitly requested)
      const skipCache = (context.tools && context.tools.length > 0) || (context.skipCache === true);
      if (!skipCache) {
        const cached = responseCache.get(
          prompt,
          selectedModel.id,
          context.systemInstruction,
          { agentRole: context.agentRole, taskType: context.taskType }
        );

        if (cached) {
          logger.info(`[LLMRouter] Cache HIT - returning cached response (saved $${cached.cost.toFixed(6)})`);
          return {
            text: cached.response,
            usage: {
              promptTokens: cached.tokens.input,
              candidatesTokens: cached.tokens.output,
              totalTokens: cached.tokens.total
            },
            modelUsed: cached.modelId,
            provider: cached.provider as any,
            fallbackUsed: false
          };
        }
      }

      // Execute with selected model
      const config: any = {};
      if (context.systemInstruction) {
        config.systemInstruction = context.systemInstruction;
      }
      if (context.tools && Array.isArray(context.tools) && context.tools.length > 0) {
        config.tools = context.tools;
      }
      // Add maxTokens if specified (for faster responses)
      if (context.maxTokens) {
        config.maxTokens = context.maxTokens;
      }

      // Execute with rate limit handling
      let result: LLMResponse | LLMResponseWithFunctionCalls = null as any;
      let retries = 0;
      const maxRetries = 2; // Reduced from 3 for faster fallback

      while (retries <= maxRetries) {
        try {
          logger.info(`[LLMRouter] DEBUG: Calling executeWithProvider (attempt ${retries + 1})`);
          result = await this.executeWithProvider(
            prompt,
            selectedModel,
            {
              ...config,
              useInternet: params.useInternet
            },
            routingContext,
            requestType,
            contextType
          );
          logger.info(`[LLMRouter] DEBUG: executeWithProvider returned`);
          logger.info(`[LLMRouter] Provider execution successful. Response length: ${result.text?.length || 0}`);
          break; // Success, exit retry loop
          break; // Success, exit retry loop
        } catch (error: any) {
          const apiError = toApiError(error);
          logger.error(`[LLMRouter] Provider execution failed (attempt ${retries + 1}/${maxRetries + 1}):`, apiError);
          const backoffDelay = await this.handleRateLimit(
            selectedModel.provider,
            selectedModel.modelIdentifier,
            apiError
          );

          if (backoffDelay > 0 && retries < maxRetries) {
            retries++;
            logger.info(`[LLMRouter] Rate limit hit, retrying after ${backoffDelay}ms (attempt ${retries}/${maxRetries})`);
            continue;
          } else {
            throw error; // Re-throw if not rate limit or max retries reached
          }
        }
      }

      // Track usage
      const latencyMs = Date.now() - startTime;
      const inputTokens = result.usage?.promptTokens || (result.usage as any)?.promptTokenCount || 0;
      const outputTokens = result.usage?.candidatesTokens || (result.usage as any)?.candidatesTokenCount || 0;
      const totalTokens = inputTokens + outputTokens;

      // Calculate cost for caching
      const model = modelRegistry.getModel(selectedModel.id);
      const inputCost = model ? (inputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens : 0;
      const outputCost = model ? (outputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens : 0;
      const totalCost = inputCost + outputCost;

      // Cache the response (skip for function calling tasks)
      if (!skipCache && result.text) {
        responseCache.set(
          prompt,
          selectedModel.id,
          result.text,
          { input: inputTokens, output: outputTokens, total: totalTokens },
          totalCost,
          selectedModel.provider,
          context.systemInstruction,
          { agentRole: context.agentRole, taskType: context.taskType }
        );
      }

      usageTracker.trackUsage({
        userId: routingContext?.userId,
        projectId: routingContext?.projectId,
        modelId: selectedModel.id,
        provider: selectedModel.provider,
        modelIdentifier: selectedModel.modelIdentifier,
        inputTokens,
        outputTokens,
        requestType,
        agentRole: context.agentRole,
        taskType: context.taskType,
        context: contextType,
        routerType: routerType,
        success: true,
        latencyMs
      }).catch(err => {
        logger.warn(`[LLMRouter] Failed to track usage:`, err);
        // Don't throw - tracking failure shouldn't break the request
      });

      // Process function calls if any
      if ((result as any).functionCalls && (result as any).functionCalls.length > 0) {
        logger.info(`[LLMRouter] Processing ${result.functionCalls.length} function call(s)`);
        const processed = await functionCallProcessor.processWithFunctionCalls(
          result as LLMResponseWithFunctionCalls,
          prompt,
          config.tools || [],
          config.systemInstruction,
          context.agentRole,
          routingContext?.projectId,
          undefined // taskId not available here
        );

        return {
          text: processed.finalText,
          usage: processed.usage,
          modelUsed: processed.modelUsed,
          provider: processed.provider,
          fallbackUsed: false
        };
      }

      return {
        ...result,
        fallbackUsed: false
      };
    } catch (routingError: unknown) {
      const apiError = toApiError(routingError);
      logger.error(`[LLMRouter] Intelligent routing failed:`, apiError);

      // STRICT POLICY: No fallbacks for end-user requests
      if (routerType === 'end-user') {
        logger.warn('[LLMRouter] Fallback disabled for end-user request by strict policy - re-throwing error');
        throw routingError;
      }

      // Try to get fallback model from routing engine
      // Use DEFAULT_LLM_PROVIDER from config if available, otherwise prefer Gemini
      let fallbackModel: any = null;
      try {
        // Get any available active model as fallback
        const activeModels = modelRegistry.getActiveModels();
        if (activeModels.length > 0) {
          // Prefer DEFAULT_LLM_PROVIDER if available, otherwise prefer Gemini, otherwise use first available
          const defaultProvider = config.defaultLLMProvider || 'gemini';
          fallbackModel = activeModels.find(m => m.provider === defaultProvider) ||
            activeModels.find(m => m.provider === 'gemini') ||
            activeModels[0];
          logger.info(`[LLMRouter] Using fallback model from routing engine: ${fallbackModel.name} (${fallbackModel.modelIdentifier}) [preferred provider: ${defaultProvider}]`);
        }
      } catch (fallbackError) {
        logger.error(`[LLMRouter] Failed to get fallback model:`, fallbackError);
      }

      // Track failure
      const latencyMs = Date.now() - startTime;
      const fallbackModelId = fallbackModel?.modelIdentifier || 'unknown';
      const fallbackProvider = fallbackModel?.provider || 'unknown';

      usageTracker.trackUsage({
        userId: routingContext?.userId,
        projectId: routingContext?.projectId,
        modelId: fallbackModelId,
        provider: fallbackProvider,
        modelIdentifier: fallbackModelId,
        inputTokens: Math.ceil(prompt.length / 4), // Rough estimate
        outputTokens: 0,
        requestType,
        agentRole: context.agentRole,
        taskType: context.taskType,
        context: contextType,
        routerType: routerType,
        success: false,
        errorMessage: apiError.message,
        latencyMs
      }).catch(err => {
        logger.warn(`[LLMRouter] Failed to track usage error:`, err);
      });

      // Use fallback model from routing engine if available, otherwise throw error
      if (fallbackModel) {
        logger.warn(`[LLMRouter] Routing failed, using fallback model: ${fallbackModel.modelIdentifier}`);
        return this.executeWithSpecificModel(prompt, fallbackModel.modelIdentifier, {
          systemInstruction: context.systemInstruction,
          tools: context.tools,
          useInternet: params.useInternet
        }, false, routingContext, requestType, contextType, routerType); // Don't allow further fallback
      }

      // If no fallback available, throw error - routing must work
      throw new Error(`LLM routing failed and no fallback model available: ${apiError.message}`);
    }
  }

  /**
   * Execute with streaming support - returns async generator for streaming responses
   */
  async *executeWithFallbackStream(params: {
    prompt: string;
    context: LLMContext;
    routingContext?: RoutingContext;
    requestType?: string;
    contextType?: 'wizard' | 'workspace' | 'other';
    useInternet?: boolean;
    routerType?: 'end-user' | 'internal';
  }): AsyncGenerator<string, void, unknown> {
    const { prompt, context, routingContext, requestType = 'chat', contextType = 'other', routerType = 'end-user' } = params;

    try {
      // Analyze the task
      const taskContext: TaskContext = {
        agentRole: context.agentRole,
        tools: context.tools
      };

      const taskAnalysis = taskAnalyzer.analyzeTask(
        prompt,
        context.taskType as any,
        taskContext
      );

      // Build routing context
      const routingContextForEngine: RoutingContextType = {
        userId: routingContext?.userId,
        projectId: routingContext?.projectId,
        packageLimits: routingContext?.packageLimits,
        userPreferences: routingContext?.userPreferences,
        projectState: routingContext?.projectState
      };

      // Get user's API key preference
      const userId = routingContext?.userId;
      const apiKeyPreference = userId
        ? await apiKeyProvider.getUserApiKeyPreference(userId)
        : 'platform';

      // Select best model using routing engine
      const modelSelection = await routingEngine.selectModel(taskAnalysis, routingContextForEngine);
      let selectedModel = modelSelection.primaryModel;

      // For user-specific models, check user's local LLMs first
      if (userId) {
        const userActiveModels = modelRegistry.getActiveModelsForUser(userId);
        if (userActiveModels.length > 0) {
          const userModel = userActiveModels.find(m =>
            m.provider === selectedModel.provider ||
            ['ollama', 'vllm', 'openai_compatible'].includes(m.provider)
          );
          if (userModel) {
            selectedModel = userModel;
            logger.info(`[LLMRouter] Using user's local model for streaming: ${selectedModel.name}`);
          }
        }
      }

      logger.info(`[LLMRouter] Streaming with: ${selectedModel.name} (${selectedModel.modelIdentifier})`);

      // Execute streaming with selected provider
      const config: any = {};
      if (context.systemInstruction) {
        config.systemInstruction = context.systemInstruction;
      }
      if (context.tools && Array.isArray(context.tools) && context.tools.length > 0) {
        config.tools = context.tools;
      }
      if (context.maxTokens) {
        config.maxTokens = context.maxTokens;
      }
      if (params.useInternet !== undefined) {
        config.useInternet = params.useInternet;
      }

      // Stream from provider
      const provider = selectedModel.provider;
      const modelIdentifier = selectedModel.modelIdentifier;

      if (provider === 'gemini') {
        const stream = geminiService.generateContentStream(prompt, modelIdentifier, config);
        for await (const chunk of stream) {
          yield chunk;
        }
      } else if (provider === 'openai') {
        const stream = openAIService.generateContentStream(prompt, modelIdentifier, {
          systemInstruction: config.systemInstruction,
          temperature: 0.7,
          maxTokens: config.maxTokens,
          tools: config.tools
        });
        for await (const chunk of stream) {
          yield chunk;
        }
      } else {
        // For other providers, fallback to non-streaming and yield full response
        // This is a limitation - not all providers support streaming yet
        logger.warn(`[LLMRouter] Provider ${provider} doesn't support streaming, using non-streaming fallback`);
        const result = await this.executeWithProvider(
          prompt,
          selectedModel,
          config,
          routingContext,
          requestType,
          contextType
        );
        // Yield the full response as a single chunk
        yield result.text;
      }
    } catch (error: any) {
      const apiError = toApiError(error);
      logger.error(`[LLMRouter] Streaming failed:`, apiError);

      // STRICT POLICY: No fallbacks for end-user requests
      if (routerType === 'end-user') {
        logger.warn('[LLMRouter] Streaming fallback disabled for end-user request by strict policy - re-throwing error');
        throw error;
      }

      // Try fallback model
      const activeModels = modelRegistry.getActiveModels();
      if (activeModels.length > 0) {
        const fallbackModel = activeModels.find(m => m.provider === 'gemini') || activeModels[0];
        logger.warn(`[LLMRouter] Streaming failed, trying fallback: ${fallbackModel.modelIdentifier}`);
        try {
          const config: any = {
            systemInstruction: context.systemInstruction,
            useInternet: params.useInternet
          };
          const stream = geminiService.generateContentStream(prompt, fallbackModel.modelIdentifier, config);
          for await (const chunk of stream) {
            yield chunk;
          }
        } catch (fallbackError: unknown) {
          const fbApiError = toApiError(fallbackError);
          throw new Error(`Streaming failed with fallback: ${fbApiError.message}`);
        }
      } else {
        throw new Error(`Streaming failed: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Execute with a specific provider based on model capabilities
   */
  private async executeWithProvider(
    prompt: string,
    model: any, // ModelCapabilities
    config?: {
      systemInstruction?: string;
      tools?: any[];
      useInternet?: boolean; // Enable internet search
      skipCache?: boolean;
    },
    routingContext?: RoutingContext,
    requestType: string = 'chat',
    contextType: 'wizard' | 'workspace' | 'other' = 'other'
  ): Promise<LLMResponse | LLMResponseWithFunctionCalls> {
    const provider = model.provider;
    const modelIdentifier = model.modelIdentifier;

    // Check if circuit breaker is open for this provider
    const circuitState = llmCircuitBreaker.getState(provider);
    if (circuitState === 'OPEN') {
      logger.warn(`[LLMRouter] Circuit breaker OPEN for ${provider}, skipping provider`);
      throw new Error(`Provider ${provider} is temporarily unavailable (circuit breaker open)`);
    }

    try {
      if (provider === 'gemini') {
        const serviceConfig: any = {};
        if (config?.systemInstruction) {
          serviceConfig.systemInstruction = config.systemInstruction;
        }
        if (config?.tools && Array.isArray(config.tools) && config.tools.length > 0) {
          serviceConfig.tools = config.tools;
        }
        if (config?.useInternet !== undefined) {
          serviceConfig.useInternet = config.useInternet;
        }

        logger.info(`[LLMRouter] DEBUG: Calling geminiService.generateContent`);
        const result = await geminiService.generateContent(prompt, modelIdentifier, serviceConfig);
        logger.info(`[LLMRouter] DEBUG: geminiService.generateContent returned`);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage?.promptTokens || (result.usage as any)?.promptTokenCount || 0,
            candidatesTokens: result.usage?.candidatesTokens || (result.usage as any)?.candidatesTokenCount || 0,
            totalTokens: result.usage?.totalTokens || 0
          },
          modelUsed: modelIdentifier,
          provider: 'gemini',
          fallbackUsed: false,
          resources: result.resources || [] // Include URLs from Google Search grounding
        };

        // Add function calls if present
        if (result.functionCalls && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls.map(fc => ({
            name: fc.name,
            args: fc.args
          }));
        }

        // Record success in circuit breaker
        llmCircuitBreaker.recordSuccess('gemini');
        return response;
      } else if (provider === 'openai') {
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7,
          tools: config?.tools // Pass tools for native function calling
        };

        const result = await openAIService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'openai',
          fallbackUsed: false
        };

        // Add function calls if present (from native OpenAI function calling or text extraction)
        if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls;
        } else {
          // Fallback: Extract function calls from text
          const functionCalls = this.extractFunctionCallsFromText(result.text);
          if (functionCalls.length > 0) {
            (response as LLMResponseWithFunctionCalls).functionCalls = functionCalls;
          }
        }

        return response;
      } else if (provider === 'anthropic') {
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7
        };

        const result = await anthropicService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'anthropic',
          fallbackUsed: false
        };

        // Extract function calls from Anthropic response (text-based for now)
        const functionCalls = this.extractFunctionCallsFromText(result.text);
        if (functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = functionCalls;
        }

        return response;
      } else if (provider === 'deepseek') {
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7
        };

        const result = await deepSeekService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'deepseek',
          fallbackUsed: false
        };

        // Extract function calls from DeepSeek response (text-based for now)
        const functionCalls = this.extractFunctionCallsFromText(result.text);
        if (functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = functionCalls;
        }

        return response;
      } else if (provider === 'grok') {
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7
        };

        const result = await grokService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'grok',
          fallbackUsed: false
        };

        // Extract function calls from Grok response (text-based for now)
        const functionCalls = this.extractFunctionCallsFromText(result.text);
        if (functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = functionCalls;
        }

        return response;
      } else if (provider === 'mistral') {
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7,
          tools: config?.tools // Pass tools for native function calling
        };

        const result = await mistralService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'mistral',
          fallbackUsed: false
        };

        // Add function calls if present
        if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls.map(fc => ({
            name: (fc as any).function?.name || fc.name,
            args: (fc as any).function?.arguments ? JSON.parse((fc as any).function.arguments) : fc.args || {}
          }));
        } else {
          // Fallback: Extract function calls from text
          const functionCalls = this.extractFunctionCallsFromText(result.text);
          if (functionCalls.length > 0) {
            (response as LLMResponseWithFunctionCalls).functionCalls = functionCalls;
          }
        }

        return response;
      } else if (provider === 'qwen') {
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7
        };

        const result = await qwenService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'qwen',
          fallbackUsed: false
        };

        // Extract function calls from Qwen response (text-based for now)
        const functionCalls = this.extractFunctionCallsFromText(result.text);
        if (functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = functionCalls;
        }

        return response;
      } else if (provider === 'vertex') {
        // Convert prompt to messages format for Vertex AI
        const messages = config?.systemInstruction
          ? [{ role: 'system', content: config.systemInstruction }, { role: 'user', content: prompt }]
          : [{ role: 'user', content: prompt }];

        const result = await vertexService.generateContent(modelIdentifier, messages, {
          temperature: 0.7,
          tools: config?.tools,
          useInternet: config?.useInternet
        });

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage?.promptTokens || 0,
            candidatesTokens: result.usage?.completionTokens || 0,
            totalTokens: result.usage?.totalTokens || 0
          },
          modelUsed: modelIdentifier,
          provider: 'vertex',
          fallbackUsed: false
        };

        // Add function calls if present
        if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls.map(fc => ({
            name: fc.name,
            args: fc.args || {}
          }));
        }

        return response;
      } else if (provider === 'azure') {
        // Convert prompt to messages format for Azure OpenAI
        const messages = config?.systemInstruction
          ? [{ role: 'system', content: config.systemInstruction }, { role: 'user', content: prompt }]
          : [{ role: 'user', content: prompt }];

        const result = await azureOpenAIService.generateContent(modelIdentifier, messages, {
          temperature: 0.7,
          tools: config?.tools
        });

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage?.promptTokens || 0,
            candidatesTokens: result.usage?.completionTokens || 0,
            totalTokens: result.usage?.totalTokens || 0
          },
          modelUsed: modelIdentifier,
          provider: 'azure',
          fallbackUsed: false
        };

        // Add function calls if present
        if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls.map(fc => ({
            name: fc.name,
            args: fc.args || {}
          }));
        }

        return response;
      } else if (provider === 'openrouter') {
        // Convert prompt to messages format for OpenRouter
        const messages = config?.systemInstruction
          ? [{ role: 'system', content: config.systemInstruction }, { role: 'user', content: prompt }]
          : [{ role: 'user', content: prompt }];

        const result = await openRouterService.generateContent(modelIdentifier, messages, {
          temperature: 0.7,
          tools: config?.tools
        });

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage?.promptTokens || 0,
            candidatesTokens: result.usage?.completionTokens || 0,
            totalTokens: result.usage?.totalTokens || 0
          },
          modelUsed: modelIdentifier,
          provider: 'openrouter',
          fallbackUsed: false
        };

        // Add function calls if present
        if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls.map(fc => ({
            name: fc.name,
            args: fc.args || {}
          }));
        }

        return response;
      } else if (provider === 'groq') {
        // Convert prompt to messages format for Groq
        const messages = config?.systemInstruction
          ? [{ role: 'system', content: config.systemInstruction }, { role: 'user', content: prompt }]
          : [{ role: 'user', content: prompt }];

        const result = await groqService.generateContent(modelIdentifier, messages, {
          temperature: 0.7,
          tools: config?.tools
        });

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage?.promptTokens || 0,
            candidatesTokens: result.usage?.completionTokens || 0,
            totalTokens: result.usage?.totalTokens || 0
          },
          modelUsed: modelIdentifier,
          provider: 'groq',
          fallbackUsed: false
        };

        // Add function calls if present
        if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls.map(fc => ({
            name: fc.name,
            args: fc.args || {}
          }));
        }

        return response;
      } else if (provider === 'ollama') {
        // Get base URL from model metadata or user settings
        const userId = routingContext?.userId;
        const baseUrl = (model as any).baseUrl || modelRegistry.getLocalModelBaseUrl(userId || '', model.id) || 'http://localhost:11434';

        const ollamaService = new OllamaService(baseUrl);
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7
        };

        const result = await ollamaService.generateContent(prompt, modelIdentifier, serviceConfig);

        return {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'ollama',
          fallbackUsed: false
        };
      } else if (provider === 'vllm') {
        // Get base URL and API key from model metadata or user settings
        const userId = routingContext?.userId;
        const baseUrl = (model as any).baseUrl || modelRegistry.getLocalModelBaseUrl(userId || '', model.id) || 'http://localhost:8000';

        // Try to get API key (vLLM may or may not require one)
        let apiKey: string | undefined;
        if (userId) {
          const keyResult = await apiKeyProvider.getApiKeyForRequest(userId, 'vllm', 'user_then_platform');
          apiKey = keyResult.apiKey || undefined;
        }

        const vllmService = new VLLMService(baseUrl, apiKey);
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7,
          tools: config?.tools
        };

        const result = await vllmService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'vllm',
          fallbackUsed: false
        };

        if (result.functionCalls && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls;
        }

        return response;
      } else if (provider === 'openai_compatible') {
        // Get base URL and API key from model metadata or user settings
        const userId = routingContext?.userId;
        const baseUrl = (model as any).baseUrl || modelRegistry.getLocalModelBaseUrl(userId || '', model.id) || 'http://localhost:8000';

        // Try to get API key (OpenAI-compatible may or may not require one)
        let apiKey: string | undefined;
        if (userId) {
          const keyResult = await apiKeyProvider.getApiKeyForRequest(userId, 'openai_compatible', 'user_then_platform');
          apiKey = keyResult.apiKey || undefined;
        }

        const openAIService = new OpenAICompatibleService(baseUrl, apiKey);
        const serviceConfig: any = {
          systemInstruction: config?.systemInstruction,
          temperature: 0.7,
          tools: config?.tools
        };

        const result = await openAIService.generateContent(prompt, modelIdentifier, serviceConfig);

        const response: LLMResponse | LLMResponseWithFunctionCalls = {
          text: result.text || '',
          usage: {
            promptTokens: result.usage.promptTokens,
            candidatesTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens
          },
          modelUsed: modelIdentifier,
          provider: 'openai_compatible',
          fallbackUsed: false
        };

        if (result.functionCalls && result.functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls;
        }

        return response;
      } else {
        logger.warn(`[LLMRouter] Unknown provider ${provider}, falling back to Gemini`);
        throw new Error(`Provider ${provider} not supported`);
      }

      // This point should not be reached, but TypeScript needs it
      throw new Error('Unexpected code path in executeWithProvider');
    } catch (error: any) {
      // Record failure in circuit breaker
      llmCircuitBreaker.recordFailure(provider);

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[LLMRouter] Provider ${provider} execution failed (circuit breaker notified):`, errorMessage);
      throw error;
    }
  }

  /**
   * Execute with specific model - no fallback
   */
  async executeWithSpecificModel(
    prompt: string,
    modelId: string,
    config?: {
      systemInstruction?: string;
      tools?: any[];
      useInternet?: boolean; // Enable internet search
    },
    allowFallback: boolean = false,
    routingContext?: RoutingContext,
    requestType: string = 'chat',
    contextType: 'wizard' | 'workspace' | 'other' = 'other',
    routerType: string = 'specific'
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      logger.info(`[LLMRouter] Executing with specific model: ${modelId}`);

      // Skip cache for test requests to ensure API keys are actually validated
      const isTestRequest = requestType === 'test';

      const serviceConfig: any = {};
      if (config?.systemInstruction) {
        serviceConfig.systemInstruction = config.systemInstruction;
      }
      if (config?.tools && Array.isArray(config.tools) && config.tools.length > 0) {
        serviceConfig.tools = config.tools;
      }

      // Check cache only if NOT a test request (tests should always hit the API)
      if (!isTestRequest) {
        const skipCache = config?.tools && Array.isArray(config.tools) && config.tools.length > 0;
        if (!skipCache) {
          const cached = responseCache.get(
            prompt,
            modelId,
            config?.systemInstruction,
            { requestType, contextType }
          );

          if (cached) {
            logger.info(`[LLMRouter] Cache HIT - returning cached response (saved $${cached.cost.toFixed(6)})`);
            return {
              text: cached.response,
              usage: {
                promptTokens: cached.tokens.input,
                candidatesTokens: cached.tokens.output,
                totalTokens: cached.tokens.total
              },
              modelUsed: cached.modelId,
              provider: cached.provider as any,
              fallbackUsed: false
            };
          }
        }
      }

      // Try to determine provider from model ID (default to Gemini)
      let provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'custom' = 'gemini';
      if (modelId.includes('gpt-') || modelId.includes('o1-')) {
        provider = 'openai';
      } else if (modelId.includes('claude-')) {
        provider = 'anthropic';
      } else if (modelId.includes('deepseek')) {
        provider = 'deepseek';
      } else if (modelId.includes('grok')) {
        provider = 'grok';
      } else if (modelId.includes('mistral') || modelId.includes('magistral') || modelId.includes('devstral')) {
        provider = 'mistral';
      } else if (modelId.includes('qwen')) {
        provider = 'qwen';
      } else if (modelId.startsWith('vertex:') || modelId.startsWith('vertex-') || (modelId.includes('vertex') && modelId.includes('gemini'))) {
        provider = 'vertex';
      } else if (modelId.startsWith('azure:') || modelId.startsWith('azure-') || modelId.includes('azure')) {
        provider = 'azure';
      } else if (modelId.startsWith('openrouter:') || modelId.includes('/')) {
        provider = 'openrouter';
      } else if (modelId.startsWith('groq:') || modelId.includes('groq')) {
        provider = 'groq';
      } else if (modelId.startsWith('vertex:') || modelId.startsWith('vertex-')) {
        provider = 'vertex';
      } else if (modelId.startsWith('azure:') || modelId.startsWith('azure-')) {
        provider = 'azure';
      }

      let result: any;
      let finalProvider = provider;

      if (provider === 'gemini') {
        if (config?.useInternet !== undefined) {
          serviceConfig.useInternet = config.useInternet;
        }
        result = await geminiService.generateContent(prompt, modelId, serviceConfig);
      } else if (provider === 'openai') {
        const openAIConfig: any = {
          systemInstruction: serviceConfig.systemInstruction,
          temperature: 0.7
        };
        result = await openAIService.generateContent(prompt, modelId, openAIConfig);
      } else if (provider === 'anthropic') {
        const anthropicConfig: any = {
          systemInstruction: serviceConfig.systemInstruction,
          temperature: 0.7
        };
        result = await anthropicService.generateContent(prompt, modelId, anthropicConfig);
      } else if (provider === 'deepseek') {
        const deepSeekConfig: any = {
          systemInstruction: serviceConfig.systemInstruction,
          temperature: 0.7
        };
        result = await deepSeekService.generateContent(prompt, modelId, deepSeekConfig);
      } else if (provider === 'grok') {
        const grokConfig: any = {
          systemInstruction: serviceConfig.systemInstruction,
          temperature: 0.7
        };
        result = await grokService.generateContent(prompt, modelId, grokConfig);
        finalProvider = 'grok';
      } else if (provider === 'mistral') {
        const mistralConfig: any = {
          systemInstruction: serviceConfig.systemInstruction,
          temperature: 0.7,
          tools: serviceConfig.tools
        };
        result = await mistralService.generateContent(prompt, modelId, mistralConfig);
        finalProvider = 'mistral';
      } else if (provider === 'qwen') {
        const qwenConfig: any = {
          systemInstruction: serviceConfig.systemInstruction,
          temperature: 0.7
        };
        result = await qwenService.generateContent(prompt, modelId, qwenConfig);
        finalProvider = 'qwen';
      } else if (provider === 'openrouter') {
        // Convert prompt to messages format
        const messages = [{ role: 'user', content: prompt }];
        result = await openRouterService.generateContent(modelId, messages, {
          temperature: 0.7,
          tools: serviceConfig.tools
        });
        finalProvider = 'openrouter';
      } else if (provider === 'groq') {
        // Convert prompt to messages format
        const messages = [{ role: 'user', content: prompt }];
        result = await groqService.generateContent(modelId, messages, {
          temperature: 0.7,
          tools: serviceConfig.tools
        });
        finalProvider = 'groq';
      } else if (provider === 'vertex') {
        // Convert prompt to messages format
        const messages = [{ role: 'user', content: prompt }];
        result = await vertexService.generateContent(modelId, messages, {
          temperature: 0.7,
          tools: serviceConfig.tools,
          useInternet: config?.useInternet
        });
        finalProvider = 'vertex';
      } else if (provider === 'azure') {
        // Convert prompt to messages format
        const messages = [{ role: 'user', content: prompt }];
        result = await azureOpenAIService.generateContent(modelId, messages, {
          temperature: 0.7,
          tools: serviceConfig.tools
        });
        finalProvider = 'azure';
      } else {
        throw new Error(`Provider ${provider} not supported`);
      }

      // Track usage
      const latencyMs = Date.now() - startTime;
      const inputTokens = result.usage?.promptTokens || result.usage?.promptTokenCount || result.usage?.promptTokens || 0;
      const outputTokens = result.usage?.candidatesTokens || result.usage?.candidatesTokenCount || result.usage?.completionTokens || 0;
      const totalTokens = result.usage?.totalTokens || (inputTokens + outputTokens);

      usageTracker.trackUsage({
        userId: routingContext?.userId,
        projectId: routingContext?.projectId,
        modelId,
        provider: finalProvider,
        modelIdentifier: modelId,
        inputTokens,
        outputTokens,
        requestType,
        context: contextType,
        routerType: routerType,
        success: true,
        latencyMs
      }).catch(err => {
        logger.warn(`[LLMRouter] Failed to track usage:`, err);
      });

      const response: LLMResponse = {
        text: result.text || '',
        usage: {
          promptTokens: inputTokens,
          candidatesTokens: outputTokens,
          totalTokens
        },
        modelUsed: modelId,
        provider: finalProvider,
        fallbackUsed: false,
        resources: (result as any).resources || [] // Include URLs from Google Search grounding (Gemini only)
      };

      // Don't cache test requests - they should always hit the API to verify keys
      if (!isTestRequest && result.text) {
        const skipCacheForTools = config?.tools && Array.isArray(config.tools) && config.tools.length > 0;
        if (!skipCacheForTools) {
          const model = modelRegistry.getModel(modelId);
          const inputCost = model ? (inputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens : 0;
          const outputCost = model ? (outputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens : 0;
          const totalCost = inputCost + outputCost;

          responseCache.set(
            prompt,
            modelId,
            result.text,
            { input: inputTokens, output: outputTokens, total: totalTokens },
            totalCost,
            finalProvider,
            config?.systemInstruction,
            { requestType, contextType }
          );
        }
      }

      // Add function calls if present
      // Check for native function calls (Gemini, OpenAI)
      if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
        (response as LLMResponseWithFunctionCalls).functionCalls = result.functionCalls.map((fc: any) => ({
          name: fc.name,
          args: fc.args || {}
        }));
      } else if (finalProvider !== 'gemini') {
        // For other providers, extract function calls from text as fallback
        const functionCalls = this.extractFunctionCallsFromText(result.text);
        if (functionCalls.length > 0) {
          (response as LLMResponseWithFunctionCalls).functionCalls = functionCalls;
        }
      }

      return response;
    } catch (error: any) {
      // Track failure
      const latencyMs = Date.now() - startTime;
      usageTracker.trackUsage({
        userId: routingContext?.userId,
        projectId: routingContext?.projectId,
        modelId,
        provider: 'gemini', // Default provider
        modelIdentifier: modelId,
        inputTokens: Math.ceil(prompt.length / 4), // Rough estimate
        outputTokens: 0,
        requestType,
        context: contextType,
        routerType: routerType,
        success: false,
        errorMessage: error.message,
        latencyMs
      }).catch(err => {
        logger.warn(`[LLMRouter] Failed to track usage error:`, err);
      });

      if (allowFallback) {
        logger.warn(`[LLMRouter] Specific model failed, trying intelligent routing fallback:`, error);
        return this.executeWithFallback({
          prompt,
          context: {
            systemInstruction: config?.systemInstruction,
            tools: config?.tools
          },
          routingContext,
          requestType,
          contextType
        });
      }
      throw error;
    }
  }

  /**
   * Execute with internal routing - uses user-configured routing engine
   * Respects routing rules configured in Admin Console
   * Falls back to intelligent routing if no rules match
   */
  async executeInternalTask(params: {
    prompt: string;
    taskType?: string;
    agentRole?: string;
    requiredCapabilities?: string[];
    isUserFacing?: boolean;
    isCritical?: boolean;
    context?: 'internal' | 'system' | 'background';
    config?: {
      systemInstruction?: string;
      tools?: any[];
      skipCache?: boolean;
    };
  }): Promise<LLMResponse> {
    try {
      // Use intelligent routing that respects user-configured rules from Admin Console
      // This ensures internal tasks use the same routing rules as user-facing tasks
      logger.info(`[LLMRouter] Internal task using user-configured routing for: ${params.taskType || 'internal'}`);

      // Use executeWithFallback which respects user's routing rules
      // The routing engine will use user-configured rules based on task type
      return await this.executeWithFallback({
        prompt: params.prompt,
        context: {
          systemInstruction: params.config?.systemInstruction,
          tools: params.config?.tools
        },
        routingContext: {},
        requestType: params.taskType || 'internal',
        contextType: 'other',
        routerType: 'internal'
      });
    } catch (error: any) {
      logger.error(`[LLMRouter] Internal task execution failed:`, error);

      // Fallback to economy model on failure (gemini-2.5-flash is always available)
      const fallbackModel = modelRegistry.getModel('gemini-2.5-flash') ||
        modelRegistry.getActiveModels()[0];

      if (fallbackModel) {
        logger.warn(`[LLMRouter] Using fallback model: ${fallbackModel.modelIdentifier}`);
        return this.executeWithSpecificModel(
          params.prompt,
          fallbackModel.modelIdentifier,
          params.config,
          false,
          undefined,
          params.taskType || 'internal',
          'other'
        );
      }

      throw error;
    }
  }

  /**
   * Extract function calls from text (helper method)
   */
  private extractFunctionCallsFromText(text: string): Array<{ name: string; args: Record<string, any> }> {
    const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];

    // Look for JSON function call patterns in text
    // Pattern 1: create_mcp_server({...})
    const jsonPattern = /create_mcp_server\s*\(\s*(\{[\s\S]*?\})\s*\)/gi;
    let match;
    while ((match = jsonPattern.exec(text)) !== null) {
      try {
        const args = JSON.parse(match[1]);
        functionCalls.push({
          name: 'create_mcp_server',
          args
        });
      } catch (e) {
        // Try to extract key-value pairs if JSON parsing fails
        logger.debug('JSON parsing failed, trying alternative extraction');
      }
    }

    // Pattern 2: Look for structured function call blocks
    const blockPattern = /```(?:json|function_call)?\s*\{[\s\S]*?"name"\s*:\s*"create_mcp_server"[\s\S]*?\}\s*```/gi;
    while ((match = blockPattern.exec(text)) !== null) {
      try {
        const jsonMatch = match[0].match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.name === 'create_mcp_server' && parsed.args) {
            functionCalls.push({
              name: 'create_mcp_server',
              args: parsed.args
            });
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return functionCalls;
  }
}

export const llmRouter = new LLMRouter();
