import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';
/**
 * DeepSeek Service Provider
 * DeepSeek uses OpenAI-compatible API
 */

import OpenAI from 'openai';
import { LLMResponse, LLMConfig } from './OpenAIService.js';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database ONLY (no env fallback for security)
async function getDeepSeekApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('deepseek');
  if (dbKey) {
    return dbKey;
  }
  throw new Error('DeepSeek API key not configured. Please add it via Admin Console → Settings → API Keys');
}

export class DeepSeekService {
  // Get client dynamically with current API key
  private async getClient(): Promise<OpenAI> {
    const apiKey = await getDeepSeekApiKey();
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getDeepSeekApiKey();
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
          content: configOptions.systemInstruction
        });
      }

      messages.push({
        role: 'user',
        content: prompt
      });

      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: configOptions?.temperature || 0.7,
        max_tokens: configOptions?.maxTokens
      });

      const choice = response.choices[0];
      const text = choice.message.content || '';

      return {
        text,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error: any) {
      const apiError = toApiError(error);
      logger.error('DeepSeek API error:', apiError);
      throw new Error(`DeepSeek API error: ${apiError.message || 'Unknown error'}`);
    }
  }

  async generateStructuredOutput(
    prompt: string,
    schema: any,
    model: string = 'deepseek-chat'
  ): Promise<any> {
    const systemPrompt = `You are a helpful assistant that returns JSON responses matching the provided schema. Always return valid JSON.`;

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
}

export const deepSeekService = new DeepSeekService();
