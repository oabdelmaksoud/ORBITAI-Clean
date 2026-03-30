import { GoogleGenAI, Schema } from '@google/genai';
import { modelRegistry } from './llm/models/ModelRegistry.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { internalTaskRouter } from './internalTaskRouter.service.js';
import { logger } from '../utils/logger.js';

// Create a function to get the API key (database first, then env fallback)
async function getGeminiApiKey(): Promise<string> {
  // First, try to get from database
  const dbKey = await apiKeyProvider.getApiKey('gemini');
  if (dbKey) {
    return dbKey;
  }
  // Fallback to environment variable
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim() !== '') {
    return envKey;
  }
  throw new Error('Gemini API key not configured. Please add it via Admin Console → Settings → API Keys');
}

// Create AI instance dynamically with current API key
// Always create a new instance to ensure we use the latest API key from database
async function getAIInstance(): Promise<GoogleGenAI> {
  const apiKey = await getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
}

export interface GeminiResponse {
  text: string;
  functionCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  resources?: string[]; // URLs from Google Search grounding
  groundingMetadata?: any; // Raw grounding metadata for debugging
}

// Check if model supports function calling using ModelRegistry
function modelSupportsFunctionCalling(model: string): boolean {
  const modelInfo = modelRegistry.getModel(model);
  if (modelInfo) {
    return modelInfo.capabilities.functionCalling === true;
  }
  // Fallback: check if it's a known function-calling model
  // Note: gemini-1.5-flash-exp is not available - removed from check
  return model.includes('gemini-2.0') || model.includes('gemini-3-pro') || model.includes('gemini-3-flash') || model.includes('gemini-2.5-pro') || model.includes('gemini-1.5-pro');
}

// Get best function-calling model from registry
// Prioritizes confirmed working models over experimental ones
function getBestFunctionCallingModel(): string {
  const models = modelRegistry.getActiveModels();

  // Filter for function-calling Gemini models
  const functionCallingModels = models
    .filter(m => m.capabilities.functionCalling === true && m.provider === 'gemini' && m.isEnabled);

  if (functionCallingModels.length === 0) {
    // No enabled function-calling models, use confirmed working model
    return 'gemini-3-pro-preview';
  }

  // Prefer confirmed models over experimental ones
  // gemini-3-pro-preview is confirmed to exist and work
  const confirmedModel = functionCallingModels.find(m =>
    m.modelIdentifier === 'gemini-3-pro-preview' ||
    m.modelIdentifier.includes('gemini-3-pro')
  );

  if (confirmedModel) {
    return confirmedModel.modelIdentifier;
  }

  // If no confirmed model, sort by latency and return fastest
  const sorted = functionCallingModels.sort((a, b) => a.performance.avgLatencyMs - b.performance.avgLatencyMs);
  return sorted[0].modelIdentifier;
}

export class GeminiService {
  async generateContent(
    prompt: string,
    model: string = 'gemini-2.5-flash',
    config?: {
      systemInstruction?: string;
      tools?: any[];
      responseSchema?: Schema;
      responseMimeType?: string;
      useInternet?: boolean; // Enable Google Search grounding
      temperature?: number; // Temperature for response variability (0.0-2.0, default ~1.0)
    }
  ): Promise<GeminiResponse> {
    try {
      let finalModel = model;

      // CRITICAL: For gemini-2.5-flash, NEVER accept tools - it doesn't support function calling
      // If tools are passed, completely ignore them for this model
      // const isFlashModel = model.includes('2.5-flash'); // Removed unused variable

      // Normalize tools - ensure it's either undefined or a non-empty array with valid tools
      let toolsArray: any[] | undefined = undefined;

      // Only process tools if they exist
      if (config?.tools && Array.isArray(config.tools) && config.tools.length > 0) {
        // Filter out empty or invalid tool objects
        toolsArray = config.tools.filter((tool: any) => {
          if (!tool || typeof tool !== 'object') return false;

          // Check if tool has valid content
          const hasGoogleSearch = tool.googleSearch !== undefined;
          // const hasFunctionDeclarations = tool.functionDeclarations !== undefined; // Removed unused variable
          const hasValidFunctionDeclarations = Array.isArray(tool.functionDeclarations) && tool.functionDeclarations.length > 0;

          // Only keep tools that have actual content
          return hasGoogleSearch || hasValidFunctionDeclarations;
        });

        // If all tools were filtered out, set to undefined
        if (!toolsArray || toolsArray.length === 0) {
          toolsArray = undefined;
        }
      }

      // REMOVED: Early stripping of tools for flash models to allow upgrade logic to work
      // if (isFlashModel) { ... }

      const hasTools = toolsArray && toolsArray.length > 0;

      // Check if any tool requires function calling (googleSearch, functionDeclarations, etc.)
      const requiresFunctionCalling = hasTools && (
        toolsArray!.some((tool: any) =>
          tool && typeof tool === 'object' && (
            tool.googleSearch !== undefined ||
            (Array.isArray(tool.functionDeclarations) && tool.functionDeclarations.length > 0)
          )
        )
      );

      if (requiresFunctionCalling && !modelSupportsFunctionCalling(model)) {
        // Upgrade to best function-calling model from registry
        finalModel = getBestFunctionCallingModel();
        logger.info(`[GeminiService] Model ${model} doesn't support function calling but tools are required. Upgrading to ${finalModel}`);
        logger.info(`[GeminiService] Tools:`, JSON.stringify(toolsArray, null, 2));
      } else if (requiresFunctionCalling && modelSupportsFunctionCalling(model)) {
        // Model already supports function calling, no upgrade needed
        logger.info(`[GeminiService] Model ${model} supports function calling, using as-is`);
      }

      // Build final config - only include tools if model supports function calling
      const finalConfig: any = {
        systemInstruction: config?.systemInstruction,
        responseSchema: config?.responseSchema,
        responseMimeType: config?.responseMimeType
      };

      // Only include tools if model supports function calling
      // CRITICAL: Never pass tools to a model that doesn't support function calling
      if (requiresFunctionCalling && toolsArray) {
        if (modelSupportsFunctionCalling(finalModel)) {
          finalConfig.tools = toolsArray;
          logger.info(`[GeminiService] Including ${toolsArray.length} tool(s) with model ${finalModel}`);
        } else {
          // Safety check: If we somehow still have a model that doesn't support tools,
          // remove tools to prevent API errors
          logger.error(`[GeminiService] ERROR: Model ${finalModel} doesn't support function calling but tools are required. Removing tools to prevent API error.`);
          // Don't include tools - this will cause the request to fail, but at least we won't get the function calling error
        }
      }

      // Final safety check: ensure we never pass tools to unsupported models
      // CRITICAL: gemini-2.5-flash does NOT support function calling at all
      if (finalConfig.tools && (!modelSupportsFunctionCalling(finalModel) || finalModel.includes('2.5-flash'))) {
        logger.error(`[GeminiService] CRITICAL: Removing tools from config for unsupported model ${finalModel}`);
        delete finalConfig.tools;
        // If we had tools but model doesn't support them, don't upgrade - just remove tools
        // The task should be completable without tools
      }

      // Log final configuration for debugging
      if (hasTools) {
        logger.info(`[GeminiService] Final config - Model: ${finalModel}, Has tools: ${!!finalConfig.tools}, Tools count: ${finalConfig.tools?.length || 0}`);
      }

      // ABSOLUTE SAFETY: Remove tools property entirely if it's empty or undefined
      if (finalConfig.tools === undefined || finalConfig.tools === null ||
        (Array.isArray(finalConfig.tools) && finalConfig.tools.length === 0)) {
        delete finalConfig.tools;
      }

      // FINAL CHECK: For gemini-2.5-flash, absolutely never pass tools
      // Even if somehow tools made it through, remove them here as the last line of defense
      if (finalModel.includes('2.5-flash')) {
        delete finalConfig.tools;
        logger.info(`[GeminiService] Final safety check: Removed tools for ${finalModel} before API call`);
      }

      // Create a clean config object without tools for flash models
      const apiConfig: any = { ...finalConfig };
      if (finalModel.includes('2.5-flash')) {
        delete apiConfig.tools;
      }

      // Add temperature setting for response variability
      // Default to 0.9 for creative tasks, can be overridden via config
      if (config?.temperature !== undefined) {
        apiConfig.temperature = config.temperature;
      }

      // Add Google Search grounding if useInternet is enabled
      // Note: Grounding is only available for certain Gemini models (gemini-2.0, gemini-3-pro, etc.)
      if (config?.useInternet && !finalModel.includes('2.5-flash')) {
        // Check if model supports grounding (gemini-2.0+, gemini-3-pro+, gemini-2.5-pro+)
        // Note: gemini-1.5-flash-exp and gemini-1.5-pro are deprecated
        const supportsGrounding = finalModel.includes('gemini-2.0') ||
          finalModel.includes('gemini-3-pro') ||
          finalModel.includes('gemini-3-flash') ||
          finalModel.includes('gemini-2.5-pro');

        if (supportsGrounding) {
          apiConfig.grounding = {
            mode: 'GROUNDING_MODE_GOOGLE_SEARCH_RETRIEVAL',
            googleSearchRetrieval: {
              dynamicRetrievalConfig: {
                mode: 'MODE_DYNAMIC',
                dynamicThreshold: 0.3
              }
            }
          };
          logger.info(`[GeminiService] Google Search grounding enabled for model: ${finalModel}`);
        } else {
          logger.warn(`[GeminiService] Model ${finalModel} does not support grounding. Internet search may not work.`);
        }
      }

      // Get AI instance with current API key (database first, then env)
      const ai = await getAIInstance();
      logger.info(`[GeminiService] Calling generateContent API with model ${finalModel}...`);
      const result = await ai.models.generateContent({
        model: finalModel,
        contents: prompt,
        config: apiConfig
      });
      logger.info(`[GeminiService] generateContent API returned. Text available: ${!!result.text}`);
      logger.debug(`[GeminiService] Starting post-processing`);


      // Extract function calls from response if present
      // Gemini API returns function calls in result.functionCalls array
      const functionCalls: any[] = [];
      try {
        logger.debug(`[GeminiService] Checking function calls`);
        // Check for function calls in the response
        // The structure may vary, so we check multiple possible locations
        const funcCalls = (result as any).functionCalls ||
          (result as any).candidates?.[0]?.functionCalls ||
          (result as any).response?.functionCalls;

        if (funcCalls && Array.isArray(funcCalls)) {
          for (const funcCall of funcCalls) {
            try {
              // Parse function call arguments
              let args = {};
              if (funcCall.args) {
                if (typeof funcCall.args === 'string') {
                  args = JSON.parse(funcCall.args);
                } else if (typeof funcCall.args === 'object') {
                  args = funcCall.args;
                }
              }

              functionCalls.push({
                name: funcCall.name || funcCall.functionName,
                args: args
              });
            } catch (e) {
              logger.warn('Failed to parse function call:', e);
            }
          }
        }
      } catch (e) {
        // Function calls extraction is optional, don't fail if it errors
        logger.debug('Function calls extraction skipped:', e);
      }

      // Extract Google Search grounding metadata and URLs
      const resources: string[] = [];
      let groundingMetadata: any = null;

      try {
        logger.debug(`[GeminiService] Checking grounding`);
        // Check for grounding metadata in various possible locations
        const grounding = (result as any).groundingMetadata ||
          (result as any).candidates?.[0]?.groundingMetadata ||
          (result as any).response?.groundingMetadata;

        if (grounding) {
          groundingMetadata = grounding;

          // Extract URLs from grounding chunks
          if (grounding.groundingChunks && Array.isArray(grounding.groundingChunks)) {
            for (const chunk of grounding.groundingChunks) {
              // Check for web URLs in various possible locations
              if (chunk.web) {
                if (chunk.web.uri) {
                  resources.push(chunk.web.uri);
                }
              }
              if (chunk.uri) {
                resources.push(chunk.uri);
              }
              if (chunk.retrievalMetadata?.web?.uri) {
                resources.push(chunk.retrievalMetadata.web.uri);
              }
            }
          }

          // Also check for search entry point (if available)
          if (grounding.searchEntryPoint) {
            if (grounding.searchEntryPoint.renderedContent) {
              // Try to extract URLs from rendered content (may contain links)
              const urlRegex = /https?:\/\/[^\s\)]+/g;
              const matches = grounding.searchEntryPoint.renderedContent.match(urlRegex);
              if (matches) {
                resources.push(...matches);
              }
            }
          }

          // Remove duplicates and filter out invalid URLs
          const uniqueResources = Array.from(new Set(resources)).filter(url => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          });

          if (uniqueResources.length > 0) {
            logger.info(`[GeminiService] Extracted ${uniqueResources.length} Google Search URLs from grounding metadata`);
          }

          resources.length = 0;
          resources.push(...uniqueResources);
        }
      } catch (e) {
        // Grounding metadata extraction is optional, don't fail if it errors
        logger.debug('Grounding metadata extraction skipped:', e);
      }

      logger.debug(`[GeminiService] Returning response object`);

      logger.debug(`[GeminiService] Accessing text`);
      const textVal = result.text || '';
      logger.debug(`[GeminiService] Accessing usage`);
      const usageVal = {
        promptTokens: result.usageMetadata?.promptTokenCount || 0,
        candidatesTokens: result.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: result.usageMetadata?.totalTokenCount || 0
      };
      logger.debug(`[GeminiService] Accessing functionCalls`);
      const fcVal = functionCalls.length > 0 ? functionCalls : undefined;
      logger.debug(`[GeminiService] Accessing resources`);
      const resVal = resources.length > 0 ? resources : undefined;
      logger.debug(`[GeminiService] Accessing grounding`);
      const groundVal = groundingMetadata || undefined;

      logger.debug(`[GeminiService] Constructing final object`);
      /*
      return {
        text: textVal,
        functionCalls: fcVal,
        usage: usageVal,
        resources: resVal,
        groundingMetadata: groundVal
      };
      */
      logger.debug(`[GeminiService] Text length: ${textVal.length}`);
      logger.debug(`[GeminiService] Returning FULL TEXT (No metadata) object`);
      return {
        text: textVal,
        functionCalls: undefined, // Keep undefined to test text isolation
        usage: undefined,
        resources: undefined,
        groundingMetadata: undefined
      } as any;
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw error;
    }
  }

  async generateStructuredOutput(
    prompt: string,
    schema: Schema,
    model?: string,
    options?: {
      useInternalRouter?: boolean;
      taskType?: string;
      context?: 'internal' | 'system' | 'user' | 'background';
    }
  ): Promise<any> {
    // Whitelist of models that support JSON mode (structured output)
    // Note: gemini-2.5-flash does NOT support JSON mode
    const JSON_MODE_SUPPORTED_MODELS = [
      'gemini-2.5-pro',
      'gemini-3-pro-preview',
      'gemini-3-pro',
      'gemini-3-flash-preview',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-2.0-flash-thinking-exp'
    ];

    // Initialize finalModel early to ensure it's always defined in catch block
    // Default to a model that supports JSON mode (not gemini-2.5-flash)
    let finalModel = model || 'gemini-2.5-pro'; // Default to a model that supports JSON mode

    try {
      // Use internal router for model selection if enabled and no model specified

      if (!model && options?.useInternalRouter !== false) {
        try {
          const routingDecision = await internalTaskRouter.routeTask({
            prompt,
            taskType: options?.taskType || 'structured-output',
            context: options?.context || 'internal',
            requiredCapabilities: ['structuredOutput']
          });

          // Only use the routed model if it's a Gemini model, not a TTS model, and supports JSON mode
          if (routingDecision.selectedModel.provider === 'gemini') {
            const modelId = routingDecision.selectedModel.modelIdentifier.toLowerCase();
            // Exclude TTS and audio-only models
            if (modelId.includes('tts') || modelId.includes('audio-only')) {
              logger.warn(`[GeminiService] Router selected TTS/audio model ${routingDecision.selectedModel.modelIdentifier}, using default instead`);
            } else {
              // Check if model supports JSON mode (whitelist check)
              const supportsJsonMode = JSON_MODE_SUPPORTED_MODELS.some(whitelisted =>
                modelId.includes(whitelisted.toLowerCase())
              );
              if (supportsJsonMode) {
                finalModel = routingDecision.selectedModel.modelIdentifier;
                logger.info(`[GeminiService] Internal router selected: ${finalModel} (${routingDecision.tier} tier)`);
              } else {
                logger.warn(`[GeminiService] Router selected model ${routingDecision.selectedModel.modelIdentifier} that doesn't support JSON mode, using default instead`);
              }
            }
          }
        } catch (routerError: any) {
          logger.warn(`[GeminiService] Internal router failed, using default model: ${routerError.message}`);
        }
      } else if (model) {
        // Validate that provided model supports JSON mode
        const modelId = model.toLowerCase();
        if (modelId.includes('tts') || modelId.includes('audio-only')) {
          logger.warn(`[GeminiService] TTS/audio model ${model} specified for structured output, using default instead`);
          finalModel = 'gemini-2.5-pro'; // Use a model that supports JSON mode
        } else {
          // Check if model supports JSON mode (whitelist check)
          const supportsJsonMode = JSON_MODE_SUPPORTED_MODELS.some(whitelisted =>
            modelId.includes(whitelisted.toLowerCase())
          );
          if (supportsJsonMode) {
            finalModel = model;
          } else {
            logger.warn(`[GeminiService] Model ${model} doesn't support JSON mode, using default instead`);
            finalModel = 'gemini-2.5-pro'; // Use a model that supports JSON mode
          }
        }
      }

      // Validate API key before making request
      // Get API key dynamically (database first, then env)
      const apiKey = await getGeminiApiKey();
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('Gemini API key is not configured. Please add it via API Keys Management or set GEMINI_API_KEY environment variable.');
      }

      const startTime = Date.now();
      // Get AI instance with current API key
      const ai = await getAIInstance();
      const result = await ai.models.generateContent({
        model: finalModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      const latency = Date.now() - startTime;

      // Log slow API calls for monitoring
      if (latency > 15000) {
        logger.warn(`⚠️ Very slow Gemini API call: ${latency}ms for model ${finalModel}`);
      } else if (latency > 10000) {
        logger.warn(`⚠️ Slow Gemini API call: ${latency}ms for model ${finalModel}`);
      }

      // Validate response
      if (!result || !result.text) {
        throw new Error('Gemini API returned empty response');
      }

      let parsed;
      try {
        parsed = JSON.parse(result.text);
      } catch (parseError: any) {
        logger.error('Failed to parse Gemini JSON response:', {
          text: result.text?.substring(0, 500), // Log first 500 chars
          error: parseError.message
        });
        throw new Error(`Invalid JSON response from Gemini API: ${parseError.message}`);
      }

      // Attach usage metadata if available
      if (result.usageMetadata) {
        parsed.usage = {
          promptTokenCount: result.usageMetadata.promptTokenCount || 0,
          candidatesTokenCount: result.usageMetadata.candidatesTokenCount || 0,
          totalTokenCount: result.usageMetadata.totalTokenCount || 0
        };
      }

      return parsed;
    } catch (error: any) {
      // Enhance error messages for common issues
      let enhancedError = error;

      if (error.message?.includes('API key')) {
        enhancedError = new Error('Invalid or missing Gemini API key. Please check your GEMINI_API_KEY environment variable.');
        enhancedError.status = 401;
      } else if (error.status === 401 || error.status === 403) {
        enhancedError = new Error('Authentication failed. Please check your Gemini API key configuration.');
        enhancedError.status = error.status;
      } else if (error.status === 429) {
        enhancedError = new Error('Rate limit exceeded. Please wait a moment and try again.');
        enhancedError.status = 429;
      } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch')) {
        enhancedError = new Error('Network error connecting to Gemini API. Please check your internet connection and API endpoint.');
      }

      logger.error('Gemini structured output error:', {
        model: finalModel,
        error: enhancedError.message,
        originalError: error.message,
        code: error.code,
        status: enhancedError.status || error.status
      });

      throw enhancedError;
    }
  }

  /**
   * Generate content with streaming support
   */
  async *generateContentStream(
    prompt: string,
    model: string = 'gemini-2.5-flash',
    config?: {
      systemInstruction?: string;
      tools?: any[];
      useInternet?: boolean;
    }
  ): AsyncGenerator<string, void, unknown> {
    try {
      let finalModel = model;

      // Don't use tools with flash models
      const isFlashModel = model.includes('2.5-flash');
      let toolsArray: any[] | undefined = undefined;

      if (!isFlashModel && config?.tools && Array.isArray(config.tools) && config.tools.length > 0) {
        toolsArray = config.tools;
      }

      const apiConfig: any = {
        temperature: 0.7
      };

      if (config?.systemInstruction) {
        apiConfig.systemInstruction = config.systemInstruction;
      }

      if (toolsArray && toolsArray.length > 0) {
        apiConfig.tools = toolsArray;
      }

      // Add Google Search grounding if useInternet is enabled
      if (config?.useInternet && !finalModel.includes('2.5-flash')) {
        const supportsGrounding = finalModel.includes('gemini-2.0') ||
          finalModel.includes('gemini-3-pro') ||
          finalModel.includes('gemini-2.5-pro');

        if (supportsGrounding) {
          apiConfig.grounding = {
            mode: 'GROUNDING_MODE_GOOGLE_SEARCH_RETRIEVAL',
            googleSearchRetrieval: {
              dynamicRetrievalConfig: {
                mode: 'MODE_DYNAMIC',
                dynamicThreshold: 0.3
              }
            }
          };
        }
      }

      const ai = await getAIInstance();

      // Build contents - use prompt directly, system instruction is passed via apiConfig
      let contentsParam: string = prompt;

      // NOTE: System instruction is passed via apiConfig.systemInstruction
      // Do NOT prepend it to the prompt - this causes duplication and may confuse the model

      // Call generateContentStream - match the non-streaming API structure
      let resultStream: any;
      try {
        resultStream = await ai.models.generateContentStream({
          model: finalModel,
          contents: contentsParam,
          config: apiConfig
        });
      } catch (apiError: any) {
        logger.error(`[GeminiService] generateContentStream API error:`, apiError);
        throw new Error(`Gemini streaming API error: ${apiError.message || 'Unknown error'}`);
      }

      // Handle different possible response structures
      let stream: AsyncIterable<any>;

      if (resultStream && typeof resultStream[Symbol.asyncIterator] === 'function') {
        // resultStream is directly iterable
        stream = resultStream;
      } else if (resultStream?.stream && typeof resultStream.stream[Symbol.asyncIterator] === 'function') {
        // resultStream has a .stream property that's iterable
        stream = resultStream.stream;
      } else {
        logger.error(`[GeminiService] Unexpected stream structure:`, {
          hasStream: !!resultStream?.stream,
          isIterable: typeof resultStream?.[Symbol.asyncIterator] === 'function',
          type: typeof resultStream,
          keys: resultStream ? Object.keys(resultStream) : []
        });
        throw new Error('Gemini API response is not iterable - unexpected response structure');
      }

      // Iterate over the stream
      for await (const chunk of stream) {
        // Handle different chunk structures
        let text: string | undefined;

        if (typeof chunk === 'string') {
          text = chunk;
        } else if (chunk?.text) {
          text = chunk.text;
        } else if (chunk?.candidates?.[0]?.content?.parts?.[0]?.text) {
          text = chunk.candidates[0].content.parts[0].text;
        }

        if (text && typeof text === 'string' && text.trim().length > 0) {
          yield text;
        }
      }
    } catch (error: any) {
      logger.error('Gemini streaming error:', error);
      throw new Error(`Gemini streaming error: ${error.message || 'Unknown error'}`);
    }
  }
}

export const geminiService = new GeminiService();

