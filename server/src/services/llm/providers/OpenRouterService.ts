/**
 * OpenRouter Service
 * Unified API for 300+ LLM models across multiple providers
 */

import { config } from '../../../config/env.js';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';
import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';

// Get API key from database ONLY (no env fallback for security)
async function getOpenRouterApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('openrouter');
  if (dbKey) {
    return dbKey;
  }
  throw new Error('OpenRouter API key not configured. Please add it via Admin Console → Settings → API Keys');
}

export interface LLMResponse {
  text: string;
  functionCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
}

class OpenRouterService {
  private baseURL = 'https://openrouter.ai/api/v1';

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getOpenRouterApiKey();
      return !!apiKey && apiKey.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<OpenRouterModel[]> {
    const apiKey = await getOpenRouterApiKey();

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': config.frontendUrl || 'http://localhost:5173',
          'X-Title': 'OrbitAI'
        }
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('[OpenRouter] Failed to fetch models:', apiError);
      throw apiError;
    }
  }

  /**
   * Generate content using OpenRouter
   */
  async generateContent(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      tools?: any[];
      toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<LLMResponse> {
    const apiKey = await getOpenRouterApiKey();

    try {
      const requestBody: any = {
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty
      };

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
        requestBody.tool_choice = options.toolChoice || 'auto';
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.frontendUrl || 'http://localhost:5173',
          'X-Title': 'OrbitAI'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No response from OpenRouter');
      }

      // Extract function calls if present
      const functionCalls: any[] = [];
      if (choice.message?.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          functionCalls.push({
            name: toolCall.function?.name,
            arguments: toolCall.function?.arguments,
            id: toolCall.id
          });
        }
      }

      // Calculate usage
      const usage = {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      };

      return {
        text: choice.message?.content || '',
        functionCalls: functionCalls.length > 0 ? functionCalls.map(fc => ({
          name: fc.name,
          args: fc.arguments ? (typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : fc.arguments) : {}
        })) : undefined,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens
        }
      };
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('[OpenRouter] Generation failed:', apiError);
      throw apiError;
    }
  }

  /**
   * Convert generic tools to OpenRouter format
   */
  convertToolsToOpenRouterFormat(tools: any[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name || tool.function?.name,
        description: tool.description || tool.function?.description,
        parameters: tool.parameters || tool.function?.parameters || tool.schema
      }
    }));
  }
}

export const openRouterService = new OpenRouterService();

