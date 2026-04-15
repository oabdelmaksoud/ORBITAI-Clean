/**
 * Model Sync Service
 * Fetches latest model data from all LLM providers and syncs with local registry
 */

import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { systemConfigHelpers } from '../models/SystemConfig.model.js';
import { PROVIDER_REGISTRY, getAllModels, getModelsByProvider, getAllProviderIds, ModelRegistryEntry } from '../data/modelRegistry.js';

const SYNC_STATUS_KEY = 'model_sync_status';
const SYNC_RESULTS_KEY = 'model_sync_results';

export interface ProviderModelInfo {
  id: string;
  name: string;
  provider: string;
  modelIdentifier: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  isDeprecated?: boolean;
  deprecationDate?: string;
  capabilities?: {
    vision?: boolean;
    functionCalling?: boolean;
    streaming?: boolean;
    jsonMode?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface SyncResult {
  provider: string;
  success: boolean;
  modelsFound: number;
  modelsAdded: number;
  modelsUpdated: number;
  modelsDisabled: number;
  modelsRemoved: number;
  error?: string;
  models?: ProviderModelInfo[];
}

export interface FullSyncResult {
  timestamp: string;
  totalProviders: number;
  successfulProviders: number;
  failedProviders: number;
  totalModelsFound: number;
  totalModelsAdded: number;
  totalModelsUpdated: number;
  totalModelsDisabled: number;
  totalModelsRemoved: number;
  results: SyncResult[];
}

class ModelSyncService {
  private lastSyncTime: Date | null = null;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Fetch models from OpenAI
   */
  async fetchOpenAIModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'openai',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('openai');
      if (!apiKey) {
        result.error = 'OpenAI API key not configured';
        return result;
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        result.error = `OpenAI API error: ${response.status}`;
        return result;
      }

      const data = await response.json();
      const models = data.data || [];

      // Filter for chat/completion models
      const relevantModels = models.filter((m: any) =>
        m.id.includes('gpt') ||
        m.id.includes('o1') ||
        m.id.includes('o3') ||
        m.id.includes('chatgpt')
      );

      // Known pricing (OpenAI doesn't expose pricing via API)
      const pricingMap: Record<string, { input: number; output: number }> = {
        'gpt-4o': { input: 2.50, output: 10.00 },
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'gpt-4-turbo': { input: 10.00, output: 30.00 },
        'gpt-4': { input: 30.00, output: 60.00 },
        'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
        'o1': { input: 15.00, output: 60.00 },
        'o1-mini': { input: 3.00, output: 12.00 },
        'o1-preview': { input: 15.00, output: 60.00 },
        'o3-mini': { input: 1.10, output: 4.40 },
      };

      result.models = relevantModels.map((m: any) => {
        const pricing = pricingMap[m.id] || { input: 5.00, output: 15.00 };
        return {
          id: `openai-${m.id}`,
          name: m.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          provider: 'openai',
          modelIdentifier: m.id,
          contextWindow: m.id.includes('gpt-4') ? 128000 : 16385,
          maxOutputTokens: m.id.includes('gpt-4') ? 16384 : 4096,
          inputPricePerMillion: pricing.input,
          outputPricePerMillion: pricing.output,
          isDeprecated: false,
          capabilities: {
            vision: m.id.includes('gpt-4') || m.id.includes('o1'),
            functionCalling: !m.id.includes('o1'),
            streaming: true,
            jsonMode: true
          },
          createdAt: new Date(m.created * 1000).toISOString()
        };
      });

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      result.error = error.message;
      logger.error('Failed to fetch OpenAI models:', error);
    }

    return result;
  }

  /**
   * Fetch models from Anthropic
   */
  async fetchAnthropicModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'anthropic',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('anthropic');
      if (!apiKey) {
        result.error = 'Anthropic API key not configured';
        return result;
      }

      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Anthropic may not have a models endpoint, use known models
        result.models = this.getKnownAnthropicModels();
        result.modelsFound = result.models.length;
        result.success = true;
        return result;
      }

      const data = await response.json();
      const models = data.data || [];

      result.models = models.map((m: any) => ({
        id: `anthropic-${m.id}`,
        name: m.display_name || m.id,
        provider: 'anthropic',
        modelIdentifier: m.id,
        contextWindow: m.context_window || 200000,
        maxOutputTokens: m.max_output_tokens || 8192,
        inputPricePerMillion: this.getAnthropicPricing(m.id).input,
        outputPricePerMillion: this.getAnthropicPricing(m.id).output,
        isDeprecated: false,
        capabilities: {
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true
        }
      }));

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      // Use known models as fallback
      result.models = this.getKnownAnthropicModels();
      result.modelsFound = result.models.length;
      result.success = true;
      logger.warn('Using known Anthropic models (API unavailable):', error.message);
    }

    return result;
  }

  private getKnownAnthropicModels(): ProviderModelInfo[] {
    return [
      {
        id: 'anthropic-claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-5-sonnet-20241022',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 3.00,
        outputPricePerMillion: 15.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'anthropic-claude-3-5-haiku',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-5-haiku-20241022',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 1.00,
        outputPricePerMillion: 5.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'anthropic-claude-sonnet-4',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        modelIdentifier: 'claude-sonnet-4-20250514',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 3.00,
        outputPricePerMillion: 15.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'anthropic-claude-opus-4',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        modelIdentifier: 'claude-opus-4-20250514',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 15.00,
        outputPricePerMillion: 75.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'anthropic-claude-3-7-sonnet',
        name: 'Claude 3.7 Sonnet',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-7-sonnet-20250219',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 3.00,
        outputPricePerMillion: 15.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      }
    ];
  }

  private getAnthropicPricing(modelId: string): { input: number; output: number } {
    if (modelId.includes('opus')) return { input: 15.00, output: 75.00 };
    if (modelId.includes('haiku')) return { input: 1.00, output: 5.00 };
    return { input: 3.00, output: 15.00 }; // Sonnet default
  }

  /**
   * Fetch models from Google (Gemini)
   */
  async fetchGeminiModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'gemini',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('gemini');
      if (!apiKey) {
        result.error = 'Gemini API key not configured';
        return result;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

      if (!response.ok) {
        result.error = `Gemini API error: ${response.status}`;
        return result;
      }

      const data = await response.json();
      const models = data.models || [];

      // Filter for generative models
      const generativeModels = models.filter((m: any) =>
        m.supportedGenerationMethods?.includes('generateContent')
      );

      result.models = generativeModels.map((m: any) => {
        const modelId = m.name.replace('models/', '');
        return {
          id: `gemini-${modelId}`,
          name: m.displayName || modelId,
          provider: 'gemini',
          modelIdentifier: modelId,
          description: m.description,
          contextWindow: m.inputTokenLimit || 1000000,
          maxOutputTokens: m.outputTokenLimit || 8192,
          inputPricePerMillion: this.getGeminiPricing(modelId).input,
          outputPricePerMillion: this.getGeminiPricing(modelId).output,
          isDeprecated: false,
          capabilities: {
            vision: m.supportedGenerationMethods?.includes('generateContent'),
            functionCalling: modelId.includes('pro') || modelId.includes('flash'),
            streaming: true,
            jsonMode: true
          }
        };
      });

      // Merge with known models that may not be in the API yet
      const knownModels = this.getKnownGeminiModels();
      const apiModelIds = new Set(result.models?.map(m => m.modelIdentifier) || []);

      // Add known models that aren't in API
      for (const knownModel of knownModels) {
        if (!apiModelIds.has(knownModel.modelIdentifier)) {
          result.models?.push(knownModel);
        }
      }

      result.modelsFound = result.models?.length || 0;
      result.success = true;
    } catch (error: unknown) {
      // Use known models as fallback
      result.models = this.getKnownGeminiModels();
      result.modelsFound = result.models.length;
      result.success = true;
      logger.warn('Using known Gemini models (API unavailable):', error.message);
    }

    return result;
  }

  private getKnownGeminiModels(): ProviderModelInfo[] {
    return [
      {
        id: 'gemini-gemini-3-pro-preview',
        name: 'Gemini 3 Pro Preview',
        provider: 'gemini',
        modelIdentifier: 'gemini-3-pro-preview',
        description: 'Google Gemini 3 Pro - Advanced reasoning and multimodal capabilities',
        contextWindow: 2000000,
        maxOutputTokens: 65536,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 5.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'gemini-gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.5-pro-preview-06-05',
        description: 'Google Gemini 2.5 Pro - High capability reasoning model',
        contextWindow: 1000000,
        maxOutputTokens: 65536,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 5.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'gemini-gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.5-flash',
        description: 'Google Gemini 2.5 Flash - Fast and efficient',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.075,
        outputPricePerMillion: 0.30,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'gemini-gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.0-flash',
        description: 'Google Gemini 2.0 Flash - Experimental multimodal',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.075,
        outputPricePerMillion: 0.30,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'gemini-gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        modelIdentifier: 'gemini-1.5-pro',
        description: 'Google Gemini 1.5 Pro - Long context model',
        contextWindow: 2000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 5.00,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      },
      {
        id: 'gemini-gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-1.5-flash',
        description: 'Google Gemini 1.5 Flash - Fast inference',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.075,
        outputPricePerMillion: 0.30,
        isDeprecated: false,
        capabilities: { vision: true, functionCalling: true, streaming: true, jsonMode: true }
      }
    ];
  }

  private getGeminiPricing(modelId: string): { input: number; output: number } {
    if (modelId.includes('flash')) return { input: 0.075, output: 0.30 };
    if (modelId.includes('pro')) return { input: 1.25, output: 5.00 };
    return { input: 0.50, output: 1.50 };
  }

  /**
   * Fetch models from Groq
   */
  async fetchGroqModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'groq',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('groq');
      if (!apiKey) {
        result.error = 'Groq API key not configured';
        return result;
      }

      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        result.error = `Groq API error: ${response.status}`;
        return result;
      }

      const data = await response.json();
      const models = data.data || [];

      result.models = models.map((m: any) => ({
        id: `groq-${m.id}`,
        name: m.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        provider: 'groq',
        modelIdentifier: m.id,
        contextWindow: m.context_window || 8192,
        maxOutputTokens: 8192,
        inputPricePerMillion: this.getGroqPricing(m.id).input,
        outputPricePerMillion: this.getGroqPricing(m.id).output,
        isDeprecated: false,
        capabilities: {
          vision: m.id.includes('vision'),
          functionCalling: true,
          streaming: true,
          jsonMode: true
        },
        createdAt: new Date(m.created * 1000).toISOString()
      }));

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      result.error = error.message;
      logger.error('Failed to fetch Groq models:', error);
    }

    return result;
  }

  private getGroqPricing(modelId: string): { input: number; output: number } {
    if (modelId.includes('llama-3.3-70b')) return { input: 0.59, output: 0.79 };
    if (modelId.includes('llama-3.1-8b')) return { input: 0.05, output: 0.08 };
    if (modelId.includes('mixtral')) return { input: 0.24, output: 0.24 };
    if (modelId.includes('gemma')) return { input: 0.10, output: 0.10 };
    return { input: 0.20, output: 0.20 };
  }

  /**
   * Fetch models from Mistral
   */
  async fetchMistralModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'mistral',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('mistral');
      if (!apiKey) {
        result.error = 'Mistral API key not configured';
        return result;
      }

      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        result.error = `Mistral API error: ${response.status}`;
        return result;
      }

      const data = await response.json();
      const models = data.data || [];

      result.models = models.map((m: any) => ({
        id: `mistral-${m.id}`,
        name: m.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        provider: 'mistral',
        modelIdentifier: m.id,
        contextWindow: m.max_context_length || 32000,
        maxOutputTokens: 8192,
        inputPricePerMillion: this.getMistralPricing(m.id).input,
        outputPricePerMillion: this.getMistralPricing(m.id).output,
        isDeprecated: m.deprecation ? true : false,
        deprecationDate: m.deprecation,
        capabilities: {
          vision: m.capabilities?.vision || false,
          functionCalling: m.capabilities?.function_calling || true,
          streaming: true,
          jsonMode: true
        },
        createdAt: new Date(m.created * 1000).toISOString()
      }));

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      result.error = error.message;
      logger.error('Failed to fetch Mistral models:', error);
    }

    return result;
  }

  private getMistralPricing(modelId: string): { input: number; output: number } {
    if (modelId.includes('large')) return { input: 2.00, output: 6.00 };
    if (modelId.includes('medium')) return { input: 2.70, output: 8.10 };
    if (modelId.includes('small')) return { input: 0.20, output: 0.60 };
    if (modelId.includes('codestral')) return { input: 0.20, output: 0.60 };
    return { input: 1.00, output: 3.00 };
  }

  /**
   * Fetch models from DeepSeek (OpenAI-compatible API)
   */
  async fetchDeepSeekModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'deepseek',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('deepseek');
      if (!apiKey) {
        result.error = 'DeepSeek API key not configured';
        return result;
      }

      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        result.error = `DeepSeek API error: ${response.status}`;
        return result;
      }

      const data = await response.json();
      const models = data.data || [];

      // Filter for chat/completion models
      const relevantModels = models.filter((m: any) =>
        m.id && (m.id.includes('deepseek-chat') || m.id.includes('deepseek-coder') || m.id.includes('deepseek-v'))
      );

      // Known pricing for DeepSeek models
      const pricingMap: Record<string, { input: number; output: number }> = {
        'deepseek-chat': { input: 0.14, output: 0.28 },
        'deepseek-coder': { input: 0.14, output: 0.28 },
        'deepseek-v2': { input: 0.14, output: 0.28 },
        'deepseek-v3': { input: 0.14, output: 0.28 }
      };

      result.models = relevantModels.map((m: any) => {
        const modelId = m.id;
        const pricing = pricingMap[modelId] || { input: 0.14, output: 0.28 };

        return {
          id: `deepseek-${modelId}`,
          name: m.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          provider: 'deepseek',
          modelIdentifier: modelId,
          description: `DeepSeek ${modelId}`,
          contextWindow: 64000, // DeepSeek models typically have 64K context
          maxOutputTokens: 8192,
          inputPricePerMillion: pricing.input,
          outputPricePerMillion: pricing.output,
          capabilities: {
            vision: modelId.includes('v2') || modelId.includes('v3'),
            functionCalling: true,
            streaming: true,
            jsonMode: true
          },
          createdAt: m.created ? new Date(m.created * 1000).toISOString() : undefined
        };
      });

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      result.error = error.message;
      logger.error('Failed to fetch DeepSeek models:', error);
    }

    return result;
  }

  /**
   * Fetch models from Cohere
   */
  async fetchCohereModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'cohere',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('cohere' as any);
      if (!apiKey) {
        result.error = 'Cohere API key not configured';
        return result;
      }

      // Cohere doesn't have a public models endpoint, use known models
      const knownModels = [
        { id: 'command', name: 'Command', contextWindow: 128000 },
        { id: 'command-r', name: 'Command R', contextWindow: 128000 },
        { id: 'command-r-plus', name: 'Command R+', contextWindow: 128000 }
      ];

      result.models = knownModels.map(m => ({
        id: `cohere-${m.id}`,
        name: m.name,
        provider: 'cohere',
        modelIdentifier: m.id,
        description: `Cohere ${m.name}`,
        contextWindow: m.contextWindow,
        maxOutputTokens: 4096,
        inputPricePerMillion: 1.00, // Approximate
        outputPricePerMillion: 3.00,
        capabilities: {
          vision: false,
          functionCalling: true,
          streaming: true,
          jsonMode: true
        }
      }));

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      result.error = error.message;
      logger.error('Failed to fetch Cohere models:', error);
    }

    return result;
  }

  /**
   * Fetch models from Together AI
   */
  async fetchTogetherModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'together',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('together' as any);
      if (!apiKey) {
        result.error = 'Together AI API key not configured';
        return result;
      }

      const response = await fetch('https://api.together.xyz/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        result.error = `Together AI API error: ${response.status}`;
        return result;
      }

      const data = await response.json();
      const models = data.data || [];

      // Filter for chat/completion models
      const relevantModels = models.filter((m: any) =>
        m.id && !m.id.includes('embedding') && !m.id.includes('rerank')
      );

      result.models = relevantModels.map((m: any) => ({
        id: `together-${m.id}`,
        name: m.name || m.id,
        provider: 'together',
        modelIdentifier: m.id,
        description: m.description || `Together AI: ${m.id}`,
        contextWindow: m.context_length || 8192,
        maxOutputTokens: m.context_length ? Math.floor(m.context_length * 0.75) : 4096,
        capabilities: {
          vision: m.architecture?.modalities?.includes('vision') || false,
          functionCalling: false,
          streaming: true,
          jsonMode: false
        }
      }));

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      result.error = error.message;
      logger.error('Failed to fetch Together AI models:', error);
    }

    return result;
  }

  /**
   * Discover new providers from OpenRouter (if API key is configured)
   */
  private async discoverProvidersFromOpenRouter(): Promise<string[]> {
    try {
      const apiKey = await apiKeyProvider.getApiKey('openrouter');
      if (!apiKey) {
        return [];
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'OrbitAI'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const models = data.data || [];

      // Extract unique providers from model IDs
      const discoveredProviders = new Set<string>();
      models.forEach((m: any) => {
        if (m.id && typeof m.id === 'string') {
          // Extract provider from model ID (e.g., "openai/gpt-4" -> "openai")
          const parts = m.id.split('/');
          if (parts.length > 1) {
            const provider = parts[0].toLowerCase();
            // Map common provider names
            const providerMap: Record<string, string> = {
              'openai': 'openai',
              'anthropic': 'anthropic',
              'google': 'gemini',
              'google-gemini': 'gemini',
              'meta': 'meta',
              'mistralai': 'mistral',
              'mistral': 'mistral',
              'deepseek': 'deepseek',
              'cohere': 'cohere',
              'togethercomputer': 'together',
              'together': 'together',
              'perplexity': 'perplexity',
              'fireworks': 'fireworks',
              'x-ai': 'grok',
              'xai': 'grok',
              'qwen': 'qwen',
              'ai21': 'ai21'
            };

            const mappedProvider = providerMap[provider] || provider;
            if (mappedProvider && mappedProvider !== 'openrouter') {
              discoveredProviders.add(mappedProvider);
            }
          }
        }
      });

      return Array.from(discoveredProviders);
    } catch (error) {
      logger.warn('Failed to discover providers from OpenRouter:', error);
      return [];
    }
  }

  /**
   * Get list of providers that have API keys configured and support model syncing
   * Also discovers new providers from OpenRouter
   */
  private async getConfiguredProviders(): Promise<Array<{ name: string; fetchMethod: () => Promise<SyncResult> }>> {
    const providers: Array<{ name: string; fetchMethod: () => Promise<SyncResult> }> = [];

    // Check each provider for API key and add to list if configured
    const providerChecks = [
      { name: 'openai', hasKey: await apiKeyProvider.hasApiKey('openai'), fetch: () => this.fetchOpenAIModels() },
      { name: 'anthropic', hasKey: await apiKeyProvider.hasApiKey('anthropic'), fetch: () => this.fetchAnthropicModels() },
      { name: 'gemini', hasKey: await apiKeyProvider.hasApiKey('gemini'), fetch: () => this.fetchGeminiModels() },
      { name: 'groq', hasKey: await apiKeyProvider.hasApiKey('groq'), fetch: () => this.fetchGroqModels() },
      { name: 'mistral', hasKey: await apiKeyProvider.hasApiKey('mistral'), fetch: () => this.fetchMistralModels() },
      { name: 'openrouter', hasKey: await apiKeyProvider.hasApiKey('openrouter'), fetch: () => this.fetchOpenRouterModels() },
      { name: 'deepseek', hasKey: await apiKeyProvider.hasApiKey('deepseek'), fetch: () => this.fetchDeepSeekModels() },
      { name: 'cohere', hasKey: await apiKeyProvider.hasApiKey('cohere' as any), fetch: () => this.fetchCohereModels() },
      { name: 'together', hasKey: await apiKeyProvider.hasApiKey('together' as any), fetch: () => this.fetchTogetherModels() }
    ];

    // Add providers with API keys
    for (const check of providerChecks) {
      if (check.hasKey) {
        providers.push({ name: check.name, fetchMethod: check.fetch });
      }
    }

    // Discover new providers from OpenRouter
    const discoveredProviders = await this.discoverProvidersFromOpenRouter();
    const existingProviderNames = new Set(providers.map(p => p.name));

    // Also check for API keys that exist but we haven't synced yet
    const allPossibleProviders: Array<{ name: string; apiKeyName: string }> = [
      { name: 'qwen', apiKeyName: 'qwen' },
      { name: 'grok', apiKeyName: 'grok' },
      { name: 'perplexity', apiKeyName: 'perplexity' },
      { name: 'fireworks', apiKeyName: 'fireworks' },
      { name: 'ai21', apiKeyName: 'ai21' }
    ];

    for (const possibleProvider of allPossibleProviders) {
      if (!existingProviderNames.has(possibleProvider.name)) {
        const hasKey = await apiKeyProvider.hasApiKey(possibleProvider.apiKeyName as any);
        if (hasKey) {
          logger.info(`Found API key for ${possibleProvider.name} but no sync method available yet`);
        }
      }
    }

    // Log discovered providers for future implementation
    const newProviders = discoveredProviders.filter(p => !existingProviderNames.has(p));
    if (newProviders.length > 0) {
      logger.info(`Discovered ${newProviders.length} new providers from OpenRouter: ${newProviders.join(', ')}`);
      // Note: These providers are discovered but not yet synced (would need fetch methods)
    }

    return providers;
  }

  /**
   * Fetch models from OpenRouter
   */
  async fetchOpenRouterModels(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'openrouter',
      success: false,
      modelsFound: 0,
      modelsAdded: 0,
      modelsUpdated: 0,
      modelsDisabled: 0,
      modelsRemoved: 0,
      models: []
    };

    try {
      const apiKey = await apiKeyProvider.getApiKey('openrouter');
      if (!apiKey) {
        result.error = 'OpenRouter API key not configured';
        return result;
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'OrbitAI'
        }
      });

      if (!response.ok) {
        result.error = `OpenRouter API error: ${response.status}`;
        return result;
      }

      const data = await response.json();
      const models = data.data || [];

      // Filter for relevant models (exclude embedding/rerank models, focus on chat/completion)
      const relevantModels = models.filter((m: any) =>
        m.id &&
        !m.id.includes('embedding') &&
        !m.id.includes('rerank') &&
        !m.id.includes('moderation') &&
        (m.id.includes('gpt') || m.id.includes('claude') || m.id.includes('gemini') ||
          m.id.includes('llama') || m.id.includes('mistral') || m.id.includes('deepseek') ||
          m.id.includes('qwen') || m.id.includes('grok') || m.id.includes('o1') || m.id.includes('o3'))
      );

      result.models = relevantModels.map((m: any) => ({
        id: `openrouter-${m.id}`,
        name: m.name || m.id,
        provider: 'openrouter',
        modelIdentifier: m.id,
        description: m.description || `OpenRouter: ${m.id}`,
        contextWindow: m.context_length || 8192,
        maxOutputTokens: m.context_length ? Math.floor(m.context_length * 0.75) : 4096,
        inputPricePerMillion: m.pricing?.prompt ? m.pricing.prompt * 1000000 : undefined,
        outputPricePerMillion: m.pricing?.completion ? m.pricing.completion * 1000000 : undefined,
        capabilities: {
          vision: m.architecture?.modalities?.includes('vision') || false,
          functionCalling: m.architecture?.modalities?.includes('function_calling') || false,
          streaming: true,
          jsonMode: m.architecture?.modalities?.includes('json') || false
        },
        createdAt: m.created ? new Date(m.created).toISOString() : undefined
      }));

      result.modelsFound = result.models.length;
      result.success = true;
    } catch (error: unknown) {
      result.error = error.message;
      logger.error('Failed to fetch OpenRouter models:', error);
    }

    return result;
  }

  /**
   * Sync all providers - dynamically discovers providers with API keys configured
   */
  async syncAllProviders(): Promise<FullSyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = new Date();

    const fullResult: FullSyncResult = {
      timestamp: startTime.toISOString(),
      totalProviders: 0,
      successfulProviders: 0,
      failedProviders: 0,
      totalModelsFound: 0,
      totalModelsAdded: 0,
      totalModelsUpdated: 0,
      totalModelsDisabled: 0,
      totalModelsRemoved: 0,
      results: []
    };

    try {
      logger.info('Starting full model sync from all providers...');

      // Discover providers with API keys configured
      const configuredProviders = await this.getConfiguredProviders();

      if (configuredProviders.length === 0) {
        logger.warn('No providers with API keys configured. Please configure API keys via Admin Console → Settings → API Keys');
        fullResult.results = [];
        return fullResult;
      }

      logger.info(`Found ${configuredProviders.length} providers with API keys: ${configuredProviders.map(p => p.name).join(', ')}`);

      // Fetch from all configured providers in parallel
      const syncPromises = configuredProviders.map(provider =>
        Promise.allSettled([provider.fetchMethod()]).then(([result]) => ({
          provider: provider.name,
          result: result.status === 'fulfilled'
            ? result.value
            : {
              provider: provider.name,
              success: false,
              modelsFound: 0,
              modelsAdded: 0,
              modelsUpdated: 0,
              modelsDisabled: 0,
              modelsRemoved: 0,
              error: (result as PromiseRejectedResult).reason?.message || 'Unknown error'
            }
        }))
      );

      const results = await Promise.all(syncPromises);
      const syncResults = results.map(r => r.result);

      fullResult.results = syncResults;
      fullResult.totalProviders = syncResults.length;
      fullResult.successfulProviders = syncResults.filter(r => r.success).length;
      fullResult.failedProviders = syncResults.filter(r => !r.success).length;
      fullResult.totalModelsFound = syncResults.reduce((sum, r) => sum + r.modelsFound, 0);
      fullResult.totalModelsAdded = syncResults.reduce((sum, r) => sum + r.modelsAdded, 0);
      fullResult.totalModelsUpdated = syncResults.reduce((sum, r) => sum + r.modelsUpdated, 0);
      fullResult.totalModelsDisabled = syncResults.reduce((sum, r) => sum + r.modelsDisabled, 0);
      fullResult.totalModelsRemoved = syncResults.reduce((sum, r) => sum + (r.modelsRemoved || 0), 0);

      this.lastSyncTime = new Date();

      // Persist sync status to database
      await this.persistSyncStatus();

      // Persist full sync results to database
      await this.persistSyncResults(fullResult);

      logger.info(`Model sync completed: ${fullResult.totalModelsFound} models found from ${fullResult.successfulProviders}/${fullResult.totalProviders} providers`);

    } catch (error: unknown) {
      logger.error('Model sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }

    return fullResult;
  }

  /**
   * Persist sync status to database
   */
  private async persistSyncStatus(): Promise<void> {
    try {
      await systemConfigHelpers.set(SYNC_STATUS_KEY, {
        lastSyncTime: this.lastSyncTime?.toISOString() || null,
        isSyncing: this.isSyncing
      }, 'Last model sync status');
    } catch (error) {
      logger.error('Failed to persist sync status:', error);
    }
  }

  /**
   * Persist full sync results to database
   */
  private async persistSyncResults(results: FullSyncResult): Promise<void> {
    try {
      await systemConfigHelpers.set(SYNC_RESULTS_KEY, results, 'Last full model sync results');
      logger.info('Sync results persisted to database');
    } catch (error) {
      logger.error('Failed to persist sync results:', error);
    }
  }

  /**
   * Get last sync results from database
   */
  async getLastSyncResults(): Promise<FullSyncResult | null> {
    try {
      const results = await systemConfigHelpers.get(SYNC_RESULTS_KEY);
      return results as FullSyncResult | null;
    } catch (error) {
      logger.error('Failed to load sync results:', error);
      return null;
    }
  }

  /**
   * Load sync status from database
   */
  async loadSyncStatus(): Promise<void> {
    try {
      const status = await systemConfigHelpers.get(SYNC_STATUS_KEY);
      if (status?.lastSyncTime) {
        this.lastSyncTime = new Date(status.lastSyncTime);
        logger.info(`Loaded last sync time: ${this.lastSyncTime.toISOString()}`);
      }
    } catch (error) {
      logger.error('Failed to load sync status:', error);
    }
  }

  /**
   * Get sync status (async version that loads from DB if not in memory)
   */
  async getSyncStatusAsync(): Promise<{ isSyncing: boolean; lastSyncTime: string | null }> {
    // If we don't have lastSyncTime in memory, try to load from DB
    if (!this.lastSyncTime) {
      await this.loadSyncStatus();
    }
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime?.toISOString() || null
    };
  }

  /**
   * Get sync status (sync version for backwards compatibility)
   */
  getSyncStatus(): { isSyncing: boolean; lastSyncTime: string | null } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime?.toISOString() || null
    };
  }

  /**
   * Start monthly sync scheduler
   */
  startMonthlySync(): void {
    if (this.syncInterval) {
      logger.warn('Monthly sync already scheduled');
      return;
    }

    // Check every 24 hours if it's time for monthly sync
    const DAILY_CHECK_MS = 24 * 60 * 60 * 1000; // 24 hours

    const checkAndSync = async () => {
      const now = new Date();
      // Run on the 1st of each month between 3-4 AM
      if (now.getDate() === 1 && now.getHours() >= 3 && now.getHours() < 4) {
        // Check if we already synced today
        const lastSync = this.lastSyncTime;
        if (!lastSync || lastSync.getDate() !== now.getDate() || lastSync.getMonth() !== now.getMonth()) {
          try {
            logger.info('Running scheduled monthly model sync...');
            await this.syncAllProviders();
          } catch (error) {
            logger.error('Scheduled model sync failed:', error);
          }
        }
      }
    };

    // Run check every 24 hours
    this.syncInterval = setInterval(checkAndSync, DAILY_CHECK_MS);

    logger.info('Monthly model sync scheduler started (checks daily)');
  }

  /**
   * Stop monthly sync scheduler
   */
  stopMonthlySync(): void {
    if (this.syncInterval) {
      clearTimeout(this.syncInterval);
      this.syncInterval = null;
      logger.info('Monthly model sync scheduler stopped');
    }
  }

  /**
   * Get public model registry - all known models without needing API keys
   * This provides fallback data when providers are not configured
   */
  getPublicModelRegistry(): { providers: typeof PROVIDER_REGISTRY; models: ModelRegistryEntry[] } {
    return {
      providers: PROVIDER_REGISTRY,
      models: getAllModels()
    };
  }

  /**
   * Get registry models for a specific provider (fallback data)
   */
  getRegistryModelsForProvider(providerId: string): ModelRegistryEntry[] {
    return getModelsByProvider(providerId);
  }

  /**
   * Get all known provider IDs from the registry
   */
  getKnownProviderIds(): string[] {
    return getAllProviderIds();
  }

  /**
   * Discover new providers from OpenRouter public API (no auth required)
   * Compares against known providers and returns newly discovered ones
   */
  async discoverNewProviders(): Promise<{
    knownProviders: string[];
    discoveredProviders: string[];
    newProviders: string[];
  }> {
    const knownProviders = getAllProviderIds();
    const discoveredProviders: string[] = [];

    try {
      // OpenRouter's model list is public (no auth required for basic info)
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'OrbitAI'
        }
      });

      if (response.ok) {
        const data = await response.json() as { data?: Array<{ id?: string }> };
        const models = data.data || [];

        // Extract unique providers from model IDs
        const providerSet = new Set<string>();
        models.forEach((m: { id?: string }) => {
          if (m.id && typeof m.id === 'string') {
            const parts = m.id.split('/');
            if (parts.length > 1) {
              const provider = parts[0].toLowerCase();
              // Map common provider names
              const providerMap: Record<string, string> = {
                'openai': 'openai',
                'anthropic': 'anthropic',
                'google': 'gemini',
                'google-gemini': 'gemini',
                'meta': 'meta',
                'meta-llama': 'meta',
                'mistralai': 'mistral',
                'mistral': 'mistral',
                'deepseek': 'deepseek',
                'cohere': 'cohere',
                'togethercomputer': 'together',
                'together': 'together',
                'perplexity': 'perplexity',
                'fireworks': 'fireworks',
                'x-ai': 'grok',
                'xai': 'grok',
                'qwen': 'qwen',
                'alibaba': 'qwen',
                'ai21': 'ai21',
                'amazon': 'amazon',
                'microsoft': 'microsoft'
              };

              const mappedProvider = providerMap[provider] || provider;
              if (mappedProvider && mappedProvider !== 'openrouter') {
                providerSet.add(mappedProvider);
              }
            }
          }
        });

        discoveredProviders.push(...Array.from(providerSet));
      }
    } catch (error) {
      logger.warn('Failed to discover providers from OpenRouter:', error);
    }

    // Find providers that are discovered but not in our known list
    const newProviders = discoveredProviders.filter(p => !knownProviders.includes(p));

    if (newProviders.length > 0) {
      logger.info(`Discovered ${newProviders.length} new providers: ${newProviders.join(', ')}`);
    }

    return {
      knownProviders,
      discoveredProviders,
      newProviders
    };
  }

  /**
   * Get models with fallback to registry if API key not configured
   * Returns live data if available, otherwise returns registry data
   */
  async getModelsWithFallback(providerId: string): Promise<{
    models: ProviderModelInfo[];
    source: 'live' | 'registry';
    hasApiKey: boolean;
  }> {
    const hasApiKey = await apiKeyProvider.hasApiKey(providerId as any);

    if (hasApiKey) {
      // Try to get live data
      try {
        const syncResult = await this.syncProvider(providerId);
        if (syncResult.success && syncResult.models && syncResult.models.length > 0) {
          return {
            models: syncResult.models,
            source: 'live',
            hasApiKey: true
          };
        }
      } catch (error) {
        logger.warn(`Failed to get live models for ${providerId}, falling back to registry:`, error);
      }
    }

    // Fall back to registry
    const registryModels = getModelsByProvider(providerId);
    const models: ProviderModelInfo[] = registryModels.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      modelIdentifier: m.modelIdentifier,
      description: m.description,
      contextWindow: m.contextWindow,
      maxOutputTokens: m.maxOutputTokens,
      inputPricePerMillion: m.inputPricePerMillion,
      outputPricePerMillion: m.outputPricePerMillion,
      isDeprecated: m.isDeprecated,
      deprecationDate: m.deprecationDate,
      capabilities: {
        vision: m.capabilities.vision,
        functionCalling: m.capabilities.functionCalling,
        streaming: m.capabilities.streaming,
        jsonMode: m.capabilities.jsonMode
      }
    }));

    return {
      models,
      source: 'registry',
      hasApiKey
    };
  }

  /**
   * Sync a single provider by name
   */
  async syncProvider(providerId: string): Promise<SyncResult> {
    const fetchMethods: Record<string, () => Promise<SyncResult>> = {
      'openai': () => this.fetchOpenAIModels(),
      'anthropic': () => this.fetchAnthropicModels(),
      'gemini': () => this.fetchGeminiModels(),
      'groq': () => this.fetchGroqModels(),
      'mistral': () => this.fetchMistralModels(),
      'openrouter': () => this.fetchOpenRouterModels(),
      'deepseek': () => this.fetchDeepSeekModels(),
      'cohere': () => this.fetchCohereModels(),
      'together': () => this.fetchTogetherModels()
    };

    const fetchMethod = fetchMethods[providerId.toLowerCase()];
    if (!fetchMethod) {
      return {
        provider: providerId,
        success: false,
        modelsFound: 0,
        modelsAdded: 0,
        modelsUpdated: 0,
        modelsDisabled: 0,
        modelsRemoved: 0,
        error: `No sync method available for provider: ${providerId}`
      };
    }

    return fetchMethod();
  }
}

export const modelSyncService = new ModelSyncService();

