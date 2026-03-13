import { logger } from '../../../utils/logger.js';
/**
 * Azure OpenAI Service
 * Access to OpenAI models via Microsoft Azure
 */

import OpenAI from 'openai';
import { config } from '../../../config/env.js';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database ONLY (no env fallback for security)
async function getAzureApiKey(): Promise<string> {
  const dbKey = await apiKeyProvider.getApiKey('azure');
  if (dbKey) {
    return dbKey;
  }
  throw new Error('Azure OpenAI API key not configured. Please add it via Admin Console → Settings → API Keys');
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

class AzureOpenAIService {
  private deploymentName: string;

  constructor() {
    this.deploymentName = config.azureOpenAIDeploymentName || '';
  }

  // Get client dynamically with current API key
  private async getClient(): Promise<OpenAI> {
    const apiKey = await getAzureApiKey();
    if (!config.azureOpenAIEndpoint) {
      throw new Error('Azure OpenAI endpoint not configured');
    }
    return new OpenAI({
      apiKey,
      baseURL: `${config.azureOpenAIEndpoint}/openai/deployments/${this.deploymentName}`,
      defaultQuery: { 'api-version': config.azureOpenAIApiVersion || '2024-02-15-preview' },
      defaultHeaders: {
        'api-key': apiKey
      }
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getAzureApiKey();
      return !!(apiKey && apiKey.trim().length > 0 && config.azureOpenAIEndpoint);
    } catch {
      return false;
    }
  }

  /**
   * Generate content using Azure OpenAI
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
      // Azure OpenAI uses deployment names, not model names
      const deployment = this.deploymentName || model;

      const requestBody: any = {
        model: deployment,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty
      };

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        requestBody.tools = this.convertToolsToAzureFormat(options.tools);
        requestBody.tool_choice = options.toolChoice || 'auto';
      }

      const completion = await client.chat.completions.create(requestBody);

      const choice = completion.choices?.[0];
      if (!choice) {
        throw new Error('No response from Azure OpenAI');
      }

      // Extract function calls if present
      const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];
      if (choice.message?.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          const functionName = toolCall.function?.name;
          const functionArgs = toolCall.function?.arguments;
          if (functionName) {
            functionCalls.push({
              name: functionName,
              args: functionArgs ? (typeof functionArgs === 'string' ? JSON.parse(functionArgs) : functionArgs) : {}
            });
          }
        }
      }

      // Calculate usage
      const usage = {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      };

      return {
        text: choice.message?.content || '',
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens
        }
      };
    } catch (error: any) {
      logger.error('[Azure OpenAI] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Convert generic tools to Azure OpenAI format (OpenAI-compatible)
   */
  convertToolsToAzureFormat(tools: any[]): any[] {
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

export const azureOpenAIService = new AzureOpenAIService();

