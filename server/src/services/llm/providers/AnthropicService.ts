import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';
/**
 * Anthropic (Claude) Service Provider
 */

import Anthropic from '@anthropic-ai/sdk';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database ONLY (no env fallback for security)
async function getAnthropicApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('anthropic');
  if (dbKey) {
    return dbKey;
  }
  throw new Error(
    'Anthropic API key not configured. Please add it via Admin Console → Settings → API Keys'
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
  tools?: any[]; // Function declarations for Anthropic tool use
}

export class AnthropicService {
  // Get client dynamically with current API key
  private async getClient(): Promise<Anthropic> {
    const apiKey = await getAnthropicApiKey();
    return new Anthropic({ apiKey });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getAnthropicApiKey();
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
      // Convert incoming tools (functionDeclarations shape) to Anthropic tool format
      const anthropicTools = (configOptions?.tools ?? []).flatMap((t: any) =>
        (t.functionDeclarations ?? []).map((f: any) => ({
          name: f.name,
          description: f.description,
          input_schema: f.parameters ?? { type: 'object', properties: {} },
        }))
      );

      const response = await client.messages.create({
        model,
        max_tokens: configOptions?.maxTokens || 4096,
        temperature: configOptions?.temperature || 0.7,
        system: configOptions?.systemInstruction,
        tools: anthropicTools.length ? anthropicTools : undefined,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const text = response.content
        .filter(item => item.type === 'text')
        .map(item => (item as Anthropic.Message.TextBlock).text)
        .join('');

      // Parse tool_use blocks into functionCalls (mirrors OpenAIService shape)
      const functionCalls = response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({
          name: (b as any).name as string,
          args: ((b as any).input ?? {}) as Record<string, any>,
        }));

      const result: LLMResponse = {
        text,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };

      if (functionCalls.length > 0) {
        result.functionCalls = functionCalls;
      }

      return result;
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('Anthropic API error:', apiError);
      throw new Error(`Anthropic API error: ${apiError.message || 'Unknown error'}`);
    }
  }

  async generateStructuredOutput(
    prompt: string,
    schema: any,
    model: string = 'claude-3-5-sonnet-20241022'
  ): Promise<any> {
    const systemPrompt = `You are a helpful assistant that returns JSON responses matching the provided schema. Always return valid JSON.`;

    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}\n\nReturn a valid JSON response.`;

    const result = await this.generateContent(fullPrompt, model, {
      temperature: 0.3,
      maxTokens: 4096,
    });

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
}

export const anthropicService = new AnthropicService();
