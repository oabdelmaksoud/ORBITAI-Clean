/**
 * vLLM Service Provider
 * Supports locally deployed vLLM instances (OpenAI-compatible API)
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

export class VLLMService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = 'http://localhost:8000', apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Check if vLLM is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers
      });
      return response.ok;
    } catch (error) {
      logger.debug(`vLLM not available at ${this.baseUrl}:`, error);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`vLLM API error: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.data || []).map((model: any) => model.id || model.name);
    } catch (error: any) {
      const apiError = toApiError(error);
      logger.error('Failed to fetch vLLM models:', apiError);
      throw new Error(`Failed to fetch vLLM models: ${apiError.message}`);
    }
  }

  /**
   * Generate content using vLLM (OpenAI-compatible API)
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
        temperature: configOptions?.temperature ?? 0.7,
        max_tokens: configOptions?.maxTokens
      };

      // vLLM supports JSON mode
      if (configOptions?.responseFormat?.type === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      // Convert tools to OpenAI format if provided
      if (configOptions?.tools && configOptions.tools.length > 0) {
        requestBody.tools = this.convertToolsToOpenAIFormat(configOptions.tools);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`vLLM API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      const choice = data.choices?.[0];
      const text = choice?.message?.content || '';

      // Extract function calls if present
      const functionCalls: any[] = [];
      if (choice?.message?.tool_calls) {
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
              logger.warn('Failed to parse vLLM function call:', e);
            }
          }
        }
      }

      const result: any = {
        text,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      };

      if (functionCalls.length > 0) {
        result.functionCalls = functionCalls;
      }

      return result;
    } catch (error: any) {
      const apiError = toApiError(error);
      logger.error('vLLM API error:', apiError);
      throw new Error(`vLLM API error: ${apiError.message || 'Unknown error'}`);
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

  /**
   * Test connection to vLLM instance
   */
  async testConnection(): Promise<{ success: boolean; error?: string; models?: string[] }> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return { success: false, error: 'vLLM is not available at the configured URL' };
      }

      const models = await this.getAvailableModels();
      return { success: true, models };
    } catch (error: any) {
      const apiError = toApiError(error);
      return { success: false, error: apiError.message };
    }
  }
}




