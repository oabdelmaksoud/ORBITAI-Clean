import { logger } from '../../../utils/logger.js';
/**
 * Vertex AI Service (Google Cloud)
 * Access to Gemini models via Google Cloud Platform
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../../config/env.js';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database ONLY (no env fallback for security)
async function getVertexApiKey(): Promise<string> {
  // Try vertex first, then gemini as fallback (both from database)
  const dbKey = await apiKeyProvider.getApiKey('vertex');
  if (dbKey) {
    return dbKey;
  }
  const geminiKey = await apiKeyProvider.getApiKey('gemini');
  if (geminiKey) {
    return geminiKey;
  }
  throw new Error('Vertex AI API key not configured. Please add it via Admin Console → Settings → API Keys');
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

class VertexService {
  private projectId: string;
  private location: string;

  constructor() {
    // Vertex AI requires Google Cloud credentials
    // Can use service account key or default credentials
    this.projectId = config.vertexProjectId || '';
    this.location = config.vertexLocation || 'us-central1';
  }

  // Get AI instance dynamically with current API key
  private async getAIInstance(): Promise<GoogleGenerativeAI> {
    const apiKey = await getVertexApiKey();
    return new GoogleGenerativeAI(apiKey);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getVertexApiKey();
      return !!apiKey && apiKey.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Generate content using Vertex AI (Gemini models)
   */
  async generateContent(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      tools?: any[];
      useInternet?: boolean;
    }
  ): Promise<LLMResponse> {
    const genAI = await this.getAIInstance();

    try {
      // Convert messages to Gemini format
      const geminiModel = genAI.getGenerativeModel({
        model: model.replace('vertex:', ''), // Remove prefix if present
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens,
          topP: options?.topP
        }
      });

      // Convert messages format
      const prompt = this.convertMessagesToPrompt(messages);

      // Add grounding if useInternet is true
      const requestOptions: any = {};
      if (options?.useInternet) {
        // Vertex AI supports grounding via Gemini
        requestOptions.tools = options.tools || [];
      }

      const result = await geminiModel.generateContent(prompt, requestOptions);
      const response = await result.response;
      const text = response.text();

      // Extract function calls if present
      const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const fc of response.functionCalls) {
          functionCalls.push({
            name: fc.name,
            args: fc.args || {}
          });
        }
      }

      // Estimate usage (Gemini doesn't always return exact token counts)
      const usage = {
        promptTokens: Math.ceil(prompt.length / 4), // Rough estimate
        completionTokens: Math.ceil(text.length / 4),
        totalTokens: Math.ceil((prompt.length + text.length) / 4)
      };

      return {
        text: text,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens
        }
      };
    } catch (error: any) {
      logger.error('[Vertex AI] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Convert chat messages to Gemini prompt format
   */
  private convertMessagesToPrompt(messages: Array<{ role: string; content: string }>): string {
    // Simple conversion - Gemini uses a different format
    // For better results, use the chat API
    return messages
      .map(msg => {
        if (msg.role === 'user') return `User: ${msg.content}`;
        if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
        return msg.content;
      })
      .join('\n\n');
  }
}

export const vertexService = new VertexService();

