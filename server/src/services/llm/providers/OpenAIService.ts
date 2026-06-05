import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';
/**
 * OpenAI Service Provider
 */

import OpenAI from 'openai';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';
import { codexCLIService } from './CodexCLIService.js';

// Get API key from database ONLY (no env fallback for security)
async function getOpenAIApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('openai');
  if (dbKey) {
    return dbKey;
  }
  throw new Error('OpenAI API key not configured. Please add it via Admin Console → Settings → API Keys');
}

function useCodexCLI(): boolean {
  return (process.env.USE_CODEX_CLI || '').toLowerCase() === 'true';
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
  // Get client dynamically with current API key
  private async getClient(): Promise<OpenAI> {
    const apiKey = await getOpenAIApiKey();
    return new OpenAI({ apiKey });
  }

  async isAvailable(): Promise<boolean> {
    if (useCodexCLI()) {
      return codexCLIService.isAvailable();
    }
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
    if (useCodexCLI()) {
      logger.info('[OpenAIService] Routing generateContent through Codex CLI');
      return codexCLIService.generateContent(prompt, model, configOptions);
    }
    const client = await this.getClient();

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (configOptions?.systemInstruction) {
        messages.push({
          role: 'system',
          content: configOptions.systemInstruction
        });
      }

      messages.push({
        role: 'user',
        content: prompt
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
        tools: openAITools
      });

      const choice = response.choices[0];
      const text = choice.message.content || '';

      // Extract function calls from OpenAI response
      const functionCalls: any[] = [];
      if (choice.message.tool_calls && Array.isArray(choice.message.tool_calls)) {
        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.type === 'function' && toolCall.function) {
            try {
              const args = typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

              functionCalls.push({
                name: toolCall.function.name,
                args: args || {}
              });
            } catch (e) {
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
          totalTokens: response.usage?.total_tokens || 0
        }
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
    schema: any,
    model: string = 'gpt-4o'
  ): Promise<any> {
    if (useCodexCLI()) {
      logger.info('[OpenAIService] Routing generateStructuredOutput through Codex CLI');
      return codexCLIService.generateStructuredOutput(prompt, schema, model);
    }
    const systemPrompt = `You are a helpful assistant that returns JSON responses matching the provided schema.`;

    const result = await this.generateContent(
      `${systemPrompt}\n\nUser request: ${prompt}\n\nReturn a valid JSON response.`,
      model,
      {
        responseFormat: { type: 'json_object' },
        temperature: 0.3
      }
    );

    try {
      return JSON.parse(result.text);
    } catch (error) {
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
    if (useCodexCLI()) {
      logger.info('[OpenAIService] Routing generateContentStream through Codex CLI');
      yield* codexCLIService.generateContentStream(prompt, model, configOptions);
      return;
    }
    const client = await this.getClient();

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (configOptions?.systemInstruction) {
        messages.push({
          role: 'system',
          content: configOptions.systemInstruction
        });
      }

      messages.push({
        role: 'user',
        content: prompt
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
        stream: true
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
              parameters: funcDecl.parameters || {}
            }
          });
        }
      }
    }

    return openAITools;
  }

}

export const openAIService = new OpenAIService();
