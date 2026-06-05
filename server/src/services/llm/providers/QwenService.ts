import { logger } from '../../../utils/logger.js';
/**
 * Qwen (Alibaba) Service Provider
 * Qwen models are available via Hugging Face API or Alibaba Cloud
 * This implementation uses Hugging Face Inference API as primary method
 */

import { config } from '../../../config/env.js';
import { LLMResponse, LLMConfig } from './OpenAIService.js';
import { apiKeyProvider } from '../../apiKeyProvider.service.js';

// Get API key from database ONLY (no env fallback for security)
async function getQwenApiKey(): Promise<string> {
  // Try qwen first, then huggingface (both from database)
  const dbKey = await apiKeyProvider.getApiKey('qwen');
  if (dbKey) {
    return dbKey;
  }
  const hfKey = await apiKeyProvider.getApiKey('huggingface');
  if (hfKey) {
    return hfKey;
  }
  throw new Error('Qwen API key not configured. Please add it via Admin Console → Settings → API Keys');
}

export class QwenService {
  private baseURL: string;

  constructor() {
    // Use Hugging Face Inference API by default, or Alibaba Cloud if specified
    this.baseURL = config.qwenApiBaseUrl || 'https://api-inference.huggingface.co/models';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getQwenApiKey();
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
    const apiKey = await getQwenApiKey();

    try {
      // Map Qwen model names to Hugging Face model IDs
      const modelMap: Record<string, string> = {
        'qwen3-max': 'Qwen/Qwen3-Max',
        'qwen3-coder': 'Qwen/Qwen3-Coder',
        'qwen3-omni': 'Qwen/Qwen3-Omni',
        'qwen3-next': 'Qwen/Qwen3-Next',
        'qwen3': 'Qwen/Qwen3'
      };

      const hfModelId = modelMap[model.toLowerCase()] || `Qwen/${model}`;
      const apiUrl = `${this.baseURL}/${hfModelId}`;

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

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: messages.length > 0 
            ? messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
            : prompt,
          parameters: {
            temperature: configOptions?.temperature || 0.7,
            max_new_tokens: configOptions?.maxTokens || 512,
            return_full_text: false
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // Hugging Face API returns different formats
      let text = '';
      if (Array.isArray(data) && data[0]?.generated_text) {
        text = data[0].generated_text;
      } else if (data.generated_text) {
        text = data.generated_text;
      } else if (typeof data === 'string') {
        text = data;
      } else {
        text = JSON.stringify(data);
      }

      // Estimate token usage (rough approximation)
      const promptTokens = Math.ceil(prompt.length / 4);
      const completionTokens = Math.ceil(text.length / 4);

      return {
        text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        }
      };
    } catch (error: any) {
      logger.error('Qwen API error:', error);
      throw new Error(`Qwen API error: ${error.message || 'Unknown error'}`);
    }
  }

  async generateStructuredOutput(
    prompt: string,
    schema: any,
    model: string = 'qwen3-max'
  ): Promise<any> {
    const systemPrompt = `You are a helpful assistant that returns JSON responses matching the provided schema. Always return valid JSON.`;
    
    const result = await this.generateContent(
      `${systemPrompt}\n\nUser request: ${prompt}\n\nReturn a valid JSON response matching this schema: ${JSON.stringify(schema)}`,
      model,
      {
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
   * Generate content as a stream of text chunks.
   * Qwen does not stream here; yields the full text once as a fallback
   * to satisfy the shared provider streaming interface.
   */
  async *generateContentStream(
    prompt: string,
    model: string,
    configOptions?: LLMConfig
  ): AsyncGenerator<string, void, unknown> {
    const result = await this.generateContent(prompt, model, configOptions);
    if (result.text) {
      yield result.text;
    }
  }

}

export const qwenService = new QwenService();

