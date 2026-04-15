import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';
/**
 * Groq Service
 * Ultra-fast inference for open-source models
 */

import OpenAI from 'openai';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database ONLY (no env fallback for security)
async function getGroqApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('groq');
  if (dbKey) {
    return dbKey;
  }
  throw new Error(
    'Groq API key not configured. Please add it via Admin Console → Settings → API Keys'
  );
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

class GroqService {
  private cachedClient: OpenAI | null = null;
  private cachedApiKey: string | null = null;

  // Get client dynamically with current API key, reusing if key unchanged
  private async getClient(): Promise<OpenAI> {
    const apiKey = await getGroqApiKey();
    if (this.cachedClient && this.cachedApiKey === apiKey) {
      return this.cachedClient;
    }
    this.cachedClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.cachedApiKey = apiKey;
    return this.cachedClient;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getGroqApiKey();
      return !!apiKey && apiKey.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Generate content using Groq
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
    const client = await this.getClient();

    try {
      const requestBody: any = {
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
      };

      // Add tools if provided (Groq supports OpenAI-compatible tools)
      if (options?.tools && options.tools.length > 0) {
        requestBody.tools = this.convertToolsToGroqFormat(options.tools);
        requestBody.tool_choice = options.toolChoice || 'auto';
      }

      const completion = await client.chat.completions.create(requestBody);

      const choice = completion.choices?.[0];
      if (!choice) {
        throw new Error('No response from Groq');
      }

      // Extract function calls if present
      const functionCalls: any[] = [];
      if (choice.message?.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          functionCalls.push({
            name: (toolCall as any).function?.name,
            arguments: (toolCall as any).function?.arguments,
            id: toolCall.id,
          });
        }
      }

      // Calculate usage
      const usage = {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      };

      return {
        text: choice.message?.content || '',
        functionCalls:
          functionCalls.length > 0
            ? functionCalls.map(fc => ({
                name: fc.name,
                args: fc.arguments
                  ? typeof fc.arguments === 'string'
                    ? JSON.parse(fc.arguments)
                    : fc.arguments
                  : {},
              }))
            : undefined,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
      };
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('[Groq] Generation failed:', apiError);
      throw apiError;
    }
  }

  /**
   * Convert generic tools to Groq format (OpenAI-compatible)
   */
  convertToolsToGroqFormat(tools: any[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name || tool.function?.name,
        description: tool.description || tool.function?.description,
        parameters: tool.parameters || tool.function?.parameters || tool.schema,
      },
    }));
  }
}

export const groqService = new GroqService();
