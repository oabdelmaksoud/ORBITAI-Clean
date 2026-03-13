/**
 * Ollama Service Provider
 * Supports locally deployed Ollama instances
 */

import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';

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
  tools?: any[];
}

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      logger.debug(`Ollama not available at ${this.baseUrl}:`, error);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.models || []).map((model: any) => model.name || model.model);
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('Failed to fetch Ollama models:', apiError);
      throw new Error(`Failed to fetch Ollama models: ${apiError.message}`);
    }
  }

  /**
   * Generate content using Ollama
   */
  async generateContent(
    prompt: string,
    model: string,
    configOptions?: LLMConfig
  ): Promise<LLMResponse> {
    try {
      const messages: any[] = [];

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

      const requestBody: any = {
        model,
        messages,
        stream: false,
        options: {
          temperature: configOptions?.temperature ?? 0.7,
          num_predict: configOptions?.maxTokens
        }
      };

      // Ollama supports JSON mode
      if (configOptions?.responseFormat?.type === 'json_object') {
        requestBody.format = 'json';
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Ollama response format
      const text = data.message?.content || '';
      const promptTokens = data.prompt_eval_count || 0;
      const completionTokens = data.eval_count || 0;

      return {
        text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        }
      };
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('Ollama API error:', apiError);
      throw new Error(`Ollama API error: ${apiError.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate structured output
   */
  async generateStructuredOutput(
    prompt: string,
    schema: any,
    model: string
  ): Promise<any> {
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
   * Test connection to Ollama instance
   */
  async testConnection(): Promise<{ success: boolean; error?: string; models?: string[] }> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return { success: false, error: 'Ollama is not available at the configured URL' };
      }

      const models = await this.getAvailableModels();
      return { success: true, models };
    } catch (error: unknown) {
      const apiError = toApiError(error);
      return { success: false, error: apiError.message };
    }
  }
}
