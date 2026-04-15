import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';
/**
 * Mistral AI Service Provider
 * Mistral uses OpenAI-compatible API
 */

import OpenAI from 'openai';
import { LLMResponse, LLMConfig } from './OpenAIService.js';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database ONLY (no env fallback for security)
async function getMistralApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('mistral');
  if (dbKey) {
    return dbKey;
  }
  throw new Error('Mistral API key not configured. Please add it via Admin Console → Settings → API Keys');
}

export class MistralService {
  // Get client dynamically with current API key
  private async getClient(): Promise<OpenAI> {
    const apiKey = await getMistralApiKey();
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.mistral.ai/v1'
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getMistralApiKey();
      return !!apiKey && apiKey.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * List available models from Mistral API
   * Useful for debugging and verifying model names
   */
  async listAvailableModels(): Promise<string[]> {
    try {
      const client = await this.getClient();
      const models = await client.models.list();
      return models.data.map(m => m.id);
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('Failed to list Mistral models:', apiError);
      // Return common Mistral model names as fallback
      return ['mistral-small', 'mistral-medium', 'mistral-large', 'mistral-tiny'];
    }
  }

  async generateContent(
    prompt: string,
    model: string,
    configOptions?: LLMConfig
  ): Promise<LLMResponse> {
    const client = await this.getClient();

    // Map model names to correct Mistral API identifiers
    // Magistral Small is open-source and may not be available via API
    const modelMapping: Record<string, string> = {
      'magistral-small': 'mistral-small', // Fallback to mistral-small
      'magistral-medium': 'mistral-medium',
      'devstral-small': 'mistral-small' // Fallback to mistral-small
    };

    const apiModelName = modelMapping[model.toLowerCase()] || model;

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

      const requestOptions: OpenAI.Chat.ChatCompletionCreateParams = {
        model: apiModelName,
        messages,
        temperature: configOptions?.temperature || 0.7,
        max_tokens: configOptions?.maxTokens
      };

      // Add tools if provided (for function calling)
      if (configOptions?.tools && configOptions.tools.length > 0) {
        requestOptions.tools = this.convertToolsToMistralFormat(configOptions.tools);
      }

      const response = await client.chat.completions.create(requestOptions);

      const choice = response.choices[0];
      const text = choice.message.content || '';

      // Extract function calls if present
      const functionCalls = choice.message.tool_calls || [];

      return {
        text,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        functionCalls: functionCalls.length > 0 ? functionCalls.map(fc => {
          // Handle both standard and custom tool call formats
          const func = (fc as any).function || (fc as any);
          return {
            name: func?.name || '',
            args: func?.arguments ? (typeof func.arguments === 'string' ? JSON.parse(func.arguments) : func.arguments) : {}
          };
        }) : undefined
      };
    } catch (error: unknown) {
      const apiError = toApiError(error);
      logger.error('Mistral API error:', apiError);

      // Extract detailed error information
      let errorMessage = apiError.message || 'Unknown error';
      const errorDetails: { status?: number; body?: unknown } = {};

      const errAny = error as any;
      if (errAny.response) {
        // OpenAI SDK error with response object
        const status = errAny.response?.status || errAny.status;
        const statusText = errAny.response?.statusText || errAny.statusText;
        const errorBody = errAny.response?.data || errAny.body || errAny.error;

        errorDetails.status = status;
        errorDetails.body = errorBody;

        if (errorBody?.error) {
          errorMessage = typeof errorBody.error === 'string'
            ? errorBody.error
            : errorBody.error.message || errorBody.error.code || 'Unknown error';
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        } else if (status) {
          errorMessage = `HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
          if (errorBody && typeof errorBody === 'object') {
            errorMessage += `: ${JSON.stringify(errorBody)}`;
          } else if (errorBody) {
            errorMessage += `: ${errorBody}`;
          }
        }
      }

      // Log full error details for debugging
      logger.error('Mistral API error details:', {
        message: errorMessage,
        status: errorDetails.status,
        body: errorDetails.body,
        model: model,
        originalError: {
          name: error.name,
          message: error.message,
          code: error.code
        }
      });

      // Provide more helpful error message with model name
      let fullErrorMessage = `Mistral API error: ${errorMessage}`;
      if (errorDetails.status) {
        fullErrorMessage += ` (Status: ${errorDetails.status})`;
      }
      if (model) {
        fullErrorMessage += ` [Requested Model: ${model}`;
        if (apiModelName !== model) {
          fullErrorMessage += `, Mapped to: ${apiModelName}`;
        }
        fullErrorMessage += ']';
        // Add helpful hint if model name was mapped
        if (apiModelName !== model) {
          fullErrorMessage += ` - Note: "${model}" was mapped to "${apiModelName}". Magistral models may not be available via Mistral API.`;
        }
      }

      throw new Error(fullErrorMessage);
    }
  }

  private convertToolsToMistralFormat(tools: any[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name || tool.function?.name,
        description: tool.description || tool.function?.description,
        parameters: tool.parameters || tool.function?.parameters || {}
      }
    }));
  }

  async generateStructuredOutput(
    prompt: string,
    schema: any,
    model: string = 'mistral-medium-3'
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

export const mistralService = new MistralService();
