import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';
/**
 * OpenAI Service Provider
 */

import OpenAI from 'openai';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database first, then fallback to environment variable
async function getOpenAIApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('openai');
  if (dbKey) {
    logger.info(`[OpenAIService] Using API key from database`);
    return dbKey;
  }
  // Fallback to environment variable
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey && envKey.trim() !== '') {
    logger.info(`[OpenAIService] Using API key from environment (.env)`);
    return envKey;
  }
  throw new Error(
    'OpenAI API key not configured. Please add it via Admin Console → Settings → API Keys or set OPENAI_API_KEY in .env'
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

export interface LLMConfig {
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  tools?: any[]; // Function declarations for OpenAI function calling
}

export class OpenAIService {
  private cachedClient: OpenAI | null = null;
  private cachedApiKey: string | null = null;

  // Get client dynamically with current API key, reusing if key unchanged
  private async getClient(): Promise<OpenAI> {
    const apiKey = await getOpenAIApiKey();
    if (this.cachedClient && this.cachedApiKey === apiKey) {
      return this.cachedClient;
    }
    this.cachedClient = new OpenAI({ apiKey });
    this.cachedApiKey = apiKey;
    return this.cachedClient;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getOpenAIApiKey();
      return !!apiKey && apiKey.trim().length > 0;
    } catch {
      return false;
    }
  }

  async generateContent(
    prompt: string,
    model: string,
    configOptions?: LLMConfig
  ): Promise<LLMResponse> {
    const client = await this.getClient();

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (configOptions?.systemInstruction) {
        messages.push({
          role: 'system',
          content: configOptions.systemInstruction,
        });
      }

      messages.push({
        role: 'user',
        content: prompt,
      });

      // Convert tools to OpenAI format if provided
      const openAITools: any[] | undefined = configOptions?.tools
        ? this.convertToolsToOpenAIFormat(configOptions.tools)
        : undefined;

      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: configOptions?.temperature || 0.7,
        max_tokens: configOptions?.maxTokens,
        response_format: configOptions?.responseFormat,
        tools: openAITools,
      });

      const choice = response.choices[0];
      const text = choice.message.content || '';

      // Extract function calls from OpenAI response
      const functionCalls: any[] = [];
      if (choice.message.tool_calls && Array.isArray(choice.message.tool_calls)) {
        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.type === 'function' && toolCall.function) {
            try {
              const args =
                typeof toolCall.function.arguments === 'string'
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function.arguments;

              functionCalls.push({
                name: toolCall.function.name,
                args: args || {},
              });
            } catch (e: unknown) {
              logger.warn('Failed to parse OpenAI function call:', e);
            }
          }
        }
      }

      const result: any = {
        text,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };

      // Add function calls if present
      if (functionCalls.length > 0) {
        result.functionCalls = functionCalls;
      }

      return result;
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('OpenAI API error:', apiError);
      throw new Error(`OpenAI API error: ${apiError.message || 'Unknown error'}`);
    }
  }

  async generateStructuredOutput(
    prompt: string,
    _schema: any,
    model: string = 'gpt-4o'
  ): Promise<any> {
    const systemPrompt = `You are a helpful assistant that returns JSON responses matching the provided schema.`;

    const result = await this.generateContent(
      `${systemPrompt}\n\nUser request: ${prompt}\n\nReturn a valid JSON response.`,
      model,
      {
        responseFormat: { type: 'json_object' },
        temperature: 0.3,
      }
    );

    try {
      return JSON.parse(result.text);
    } catch (error: unknown) {
      // Try to extract JSON from response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse structured output');
    }
  }

  /**
   * Generate content with streaming support
   */
  async *generateContentStream(
    prompt: string,
    model: string,
    configOptions?: LLMConfig
  ): AsyncGenerator<string, void, unknown> {
    const client = await this.getClient();

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (configOptions?.systemInstruction) {
        messages.push({
          role: 'system',
          content: configOptions.systemInstruction,
        });
      }

      messages.push({
        role: 'user',
        content: prompt,
      });

      // Convert tools to OpenAI format if provided
      const openAITools: any[] | undefined = configOptions?.tools
        ? this.convertToolsToOpenAIFormat(configOptions.tools)
        : undefined;

      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: configOptions?.temperature || 0.7,
        max_tokens: configOptions?.maxTokens,
        response_format: configOptions?.responseFormat,
        tools: openAITools,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('OpenAI streaming error:', apiError);
      throw new Error(`OpenAI streaming error: ${apiError.message || 'Unknown error'}`);
    }
  }

  /**
   * Convert tools to OpenAI format
   */
  private convertToolsToOpenAIFormat(tools: any[]): any[] {
    const openAITools: any[] = [];

    for (const tool of tools) {
      if (tool.functionDeclarations && Array.isArray(tool.functionDeclarations)) {
        for (const funcDecl of tool.functionDeclarations) {
          openAITools.push({
            type: 'function',
            function: {
              name: funcDecl.name,
              description: funcDecl.description,
              parameters: funcDecl.parameters || {},
            },
          });
        }
      }
    }

    return openAITools;
  }
}

export const openAIService = new OpenAIService();
