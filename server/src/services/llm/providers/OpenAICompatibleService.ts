/**
 * OpenAI-Compatible Service Provider
 * Generic service for any local LLM server that implements OpenAI-compatible API
 */

import OpenAI from 'openai';
import { logger } from '../../../utils/logger.js';

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

export class OpenAICompatibleService {
  private client: OpenAI;
  private baseUrl: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    const config: any = {
      baseURL: this.baseUrl
    };
    
    // Some OpenAI-compatible servers require an API key, others don't
    if (apiKey) {
      config.apiKey = apiKey;
    } else {
      // Use a dummy key if none provided (some servers require it)
      config.apiKey = 'not-required';
    }

    this.client = new OpenAI(config);
  }

  /**
   * Check if the OpenAI-compatible server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error: unknown) {
      logger.debug(`OpenAI-compatible server not available at ${this.baseUrl}:`, error);
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data.map(model => model.id);
    } catch (error: any) {
      logger.error('Failed to fetch OpenAI-compatible models:', error);
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
  }

  /**
   * Generate content using OpenAI-compatible API
   */
  async generateContent(
    prompt: string,
    model: string,
    configOptions?: LLMConfig
  ): Promise<LLMResponse> {
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

      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: configOptions?.temperature || 0.7,
        max_tokens: configOptions?.maxTokens,
        response_format: configOptions?.responseFormat,
        tools: openAITools
      });

      const choice = response.choices[0];
      const text = choice.message.content || '';
      
      // Extract function calls from response
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
            } catch (e: unknown) {
              logger.warn('Failed to parse function call:', e);
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
    } catch (error: any) {
      logger.error('OpenAI-compatible API error:', error);
      throw new Error(`API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate structured output
   */
  async generateStructuredOutput(
    prompt: string,
    _schema: any,
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
   * Test connection to OpenAI-compatible server
   */
  async testConnection(): Promise<{ success: boolean; error?: string; models?: string[] }> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return { success: false, error: 'Server is not available at the configured URL' };
      }

      const models = await this.getAvailableModels();
      return { success: true, models };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}




