/**
 * Model Registry - Central registry of all available LLMs with their capabilities
 */

import { logger } from '../../../utils/logger.js';
import { toApiError } from '../../../errors/ApiError.js';

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'custom' | 'ollama' | 'vllm' | 'openai_compatible';
export type TaskComplexity = 'simple' | 'moderate' | 'complex';

export interface ModelCapabilities {
  id: string;
  name: string;
  provider: LLMProvider;
  modelIdentifier: string; // e.g., 'gpt-4o', 'claude-3-5-sonnet'

  capabilities: {
    structuredOutput: boolean;
    codeGeneration: boolean;
    longContext: boolean;
    fastResponse: boolean;
    streaming: boolean;
    functionCalling: boolean; // Support for tools/function calling
  };

  limits: {
    maxTokens: number;
    maxContextLength: number;
    maxOutputTokens?: number;
  };

  pricing: {
    inputCostPer1MTokens: number;  // Cost per 1M input tokens
    outputCostPer1MTokens: number; // Cost per 1M output tokens
  };

  performance: {
    avgLatencyMs: number;
    reliability: number; // 0-1 score
  };

  recommendedFor: {
    agentRoles: string[];
    taskTypes: string[];
    complexity: TaskComplexity[];
  };

  status: 'active' | 'maintenance' | 'deprecated';
  isEnabled: boolean; // Can be toggled in admin
}

export class ModelRegistry {
  private models: Map<string, ModelCapabilities>;
  private userModels: Map<string, Map<string, ModelCapabilities>>; // userId -> modelId -> model
  private initialized: boolean = false;

  constructor() {
    this.models = new Map();
    this.userModels = new Map();
    this.initializeDefaultModels();
  }

  private initializeDefaultModels(): void {
    const defaultModels: ModelCapabilities[] = [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.5-flash',
        capabilities: {
          structuredOutput: false,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: false // gemini-2.5-flash doesn't support function calling (use Gemini 3 Pro or 2.5 Pro for function calling)
        },
        limits: {
          maxTokens: 1000000,
          maxContextLength: 1000000
        },
        pricing: {
          inputCostPer1MTokens: 0.075,
          outputCostPer1MTokens: 0.30
        },
        performance: {
          avgLatencyMs: 200,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Orchestrator'],
          taskTypes: ['chat', 'conversation', 'prompt-enhancement'],
          complexity: ['simple']
        },
        status: 'active',
        isEnabled: true
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'gemini',
        modelIdentifier: 'gemini-2.5-pro',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Gemini 2.5 Pro supports function calling
        },
        limits: {
          maxTokens: 1000000,
          maxContextLength: 1000000
        },
        pricing: {
          inputCostPer1MTokens: 1.25, // Updated 2025 pricing
          outputCostPer1MTokens: 5.00
        },
        performance: {
          avgLatencyMs: 1200,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Design/Architecture Agent', 'QA/Audit Agent', 'Implementation Agent'],
          taskTypes: ['structured-output', 'analysis', 'documentation', 'multimodal', 'code-generation'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key (alternative to Gemini 3 Pro)
      },
      {
        id: 'gemini-3-pro',
        name: 'Gemini 3 Pro',
        provider: 'gemini',
        modelIdentifier: 'gemini-3-pro-preview',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // gemini-3-pro supports function calling
        },
        limits: {
          maxTokens: 2000000,
          maxContextLength: 2000000
        },
        pricing: {
          inputCostPer1MTokens: 1.25, // Updated: Current rate as of 2025
          outputCostPer1MTokens: 5.00 // Updated: Current rate as of 2025
        },
        performance: {
          avgLatencyMs: 1500,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Design/Architecture Agent', 'QA/Audit Agent', 'Integration Agent', 'Test Agent'],
          taskTypes: ['structured-output', 'analysis', 'documentation', 'project-preview'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: true
      },
      {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        provider: 'gemini',
        modelIdentifier: 'gemini-3-flash-preview',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 1000000,
          maxContextLength: 1000000
        },
        pricing: {
          inputCostPer1MTokens: 0.10,
          outputCostPer1MTokens: 0.40
        },
        performance: {
          avgLatencyMs: 300,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'Implementation Agent'],
          taskTypes: ['code-generation', 'chat', 'real-time-assistants'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: true
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        modelIdentifier: 'gpt-4o',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // GPT-4o supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 2.50,
          outputCostPer1MTokens: 10.00
        },
        performance: {
          avgLatencyMs: 1200,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'UX Designer', 'Design/Architecture Agent'],
          taskTypes: ['code-generation', 'creative', 'analysis'],
          complexity: ['complex']
        },
        status: 'active',
        isEnabled: false // Requires API key
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        modelIdentifier: 'gpt-4o-mini',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true // GPT-4o Mini supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.15,
          outputCostPer1MTokens: 0.60
        },
        performance: {
          avgLatencyMs: 400,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Orchestrator'],
          taskTypes: ['chat', 'simple-tasks'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: false // Requires API key
      },
      {
        id: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-5-sonnet-latest',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Claude 3.5 Sonnet supports function calling
        },
        limits: {
          maxTokens: 200000,
          maxContextLength: 200000
        },
        pricing: {
          inputCostPer1MTokens: 3.00,
          outputCostPer1MTokens: 15.00
        },
        performance: {
          avgLatencyMs: 1800,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'UX Designer', 'Design/Architecture Agent'],
          taskTypes: ['documentation', 'long-context', 'writing', 'analysis', 'code-generation'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key (Claude 4.5 Sonnet recommended for new projects)
      },
      {
        id: 'claude-opus-4',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        modelIdentifier: 'claude-opus-4-20250514',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Claude Opus 4 supports function calling
        },
        limits: {
          maxTokens: 200000,
          maxContextLength: 200000
        },
        pricing: {
          inputCostPer1MTokens: 15.00,
          outputCostPer1MTokens: 75.00
        },
        performance: {
          avgLatencyMs: 2000,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Implementation Agent', 'Design/Architecture Agent', 'QA/Audit Agent'],
          taskTypes: ['code-generation', 'analysis', 'reasoning', 'complex-problem-solving'],
          complexity: ['complex']
        },
        status: 'active',
        isEnabled: false // Requires API key - Premium pricing for advanced reasoning
      },
      {
        id: 'claude-haiku-4.5',
        name: 'Claude Haiku 4.5',
        provider: 'anthropic',
        modelIdentifier: 'claude-3-5-haiku-20241022',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true // Claude Haiku 4.5 supports function calling
        },
        limits: {
          maxTokens: 200000,
          maxContextLength: 200000
        },
        pricing: {
          inputCostPer1MTokens: 1.00,
          outputCostPer1MTokens: 5.00
        },
        performance: {
          avgLatencyMs: 600,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'UX Designer', 'Requirements Agent'],
          taskTypes: ['real-time-assistants', 'customer-support', 'parallel-sub-agents', 'code-generation'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: false // Requires API key - Cost-effective for real-time applications
      },
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        modelIdentifier: 'deepseek-chat',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true // DeepSeek Chat supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.14,
          outputCostPer1MTokens: 0.28
        },
        performance: {
          avgLatencyMs: 600,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'Design/Architecture Agent', 'Requirements Agent'],
          taskTypes: ['code-generation', 'documentation', 'analysis', 'long-context'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key (DeepSeek-R1 is free alternative)
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        provider: 'deepseek',
        modelIdentifier: 'deepseek-coder',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true // DeepSeek Coder supports function calling
        },
        limits: {
          maxTokens: 16384,
          maxContextLength: 16384
        },
        pricing: {
          inputCostPer1MTokens: 0.14,
          outputCostPer1MTokens: 0.28
        },
        performance: {
          avgLatencyMs: 500,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent'],
          taskTypes: ['code-generation'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key
      },
      {
        id: 'claude-4.5-sonnet',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        modelIdentifier: 'claude-sonnet-4-20250514',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Claude 4.5 supports function calling
        },
        limits: {
          maxTokens: 1000000,
          maxContextLength: 1000000 // 1M tokens
        },
        pricing: {
          inputCostPer1MTokens: 3.00, // $3-$15 range, using base
          outputCostPer1MTokens: 15.00
        },
        performance: {
          avgLatencyMs: 1500,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Implementation Agent', 'Design/Architecture Agent', 'QA/Audit Agent', 'Integration Agent'],
          taskTypes: ['code-generation', 'documentation', 'analysis', 'structured-output', 'long-context', 'multimodal'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key
      },
      {
        id: 'gpt-5',
        name: 'GPT-5',
        provider: 'openai',
        modelIdentifier: 'gpt-5', // ⚠️ GPT-5 may not be released yet (Jan 2025) - verify availability
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // GPT-5 supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 20.00, // Premium pricing
          outputCostPer1MTokens: 60.00
        },
        performance: {
          avgLatencyMs: 1400,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'Design/Architecture Agent', 'UX Designer', 'QA/Audit Agent'],
          taskTypes: ['code-generation', 'analysis', 'creative', 'multimodal'],
          complexity: ['complex']
        },
        status: 'maintenance', // Model may not be released yet - verify with OpenAI
        isEnabled: false // Disabled until model is confirmed available
      },
      // OpenRouter Models (300+ models via unified API)
      {
        id: 'openrouter-gpt-5',
        name: 'GPT-5 (via OpenRouter)',
        provider: 'openrouter',
        modelIdentifier: 'openai/gpt-5',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 20.00,
          outputCostPer1MTokens: 60.00
        },
        performance: {
          avgLatencyMs: 1400,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'Design/Architecture Agent', 'QA/Audit Agent'],
          taskTypes: ['code-generation', 'analysis', 'creative', 'multimodal'],
          complexity: ['complex']
        },
        status: 'maintenance', // Verify model availability
        isEnabled: false
      },
      {
        id: 'openrouter-llama-3.3-70b',
        name: 'Llama 3.3 70B (via OpenRouter)',
        provider: 'openrouter',
        modelIdentifier: 'meta-llama/llama-3.3-70b-instruct',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.59,
          outputCostPer1MTokens: 0.79
        },
        performance: {
          avgLatencyMs: 800,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Implementation Agent', 'Design/Architecture Agent'],
          taskTypes: ['code-generation', 'documentation', 'analysis'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false
      },
      {
        id: 'openrouter-deepseek-v3',
        name: 'DeepSeek V3 (via OpenRouter)',
        provider: 'openrouter',
        modelIdentifier: 'deepseek/deepseek-v3',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.14,
          outputCostPer1MTokens: 0.28
        },
        performance: {
          avgLatencyMs: 600,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'Design/Architecture Agent'],
          taskTypes: ['code-generation', 'documentation', 'analysis'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false
      },
      // Groq Models (ultra-fast inference)
      {
        id: 'groq-llama-3.3-70b',
        name: 'Llama 3.3 70B (Groq)',
        provider: 'groq',
        modelIdentifier: 'llama-3.3-70b-versatile',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.59,
          outputCostPer1MTokens: 0.79
        },
        performance: {
          avgLatencyMs: 200, // Ultra-fast with Groq
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'Requirements Agent', 'Implementation Agent'],
          taskTypes: ['real-time-assistants', 'code-generation', 'analysis'],
          complexity: ['simple', 'moderate', 'complex']
        },
        status: 'active',
        isEnabled: false
      },
      {
        id: 'groq-llama-3.1-8b',
        name: 'Llama 3.1 8B (Groq)',
        provider: 'groq',
        modelIdentifier: 'llama-3.1-8b-instant',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: false,
          fastResponse: true,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 8192,
          maxContextLength: 8192
        },
        pricing: {
          inputCostPer1MTokens: 0.05,
          outputCostPer1MTokens: 0.08
        },
        performance: {
          avgLatencyMs: 100, // Extremely fast
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Orchestrator'],
          taskTypes: ['real-time-assistants', 'simple-tasks', 'chat'],
          complexity: ['simple']
        },
        status: 'active',
        isEnabled: false
      },
      {
        id: 'groq-mixtral-8x7b',
        name: 'Mixtral 8x7B (Groq)',
        provider: 'groq',
        modelIdentifier: 'mixtral-8x7b-32768',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 32768,
          maxContextLength: 32768
        },
        pricing: {
          inputCostPer1MTokens: 0.24,
          outputCostPer1MTokens: 0.24
        },
        performance: {
          avgLatencyMs: 150,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'Requirements Agent', 'Implementation Agent'],
          taskTypes: ['code-generation', 'analysis', 'documentation'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: false
      },
      // Vertex AI Models (Google Cloud)
      {
        id: 'vertex-gemini-2.0-flash',
        name: 'Gemini 2.0 Flash (Vertex AI)',
        provider: 'vertex',
        modelIdentifier: 'gemini-2.0-flash-exp',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 1000000,
          maxContextLength: 1000000
        },
        pricing: {
          inputCostPer1MTokens: 0.075,
          outputCostPer1MTokens: 0.30
        },
        performance: {
          avgLatencyMs: 200,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'Requirements Agent'],
          taskTypes: ['chat', 'conversation', 'real-time-assistants'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: false
      },
      {
        id: 'vertex-gemini-1.5-pro',
        name: 'Gemini 1.5 Pro (Vertex AI)',
        provider: 'vertex',
        modelIdentifier: 'gemini-1.5-pro',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 1000000,
          maxContextLength: 1000000
        },
        pricing: {
          inputCostPer1MTokens: 1.25,
          outputCostPer1MTokens: 5.00
        },
        performance: {
          avgLatencyMs: 1200,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Design/Architecture Agent', 'QA/Audit Agent'],
          taskTypes: ['structured-output', 'analysis', 'documentation', 'multimodal'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false
      },
      // Azure OpenAI Models
      {
        id: 'azure-gpt-5',
        name: 'GPT-5 (Azure OpenAI)',
        provider: 'azure',
        modelIdentifier: 'gpt-5',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 20.00,
          outputCostPer1MTokens: 60.00
        },
        performance: {
          avgLatencyMs: 1400,
          reliability: 0.99
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'Design/Architecture Agent', 'QA/Audit Agent'],
          taskTypes: ['code-generation', 'analysis', 'creative', 'multimodal'],
          complexity: ['complex']
        },
        status: 'maintenance', // Verify model availability
        isEnabled: false
      },
      {
        id: 'azure-gpt-4o-mini',
        name: 'GPT-4o Mini (Azure OpenAI)',
        provider: 'azure',
        modelIdentifier: 'gpt-4o-mini',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.15,
          outputCostPer1MTokens: 0.60
        },
        performance: {
          avgLatencyMs: 400,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Orchestrator'],
          taskTypes: ['chat', 'simple-tasks'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: false
      },
      {
        id: 'grok-3',
        name: 'Grok 3',
        provider: 'grok',
        modelIdentifier: 'grok-3',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: false,
          fastResponse: false,
          streaming: true,
          functionCalling: false // Grok 3 doesn't support function calling
        },
        limits: {
          maxTokens: 8192,
          maxContextLength: 8192
        },
        pricing: {
          inputCostPer1MTokens: 0.10,
          outputCostPer1MTokens: 0.30
        },
        performance: {
          avgLatencyMs: 1000,
          reliability: 0.95
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'UX Designer', 'Requirements Agent'],
          taskTypes: ['conversation', 'creative', 'documentation'],
          complexity: ['simple', 'moderate']
        },
        status: 'active', // Still available via API (deprecated June 2025, but may still work)
        isEnabled: false // Requires API key
      },
      {
        id: 'grok-4',
        name: 'Grok 4',
        provider: 'grok',
        modelIdentifier: 'grok-beta-2024-09-15', // Verify exact identifier - may need to check xAI API
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Grok 4 supports function calling
        },
        limits: {
          maxTokens: 2000000,
          maxContextLength: 2000000 // 2M tokens
        },
        pricing: {
          inputCostPer1MTokens: 0.15, // Estimated - verify with xAI
          outputCostPer1MTokens: 0.45
        },
        performance: {
          avgLatencyMs: 1200,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'Design/Architecture Agent', 'QA/Audit Agent', 'Requirements Agent'],
          taskTypes: ['code-generation', 'long-context', 'analysis', 'documentation', 'multimodal'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key
      },
      // Mistral AI Models
      {
        id: 'mistral-medium-3',
        name: 'Mistral Medium 3',
        provider: 'mistral',
        modelIdentifier: 'mistral-medium-latest', // Use latest version identifier
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Mistral Medium 3 supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.40,
          outputCostPer1MTokens: 2.00
        },
        performance: {
          avgLatencyMs: 1000,
          reliability: 0.98
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent', 'Design/Architecture Agent', 'Requirements Agent', 'QA/Audit Agent'],
          taskTypes: ['code-generation', 'documentation', 'analysis', 'enterprise-reasoning'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key - Cost-effective enterprise model
      },
      {
        id: 'devstral-small',
        name: 'Devstral Small',
        provider: 'mistral',
        modelIdentifier: 'devstral-small', // Mistral API model identifier
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: false,
          fastResponse: true,
          streaming: true,
          functionCalling: true // Devstral supports function calling
        },
        limits: {
          maxTokens: 32000,
          maxContextLength: 32000
        },
        pricing: {
          inputCostPer1MTokens: 0.00, // FREE (Apache 2.0)
          outputCostPer1MTokens: 0.00 // FREE (Apache 2.0)
        },
        performance: {
          avgLatencyMs: 700,
          reliability: 0.96
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent'],
          taskTypes: ['code-generation', 'software-engineering', 'agentic-tasks'],
          complexity: ['simple', 'moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key - FREE agentic coding model
      },
      {
        id: 'magistral-small',
        name: 'Magistral Small',
        provider: 'mistral',
        modelIdentifier: 'mistral-small', // Note: Magistral Small may not be available via API, using mistral-small as fallback
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: false,
          fastResponse: true,
          streaming: true,
          functionCalling: true // Magistral Small supports function calling
        },
        limits: {
          maxTokens: 32000,
          maxContextLength: 32000
        },
        pricing: {
          inputCostPer1MTokens: 0.00, // FREE (Apache 2.0)
          outputCostPer1MTokens: 0.00 // FREE (Apache 2.0)
        },
        performance: {
          avgLatencyMs: 600,
          reliability: 0.95
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'Requirements Agent', 'UX Designer'],
          taskTypes: ['reasoning', 'chain-of-thought', 'analysis'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: false // Requires API key - FREE reasoning model
      },
      // Qwen (Alibaba) Models
      {
        id: 'qwen3-max',
        name: 'Qwen3 Max',
        provider: 'qwen',
        modelIdentifier: 'qwen3-max',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Qwen3 Max supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.00, // FREE (Apache 2.0)
          outputCostPer1MTokens: 0.00 // FREE (Apache 2.0)
        },
        performance: {
          avgLatencyMs: 1200,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Implementation Agent', 'Design/Architecture Agent', 'QA/Audit Agent'],
          taskTypes: ['code-generation', 'documentation', 'analysis', 'multilingual', 'multimodal'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key - FREE high-performance model
      },
      {
        id: 'qwen3-coder',
        name: 'Qwen3 Coder',
        provider: 'qwen',
        modelIdentifier: 'qwen3-coder',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Qwen3 Coder supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.00, // FREE (Apache 2.0)
          outputCostPer1MTokens: 0.00 // FREE (Apache 2.0)
        },
        performance: {
          avgLatencyMs: 1000,
          reliability: 0.97
        },
        recommendedFor: {
          agentRoles: ['Implementation Agent'],
          taskTypes: ['code-generation', 'software-development', 'coding'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key - FREE coding model
      },
      {
        id: 'qwen3-omni',
        name: 'Qwen3 Omni',
        provider: 'qwen',
        modelIdentifier: 'qwen3-omni',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: false,
          streaming: true,
          functionCalling: true // Qwen3 Omni supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.00, // FREE (Apache 2.0)
          outputCostPer1MTokens: 0.00 // FREE (Apache 2.0)
        },
        performance: {
          avgLatencyMs: 1500,
          reliability: 0.96
        },
        recommendedFor: {
          agentRoles: ['Requirements Agent', 'Implementation Agent', 'UX Designer'],
          taskTypes: ['multimodal', 'text-image-audio-video', 'real-time-streaming'],
          complexity: ['moderate', 'complex']
        },
        status: 'active',
        isEnabled: false // Requires API key - FREE multimodal model
      },
      {
        id: 'qwen3-next',
        name: 'Qwen3 Next',
        provider: 'qwen',
        modelIdentifier: 'qwen3-next',
        capabilities: {
          structuredOutput: true,
          codeGeneration: true,
          longContext: true,
          fastResponse: true,
          streaming: true,
          functionCalling: true // Qwen3 Next supports function calling
        },
        limits: {
          maxTokens: 128000,
          maxContextLength: 128000
        },
        pricing: {
          inputCostPer1MTokens: 0.00, // FREE (Apache 2.0)
          outputCostPer1MTokens: 0.00 // FREE (Apache 2.0)
        },
        performance: {
          avgLatencyMs: 800,
          reliability: 0.96
        },
        recommendedFor: {
          agentRoles: ['Orchestrator', 'Implementation Agent', 'Requirements Agent'],
          taskTypes: ['code-generation', 'analysis', 'efficient-processing'],
          complexity: ['simple', 'moderate']
        },
        status: 'active',
        isEnabled: false // Requires API key - FREE efficient model
      },
    ];

    defaultModels.forEach(model => {
      this.models.set(model.id, model);
    });
  }

  getModel(id: string): ModelCapabilities | undefined {
    return this.models.get(id);
  }

  getAllModels(): ModelCapabilities[] {
    return Array.from(this.models.values());
  }

  getActiveModels(): ModelCapabilities[] {
    return Array.from(this.models.values()).filter(m => m.status === 'active' && m.isEnabled);
  }

  getModelsByProvider(provider: LLMProvider): ModelCapabilities[] {
    return Array.from(this.models.values()).filter(m => m.provider === provider);
  }

  getModelsByCapability(capability: keyof ModelCapabilities['capabilities']): ModelCapabilities[] {
    return Array.from(this.models.values()).filter(m => m.capabilities[capability] === true);
  }

  getRecommendedModels(agentRole?: string, taskType?: string, complexity?: TaskComplexity): ModelCapabilities[] {
    const activeModels = this.getActiveModels();

    return activeModels.filter(model => {
      if (agentRole && !model.recommendedFor?.agentRoles?.includes(agentRole)) {
        return false;
      }
      if (taskType && !model.recommendedFor?.taskTypes?.includes(taskType)) {
        return false;
      }
      if (complexity && !model.recommendedFor?.complexity?.includes(complexity)) {
        return false;
      }
      return true;
    });
  }

  async updateModel(modelId: string, updates: Partial<ModelCapabilities>): Promise<boolean> {
    const model = this.models.get(modelId);
    if (!model) {
      logger.warn(`Attempted to update non-existent model: ${modelId}`);
      return false;
    }

    // Only persist certain fields (user-configurable ones)
    const persistableUpdates: any = {};
    if (updates.isEnabled !== undefined) persistableUpdates.isEnabled = updates.isEnabled;
    if (updates.status !== undefined) persistableUpdates.status = updates.status;
    if (updates.pricing) persistableUpdates.pricing = updates.pricing;
    if (updates.performance) persistableUpdates.performance = updates.performance;

    // If there are persistable updates, save to database FIRST before updating in-memory state
    if (Object.keys(persistableUpdates).length > 0) {
      try {
        const { LLMModelConfig } = await import('../../../models/LLMModelConfig.model.js');
        const mongoose = await import('mongoose');

        // Verify database connection
        if (mongoose.default.connection.readyState !== 1) {
          logger.error(`Database not connected. Connection state: ${mongoose.default.connection.readyState}`);
          return false;
        }

        // Save to database with explicit error handling
        // Use upsert to create if doesn't exist, update if it does
        const updateDoc: any = {
          $set: persistableUpdates
        };

        // Only set default status on insert (when creating new document)
        // Don't override status if it's being explicitly updated
        if (!persistableUpdates.status) {
          updateDoc.$setOnInsert = {
            modelId,
            status: model.status || 'active'
          };
        }

        const result = await LLMModelConfig.findOneAndUpdate(
          { modelId },
          updateDoc,
          {
            upsert: true,
            new: true,
            runValidators: true
          }
        );

        if (!result) {
          logger.error(`Failed to persist model update for ${modelId}: Database operation returned null`);
          return false;
        }

        // Verify the save was successful by checking the saved values
        if (persistableUpdates.isEnabled !== undefined && result.isEnabled !== persistableUpdates.isEnabled) {
          logger.error(`Database save verification failed for ${modelId}: Expected isEnabled=${persistableUpdates.isEnabled}, got ${result.isEnabled}`);
          return false;
        }

        // Verify status was saved correctly
        if (persistableUpdates.status !== undefined && result.status !== persistableUpdates.status) {
          logger.error(`Database save verification failed for ${modelId}: Expected status=${persistableUpdates.status}, got ${result.status}`);
          return false;
        }

        logger.info(`Successfully persisted model update for ${modelId}:`, {
          isEnabled: result.isEnabled,
          status: result.status,
          updatedAt: result.updatedAt
        });
      } catch (error: unknown) {
        logger.error(`Failed to persist model update for ${modelId}:`, {
          error: toApiError(error).message,
          name: (error as Error).name,
          code: (error as any).code,
          persistableUpdates,
          stack: (error as Error).stack
        });
        // Return false to indicate failure - this will cause the API to return an error
        return false;
      }
    }

    // Update in memory AFTER successful database save (or if no persistence needed)
    this.models.set(modelId, { ...model, ...updates });

    return true;
  }

  async enableModel(modelId: string, enabled: boolean): Promise<boolean> {
    return await this.updateModel(modelId, { isEnabled: enabled });
  }

  async setModelStatus(modelId: string, status: ModelCapabilities['status']): Promise<boolean> {
    return await this.updateModel(modelId, { status });
  }

  /**
   * Register a new model in the registry and persist to database
   */
  async registerModel(model: ModelCapabilities): Promise<void> {
    if (this.models.has(model.id)) {
      throw new Error(`Model ${model.id} already exists`);
    }

    // Validate provider is set
    if (!model.provider) {
      throw new Error(`Model ${model.id} (${model.name}) is missing provider`);
    }

    // Add to in-memory registry first
    this.models.set(model.id, model);

    // Persist to database
    try {
      const { LLMModelConfig } = await import('../../../models/LLMModelConfig.model.js');
      const mongoose = await import('mongoose');

      // Verify database connection
      if (mongoose.default.connection.readyState === 1) {
        // Store full model definition for synced models
        await LLMModelConfig.findOneAndUpdate(
          { modelId: model.id },
          {
            $set: {
              modelId: model.id,
              isEnabled: model.isEnabled,
              status: model.status,
              pricing: model.pricing,
              performance: model.performance,
              modelDefinition: {
                name: model.name,
                provider: model.provider,
                modelIdentifier: model.modelIdentifier,
                capabilities: model.capabilities,
                limits: model.limits,
                recommendedFor: model.recommendedFor
              },
              'metadata.syncedFromProvider': true
            }
          },
          { upsert: true, new: true, runValidators: true }
        );

        logger.info(`Persisted model ${model.id} to database`);
      } else {
        logger.warn(`Database not connected when registering model ${model.id}. Model added to memory only.`);
      }
    } catch (error: unknown) {
      logger.error(`Failed to persist model ${model.id} to database:`, {
        error: toApiError(error).message,
        stack: (error as Error).stack
      });
      // Don't throw - model is still in memory, just not persisted
    }
  }

  /**
   * Remove a model from the registry
   */
  removeModel(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  /**
   * Get list of all providers
   */
  getProviders(): string[] {
    const providers = new Set<string>();
    for (const model of this.models.values()) {
      // Filter out undefined/null providers
      if (model.provider) {
        providers.add(model.provider);
      }
    }
    return Array.from(providers);
  }

  /**
   * Load model configurations from database and merge with defaults
   * Also loads synced models that aren't in defaults
   */
  async loadFromDatabase(): Promise<void> {
    try {
      const { LLMModelConfig } = await import('../../../models/LLMModelConfig.model.js');
      const mongoose = await import('mongoose');

      // Verify database connection
      if (mongoose.default.connection.readyState !== 1) {
        logger.warn('Database not connected when loading model configs. Connection state:', mongoose.default.connection.readyState);
        this.initialized = true;
        return;
      }

      const savedConfigs = await LLMModelConfig.find({});
      logger.info(`Loading ${savedConfigs.length} model configurations from database`);

      // Merge saved configurations with default models AND load synced models
      let loadedCount = 0;
      let syncedCount = 0;

      for (const saved of savedConfigs) {
        const existingModel = this.models.get(saved.modelId);

        if (existingModel) {
          // Override default values with saved values
          this.models.set(saved.modelId, {
            ...existingModel,
            isEnabled: saved.isEnabled,
            status: saved.status,
            ...(saved.pricing && { pricing: saved.pricing }),
            ...(saved.performance && { performance: saved.performance })
          });
          loadedCount++;
          logger.debug(`Loaded config for ${saved.modelId}: isEnabled=${saved.isEnabled}, status=${saved.status}`);
        } else if (saved.modelDefinition) {
          // Load synced model that doesn't exist in defaults
          // Skip if provider is missing or invalid
          if (!saved.modelDefinition.provider) {
            logger.warn(`Skipping synced model ${saved.modelId} - missing provider in definition`);
            continue;
          }

          // Reconstruct full model from stored definition
          const syncedModel: ModelCapabilities = {
            id: saved.modelId,
            name: saved.modelDefinition.name,
            provider: saved.modelDefinition.provider as LLMProvider,
            modelIdentifier: saved.modelDefinition.modelIdentifier,
            capabilities: saved.modelDefinition.capabilities,
            limits: saved.modelDefinition.limits,
            pricing: saved.pricing || {
              inputCostPer1MTokens: 1.00,
              outputCostPer1MTokens: 3.00
            },
            performance: saved.performance || {
              avgLatencyMs: 1000,
              reliability: 0.98
            },
            recommendedFor: saved.modelDefinition.recommendedFor || {
              agentRoles: [],
              taskTypes: [],
              complexity: [] as any
            },
            status: saved.status,
            isEnabled: saved.isEnabled
          };

          this.models.set(saved.modelId, syncedModel);
          syncedCount++;
          logger.info(`Loaded synced model from database: ${saved.modelId} (${saved.modelDefinition.name})`);
        } else {
          logger.warn(`Saved config found for unknown model without definition: ${saved.modelId}`);
        }
      }

      logger.info(`Successfully loaded ${loadedCount} default model configurations and ${syncedCount} synced models from database`);
      this.initialized = true;
    } catch (error: unknown) {
      logger.error('Failed to load LLM model configurations from database:', {
        error: toApiError(error).message,
        stack: (error as Error).stack
      });
      // Continue with defaults if database load fails
      this.initialized = true;
    }
  }

  /**
   * Initialize models with database persistence
   * Call this after database connection is established
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadFromDatabase();
    // Automatically enable models whose provider has a configured API key
    await this.enableModelsForConfiguredProviders();
  }

  /**
   * After loading from DB, check which providers have active API keys and
   * auto-enable all their models. This ensures that setting an API key
   * (via Admin Console or .env migration) automatically activates the
   * corresponding models without requiring manual model-by-model toggling.
   */
  private async enableModelsForConfiguredProviders(): Promise<void> {
    try {
      const { apiKeyProvider } = await import('../../apiKeyProvider.service.js');

      const llmProviders: Array<{ provider: string; apiKeyName: Parameters<typeof apiKeyProvider.getApiKey>[0] }> = [
        { provider: 'openai', apiKeyName: 'openai' },
        { provider: 'gemini', apiKeyName: 'gemini' },
        { provider: 'anthropic', apiKeyName: 'anthropic' },
        { provider: 'deepseek', apiKeyName: 'deepseek' },
        { provider: 'groq', apiKeyName: 'groq' },
        { provider: 'mistral', apiKeyName: 'mistral' },
        { provider: 'openrouter', apiKeyName: 'openrouter' },
        { provider: 'qwen', apiKeyName: 'qwen' },
        { provider: 'grok', apiKeyName: 'grok' },
      ];

      for (const { provider, apiKeyName } of llmProviders) {
        const hasKey = await apiKeyProvider.hasApiKey(apiKeyName);
        if (!hasKey) continue;

        // Enable all disabled models for this provider
        for (const [modelId, model] of this.models.entries()) {
          if (model.provider === provider && !model.isEnabled) {
            // Update in-memory state
            this.models.set(modelId, { ...model, isEnabled: true, status: 'active' });

            // Persist to DB so the change survives restarts
            try {
              const { LLMModelConfig } = await import('../../../models/LLMModelConfig.model.js');
              await LLMModelConfig.findOneAndUpdate(
                { modelId },
                { $set: { isEnabled: true, status: 'active' } },
                { upsert: true }
              );
            } catch (dbErr) {
              logger.warn(`Failed to persist enable state for model ${modelId}:`, dbErr);
            }

            logger.info(`Auto-enabled model ${modelId} (provider: ${provider} has API key configured)`);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to auto-enable models for configured providers:', error);
    }
  }

  /**
   * Check if registry has been initialized from database
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Register a local LLM model for a user
   */
  registerUserLocalModel(
    userId: string,
    modelId: string,
    modelName: string,
    provider: 'ollama' | 'vllm' | 'openai_compatible',
    baseUrl: string,
    capabilities?: Partial<ModelCapabilities>
  ): void {
    if (!this.userModels.has(userId)) {
      this.userModels.set(userId, new Map());
    }

    const defaultCapabilities: ModelCapabilities = {
      id: modelId,
      name: modelName,
      provider: provider,
      modelIdentifier: modelId,
      capabilities: {
        structuredOutput: true,
        codeGeneration: true,
        longContext: false,
        fastResponse: true,
        streaming: true,
        functionCalling: false
      },
      limits: {
        maxTokens: 4096,
        maxContextLength: 4096
      },
      pricing: {
        inputCostPer1MTokens: 0,
        outputCostPer1MTokens: 0
      },
      performance: {
        avgLatencyMs: 500,
        reliability: 0.95
      },
      recommendedFor: {
        agentRoles: ['Orchestrator', 'Implementation Agent'],
        taskTypes: ['chat', 'code-generation'],
        complexity: ['simple', 'moderate']
      },
      status: 'active',
      isEnabled: true,
      ...capabilities
    };

    // Store baseUrl in metadata (we'll need to access it later)
    (defaultCapabilities as any).baseUrl = baseUrl;

    this.userModels.get(userId)!.set(modelId, defaultCapabilities);
  }

  /**
   * Discover models from a local LLM endpoint
   */
  async discoverLocalModels(
    userId: string,
    provider: 'ollama' | 'vllm' | 'openai_compatible',
    baseUrl: string
  ): Promise<string[]> {
    try {
      if (provider === 'ollama') {
        const { OllamaService } = await import('../providers/OllamaService.js');
        const ollamaService = new OllamaService(baseUrl);
        return await ollamaService.getAvailableModels();
      } else if (provider === 'vllm') {
        const { VLLMService } = await import('../providers/VLLMService.js');
        const vllmService = new VLLMService(baseUrl);
        return await vllmService.getAvailableModels();
      } else if (provider === 'openai_compatible') {
        const { OpenAICompatibleService } = await import('../providers/OpenAICompatibleService.js');
        const openAIService = new OpenAICompatibleService(baseUrl);
        return await openAIService.getAvailableModels();
      }
    } catch (error: unknown) {
      logger.error(`Failed to discover models for ${provider} at ${baseUrl}:`, toApiError(error));
      throw new Error(`Model discovery failed: ${toApiError(error).message}`);
    }
    return [];
  }

  /**
   * Register discovered models for a user
   */
  async registerDiscoveredModels(
    userId: string,
    provider: 'ollama' | 'vllm' | 'openai_compatible',
    baseUrl: string
  ): Promise<string[]> {
    const modelNames = await this.discoverLocalModels(userId, provider, baseUrl);

    for (const modelName of modelNames) {
      const modelId = `${provider}-${userId}-${modelName}`.replace(/[^a-zA-Z0-9-_]/g, '-');
      this.registerUserLocalModel(userId, modelId, `${modelName} (${provider})`, provider, baseUrl);
    }

    return modelNames;
  }

  /**
   * Get models for a specific user (including local LLMs)
   */
  getUserModels(userId: string): ModelCapabilities[] {
    const userLocalModels = Array.from(this.userModels.get(userId)?.values() || []);
    return [...this.getAllModels(), ...userLocalModels];
  }

  /**
   * Get active models for a user (including local LLMs)
   */
  getActiveModelsForUser(userId: string): ModelCapabilities[] {
    const allModels = this.getUserModels(userId);
    return allModels.filter(m => m.status === 'active' && m.isEnabled);
  }

  /**
   * Get a model by ID, checking user models first
   */
  getModelForUser(userId: string, modelId: string): ModelCapabilities | undefined {
    // Check user-specific models first
    const userModel = this.userModels.get(userId)?.get(modelId);
    if (userModel) {
      return userModel;
    }
    // Fall back to global models
    return this.getModel(modelId);
  }

  /**
   * Remove user's local models (when local LLM config is removed)
   */
  clearUserModels(userId: string): void {
    this.userModels.delete(userId);
  }

  /**
   * Get base URL for a user's local model
   */
  getLocalModelBaseUrl(userId: string, modelId: string): string | null {
    const model = this.userModels.get(userId)?.get(modelId);
    if (model && (model as any).baseUrl) {
      return (model as any).baseUrl;
    }
    return null;
  }
}

export const modelRegistry = new ModelRegistry();
