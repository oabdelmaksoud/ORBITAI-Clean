/**
 * Internal Task Router Service
 * AI-powered intelligent routing for internal/system tasks
 * Automatically selects the most cost-effective model based on task complexity
 * 
 * IMPORTANT: This is for INTERNAL ROUTER only.
 * - Uses InternalRoutingConfig model with taskTypeOverrides and contextOverrides
 * - Completely independent from End User Router
 * - End User Router uses RoutingEngine with RoutingRule (routerType='end-user')
 * - These two routers do NOT share state, rules, or configuration
 */

import { logger } from '../utils/logger.js';
import { modelRegistry, ModelCapabilities } from './llm/models/ModelRegistry.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { InternalRoutingConfig, IInternalRoutingConfig } from '../models/InternalRoutingConfig.model.js';
import { InternalRoutingHistory} from '../models/InternalRoutingHistory.model.js';

// Model tier definitions
export type ModelTier = 'economy' | 'standard' | 'premium';

export interface TierConfig {
  name: ModelTier;
  models: string[];
  maxComplexity: 'simple' | 'moderate' | 'complex';
  maxTokens: number;
  capabilities: string[];
  costMultiplier: number; // For scoring (lower = preferred)
}

export interface TaskAnalysisInput {
  prompt: string;
  taskType?: string;
  agentRole?: string;
  requiredCapabilities?: string[];
  isUserFacing?: boolean;
  isCritical?: boolean;
  context?: 'internal' | 'system' | 'user' | 'background';
}

export interface RoutingDecision {
  selectedModel: ModelCapabilities;
  tier: ModelTier;
  reasoning: string;
  confidence: number;
  estimatedCost: number;
  alternativeModels: ModelCapabilities[];
  factors: {
    complexity: 'simple' | 'moderate' | 'complex';
    tokenEstimate: number;
    requiredCapabilities: string[];
    historicalSuccessRate: number;
    budgetPressure: number;
  };
}

// Default tier configurations
// NOTE: Models are ordered by preference - Gemini first to avoid OpenRouter delays
const DEFAULT_TIER_CONFIGS: TierConfig[] = [
  {
    name: 'economy',
    models: ['gemini-2.5-flash', 'gpt-4o-mini', 'claude-3-5-haiku'],
    maxComplexity: 'simple',
    maxTokens: 2000,
    capabilities: ['streaming'],
    costMultiplier: 1.0
  },
  {
    name: 'standard',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'deepseek-chat', 'gpt-4o-mini', 'claude-3-5-haiku'],
    maxComplexity: 'moderate',
    maxTokens: 8000,
    capabilities: ['streaming', 'codeGeneration', 'structuredOutput'],
    costMultiplier: 2.0
  },
  {
    name: 'premium',
    // Gemini models first for reliability, then others as fallback
    models: ['gemini-2.5-pro', 'gemini-3-pro', 'claude-3-5-sonnet', 'gpt-4o', 'o1-preview'],
    maxComplexity: 'complex',
    maxTokens: 128000,
    capabilities: ['streaming', 'codeGeneration', 'structuredOutput', 'functionCalling', 'longContext'],
    costMultiplier: 5.0
  }
];

// Complexity indicators for task analysis
const COMPLEXITY_INDICATORS = {
  simple: [
    'hello', 'hi', 'thanks', 'yes', 'no', 'ok', 'help',
    'what is', 'how to', 'explain', 'summarize briefly',
    'list', 'format', 'convert'
  ],
  moderate: [
    'analyze', 'review', 'compare', 'evaluate', 'document',
    'code review', 'refactor', 'optimize', 'debug',
    'generate code', 'write function', 'create class'
  ],
  complex: [
    'architecture', 'system design', 'complex', 'multi-step',
    'integration', 'comprehensive', 'detailed analysis',
    'full implementation', 'prototype', 'framework',
    'security audit', 'performance optimization'
  ]
};

// Task types that require specific capabilities
const CAPABILITY_REQUIREMENTS: Record<string, string[]> = {
  'code-generation': ['codeGeneration'],
  'structured-output': ['structuredOutput'],
  'function-calling': ['functionCalling'],
  'long-context': ['longContext'],
  'analysis': ['structuredOutput'],
  'documentation': ['codeGeneration'],
  'architecture': ['functionCalling', 'longContext']
};

class InternalTaskRouterService {
  private configCache: IInternalRoutingConfig | null = null;
  private configCacheTime: number = 0;
  private readonly CONFIG_CACHE_TTL = 60000; // 1 minute

  /**
   * Main routing method - analyzes task and selects optimal model
   */
  async routeTask(input: TaskAnalysisInput): Promise<RoutingDecision> {
    const startTime = Date.now();

    try {
      // Get configuration
      const config = await this.getConfig();

      // Analyze task complexity
      const complexity = this.analyzeComplexity(input);

      // Estimate token count
      const tokenEstimate = this.estimateTokens(input.prompt);

      // Determine required capabilities
      const requiredCapabilities = this.determineRequiredCapabilities(input);

      // Get historical success rate for similar tasks
      const historicalSuccessRate = await this.getHistoricalSuccessRate(
        input.taskType,
        input.agentRole
      );

      // Calculate budget pressure (0-1, higher = more pressure to save)
      const budgetPressure = await this.calculateBudgetPressure();

      // Determine appropriate tier
      const tier = this.determineTier(
        complexity,
        tokenEstimate,
        requiredCapabilities,
        input.isUserFacing || false,
        input.isCritical || false,
        budgetPressure,
        config
      );

      // Select model from tier
      const { selectedModel, alternativeModels } = await this.selectModelFromTier(
        tier,
        requiredCapabilities,
        config
      );

      // Calculate confidence based on historical data
      const confidence = this.calculateConfidence(
        historicalSuccessRate,
        complexity,
        tier
      );

      // Estimate cost
      const estimatedCost = this.estimateCost(selectedModel, tokenEstimate);

      // Build reasoning
      const reasoning = this.buildReasoning(
        complexity,
        tier,
        requiredCapabilities,
        budgetPressure,
        selectedModel
      );

      const decision: RoutingDecision = {
        selectedModel,
        tier,
        reasoning,
        confidence,
        estimatedCost,
        alternativeModels,
        factors: {
          complexity,
          tokenEstimate,
          requiredCapabilities,
          historicalSuccessRate,
          budgetPressure
        }
      };

      // Log decision (async, don't await)
      this.logDecision(input, decision, Date.now() - startTime).catch(err =>
        logger.warn('Failed to log routing decision:', err.message)
      );

      logger.info(`[InternalRouter] Selected ${selectedModel.name} (${tier} tier) for ${input.taskType || 'unknown'} task. Reasoning: ${reasoning}`);

      return decision;
    } catch (error: unknown) {
      logger.error('[InternalRouter] Routing failed:', error);

      // Fallback to a model that supports JSON mode (for structured output tasks)
      // Prefer gemini-2.5-pro over gemini-2.5-flash (which doesn't support JSON mode)
      const fallbackModel = modelRegistry.getModel('gemini-2.5-pro') ||
        modelRegistry.getModel('gemini-2.5-flash') ||
        modelRegistry.getActiveModels()[0];

      return {
        selectedModel: fallbackModel,
        tier: 'economy',
        reasoning: `Fallback due to routing error: ${(error instanceof Error ? error.message : String(error))}`,
        confidence: 0.3,
        estimatedCost: 0,
        alternativeModels: [],
        factors: {
          complexity: 'simple',
          tokenEstimate: 0,
          requiredCapabilities: [],
          historicalSuccessRate: 0,
          budgetPressure: 0
        }
      };
    }
  }

  /**
   * Analyze task complexity based on prompt and indicators
   */
  private analyzeComplexity(input: TaskAnalysisInput): 'simple' | 'moderate' | 'complex' {
    const prompt = input.prompt.toLowerCase();
    const wordCount = input.prompt.split(/\s+/).length;
    const charCount = input.prompt.length;

    // Check for complex indicators first (highest priority)
    const hasComplexIndicators = COMPLEXITY_INDICATORS.complex.some(indicator =>
      prompt.includes(indicator.toLowerCase())
    );

    if (hasComplexIndicators || wordCount > 500 || charCount > 3000) {
      return 'complex';
    }

    // Check for moderate indicators
    const hasModerateIndicators = COMPLEXITY_INDICATORS.moderate.some(indicator =>
      prompt.includes(indicator.toLowerCase())
    );

    if (hasModerateIndicators || wordCount > 100 || charCount > 800) {
      return 'moderate';
    }

    // Check for simple indicators
    const hasSimpleIndicators = COMPLEXITY_INDICATORS.simple.some(indicator =>
      prompt.toLowerCase().startsWith(indicator) || prompt.includes(indicator)
    );

    if (hasSimpleIndicators || wordCount < 30) {
      return 'simple';
    }

    // Default to moderate for uncertainty
    return 'moderate';
  }

  /**
   * Estimate token count from prompt
   */
  private estimateTokens(prompt: string): number {
    // Rough estimation: ~4 characters per token for English
    // Add buffer for response (assume 2x input for response)
    const inputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = inputTokens * 2;
    return inputTokens + estimatedOutputTokens;
  }

  /**
   * Determine required capabilities based on task type and content
   */
  private determineRequiredCapabilities(input: TaskAnalysisInput): string[] {
    const capabilities: Set<string> = new Set();

    // Add explicitly required capabilities
    if (input.requiredCapabilities) {
      input.requiredCapabilities.forEach(cap => capabilities.add(cap));
    }

    // Add capabilities based on task type
    if (input.taskType && CAPABILITY_REQUIREMENTS[input.taskType]) {
      CAPABILITY_REQUIREMENTS[input.taskType].forEach(cap => capabilities.add(cap));
    }

    // Detect capabilities from prompt content
    const prompt = input.prompt.toLowerCase();

    if (prompt.includes('json') || prompt.includes('schema') || prompt.includes('structured')) {
      capabilities.add('structuredOutput');
    }

    if (prompt.includes('code') || prompt.includes('function') || prompt.includes('implement')) {
      capabilities.add('codeGeneration');
    }

    if (prompt.includes('tool') || prompt.includes('function call') || prompt.includes('api call')) {
      capabilities.add('functionCalling');
    }

    if (input.prompt.length > 10000) {
      capabilities.add('longContext');
    }

    return Array.from(capabilities);
  }

  /**
   * Get historical success rate for similar tasks
   */
  private async getHistoricalSuccessRate(
    taskType?: string,
    agentRole?: string
  ): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const query: any = {
        timestamp: { $gte: thirtyDaysAgo }
      };

      if (taskType) query.taskType = taskType;
      if (agentRole) query.agentRole = agentRole;

      const results = await LLMUsage.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            successfulRequests: {
              $sum: { $cond: ['$success', 1, 0] }
            }
          }
        }
      ]);

      if (results.length === 0 || results[0].totalRequests === 0) {
        return 0.85; // Default assumption
      }

      return results[0].successfulRequests / results[0].totalRequests;
    } catch (error: unknown) {
      logger.warn('[InternalRouter] Failed to get historical success rate:', error);
      return 0.85; // Default
    }
  }

  /**
   * Calculate budget pressure based on recent spending
   */
  private async calculateBudgetPressure(): Promise<number> {
    try {
      const config = await this.getConfig();
      if (!config.budgetLimits?.dailyLimit) {
        return 0.3; // Default moderate pressure
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailySpending = await LLMUsage.aggregate([
        {
          $match: {
            timestamp: { $gte: today },
            context: { $in: ['internal', 'system', 'background', 'other'] }
          }
        },
        {
          $group: {
            _id: null,
            totalCost: { $sum: '$totalCost' }
          }
        }
      ]);

      const spent = dailySpending.length > 0 ? dailySpending[0].totalCost : 0;
      const limit = config.budgetLimits.dailyLimit;

      // Calculate pressure (0 = no pressure, 1 = at limit)
      return Math.min(spent / limit, 1);
    } catch (error: unknown) {
      logger.warn('[InternalRouter] Failed to calculate budget pressure:', error);
      return 0.3;
    }
  }

  /**
   * Determine appropriate tier based on all factors
   */
  private determineTier(
    complexity: 'simple' | 'moderate' | 'complex',
    _tokenEstimate: number,
    requiredCapabilities: string[],
    isUserFacing: boolean,
    isCritical: boolean,
    budgetPressure: number,
    _config: IInternalRoutingConfig
  ): ModelTier {
    // Critical or user-facing tasks get premium treatment
    if (isCritical) {
      return 'premium';
    }

    // Check if capabilities require premium tier
    const premiumCapabilities = ['functionCalling', 'longContext'];
    const needsPremium = requiredCapabilities.some(cap =>
      premiumCapabilities.includes(cap)
    );

    if (needsPremium) {
      return 'premium';
    }

    // High budget pressure pushes toward economy
    if (budgetPressure > 0.8 && complexity !== 'complex') {
      return 'economy';
    }

    // Map complexity to tier with budget consideration
    if (complexity === 'complex') {
      return budgetPressure > 0.6 ? 'standard' : 'premium';
    }

    if (complexity === 'moderate') {
      return budgetPressure > 0.5 ? 'economy' : 'standard';
    }

    // Simple tasks always use economy unless user-facing
    if (isUserFacing && complexity === 'simple') {
      return 'standard';
    }

    return 'economy';
  }

  /**
   * Select best model from the determined tier
   */
  private async selectModelFromTier(
    tier: ModelTier,
    requiredCapabilities: string[],
    config: IInternalRoutingConfig
  ): Promise<{ selectedModel: ModelCapabilities; alternativeModels: ModelCapabilities[] }> {
    // Get tier config
    const tierConfig = config.tiers?.find(t => t.name === tier) ||
      DEFAULT_TIER_CONFIGS.find(t => t.name === tier)!;

    // Get available models from tier
    const availableModels: ModelCapabilities[] = [];

    for (const modelId of tierConfig.models) {
      const model = modelRegistry.getModel(modelId);
      if (model && model.status === 'active' && model.isEnabled) {
        // Exclude TTS (text-to-speech) and audio-only models as they only support audio output
        const modelIdLower = model.modelIdentifier.toLowerCase();
        if (modelIdLower.includes('tts') || modelIdLower.includes('audio-only')) {
          continue; // Skip TTS/audio-only models
        }

        // Check if model has required capabilities
        const hasCapabilities = requiredCapabilities.every(cap => {
          const capKey = cap as keyof ModelCapabilities['capabilities'];
          return model.capabilities[capKey] === true;
        });

        if (hasCapabilities || requiredCapabilities.length === 0) {
          availableModels.push(model);
        }
      }
    }

    // If no models available in tier, try next tier up
    if (availableModels.length === 0) {
      const tierOrder: ModelTier[] = ['economy', 'standard', 'premium'];
      const currentIndex = tierOrder.indexOf(tier);

      if (currentIndex < tierOrder.length - 1) {
        logger.info(`[InternalRouter] No models available in ${tier} tier, escalating to ${tierOrder[currentIndex + 1]}`);
        return this.selectModelFromTier(tierOrder[currentIndex + 1], requiredCapabilities, config);
      }

      // Last resort: get any active model (excluding TTS/audio-only models)
      const allModels = modelRegistry.getActiveModels().filter(m => {
        const modelId = m.modelIdentifier.toLowerCase();
        return !modelId.includes('tts') && !modelId.includes('audio-only');
      });
      if (allModels.length > 0) {
        return {
          selectedModel: allModels[0],
          alternativeModels: allModels.slice(1, 3)
        };
      }

      throw new Error('No models available for routing');
    }

    // Sort by cost (prefer cheaper models within tier)
    availableModels.sort((a, b) => {
      const costA = a.pricing.inputCostPer1MTokens + a.pricing.outputCostPer1MTokens;
      const costB = b.pricing.inputCostPer1MTokens + b.pricing.outputCostPer1MTokens;
      return costA - costB;
    });

    // Get historical performance to potentially reorder
    const modelPerformance = await this.getModelPerformance(availableModels.map(m => m.id));

    // Combine cost and performance for final selection
    const scoredModels = availableModels.map(model => {
      const cost = model.pricing.inputCostPer1MTokens + model.pricing.outputCostPer1MTokens;
      const perf = modelPerformance.get(model.id) || { successRate: 0.9, avgLatency: 1000 };

      // Score: lower is better (cost weight: 60%, latency: 20%, success: 20%)
      const score = (cost * 0.6) +
        (perf.avgLatency / 10000 * 0.2) +
        ((1 - perf.successRate) * 0.2);

      return { model, score };
    });

    scoredModels.sort((a, b) => a.score - b.score);

    return {
      selectedModel: scoredModels[0].model,
      alternativeModels: scoredModels.slice(1, 4).map(s => s.model)
    };
  }

  /**
   * Get model performance metrics
   */
  private async getModelPerformance(
    modelIds: string[]
  ): Promise<Map<string, { successRate: number; avgLatency: number }>> {
    const performance = new Map<string, { successRate: number; avgLatency: number }>();

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const results = await LLMUsage.aggregate([
        {
          $match: {
            modelId: { $in: modelIds },
            timestamp: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: '$modelId',
            totalRequests: { $sum: 1 },
            successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
            avgLatency: { $avg: '$latencyMs' }
          }
        }
      ]);

      results.forEach((r: any) => {
        performance.set(r._id, {
          successRate: r.totalRequests > 0 ? r.successfulRequests / r.totalRequests : 0.9,
          avgLatency: r.avgLatency || 1000
        });
      });
    } catch (error: unknown) {
      logger.warn('[InternalRouter] Failed to get model performance:', error);
    }

    return performance;
  }

  /**
   * Calculate confidence score for the decision
   */
  private calculateConfidence(
    historicalSuccessRate: number,
    complexity: 'simple' | 'moderate' | 'complex',
    tier: ModelTier
  ): number {
    // Base confidence from historical data
    let confidence = historicalSuccessRate * 0.5;

    // Adjust based on tier-complexity match
    const tierComplexityMatch = {
      economy: { simple: 0.3, moderate: 0.15, complex: 0 },
      standard: { simple: 0.25, moderate: 0.3, complex: 0.15 },
      premium: { simple: 0.2, moderate: 0.25, complex: 0.3 }
    };

    confidence += tierComplexityMatch[tier][complexity];

    // Cap at 0.95
    return Math.min(confidence, 0.95);
  }

  /**
   * Estimate cost for the task
   */
  private estimateCost(model: ModelCapabilities, tokenEstimate: number): number {
    const inputTokens = tokenEstimate * 0.4; // Assume 40% input
    const outputTokens = tokenEstimate * 0.6; // Assume 60% output

    const inputCost = (inputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens;
    const outputCost = (outputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens;

    return inputCost + outputCost;
  }

  /**
   * Build human-readable reasoning for the decision
   */
  private buildReasoning(
    complexity: 'simple' | 'moderate' | 'complex',
    tier: ModelTier,
    requiredCapabilities: string[],
    budgetPressure: number,
    model: ModelCapabilities
  ): string {
    const parts: string[] = [];

    parts.push(`Task complexity: ${complexity}`);

    if (requiredCapabilities.length > 0) {
      parts.push(`Required: ${requiredCapabilities.join(', ')}`);
    }

    if (budgetPressure > 0.5) {
      parts.push(`Budget pressure: ${(budgetPressure * 100).toFixed(0)}%`);
    }

    parts.push(`Selected ${tier} tier → ${model.name}`);

    return parts.join('. ');
  }

  /**
   * Log routing decision for learning
   */
  private async logDecision(
    input: TaskAnalysisInput,
    decision: RoutingDecision,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await InternalRoutingHistory.create({
        taskType: input.taskType || 'unknown',
        agentRole: input.agentRole,
        context: input.context || 'internal',
        selectedModelId: decision.selectedModel.id,
        selectedTier: decision.tier,
        complexity: decision.factors.complexity,
        tokenEstimate: decision.factors.tokenEstimate,
        requiredCapabilities: decision.factors.requiredCapabilities,
        confidence: decision.confidence,
        estimatedCost: decision.estimatedCost,
        reasoning: decision.reasoning,
        budgetPressure: decision.factors.budgetPressure,
        processingTimeMs,
        timestamp: new Date()
      });
    } catch (error: unknown) {
      logger.warn('[InternalRouter] Failed to log decision:', error);
    }
  }

  /**
   * Record task outcome for learning
   */
  async recordOutcome(
    decisionId: string,
    outcome: {
      success: boolean;
      actualCost: number;
      actualLatencyMs: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      await InternalRoutingHistory.findByIdAndUpdate(decisionId, {
        $set: {
          'outcome.success': outcome.success,
          'outcome.actualCost': outcome.actualCost,
          'outcome.actualLatencyMs': outcome.actualLatencyMs,
          'outcome.errorMessage': outcome.errorMessage,
          'outcome.recordedAt': new Date()
        }
      });

      // If task failed with economy tier, consider escalation for future
      const decision = await InternalRoutingHistory.findById(decisionId);
      if (decision && !outcome.success && decision.selectedTier === 'economy') {
        logger.info(`[InternalRouter] Economy tier failed for ${decision.taskType}, will consider escalation for similar tasks`);
        // This data will be used by getHistoricalSuccessRate to influence future decisions
      }
    } catch (error: unknown) {
      logger.warn('[InternalRouter] Failed to record outcome:', error);
    }
  }

  /**
   * Get configuration with caching
   */
  async getConfig(): Promise<IInternalRoutingConfig> {
    const now = Date.now();

    if (this.configCache && now - this.configCacheTime < this.CONFIG_CACHE_TTL) {
      return this.configCache;
    }

    try {
      let config = await InternalRoutingConfig.findOne({ isActive: true });

      if (!config) {
        // Create default config
        config = await InternalRoutingConfig.create({
          enabled: true,
          defaultTier: 'economy',
          tiers: DEFAULT_TIER_CONFIGS,
          budgetLimits: {
            dailyLimit: 10,
            monthlyLimit: 200,
            perTaskLimit: 0.5
          },
          escalationRules: {
            autoEscalateOnFailure: true,
            maxEscalationLevel: 'premium',
            cooldownMinutes: 30
          },
          isActive: true
        });
      }

      this.configCache = config;
      this.configCacheTime = now;

      return config;
    } catch (error: unknown) {
      logger.error('[InternalRouter] Failed to get config:', error);

      // Return default config
      return {
        enabled: true,
        defaultTier: 'economy',
        tiers: DEFAULT_TIER_CONFIGS,
        budgetLimits: {
          dailyLimit: 10,
          monthlyLimit: 200,
          perTaskLimit: 0.5
        },
        escalationRules: {
          autoEscalateOnFailure: true,
          maxEscalationLevel: 'premium',
          cooldownMinutes: 30
        },
        isActive: true
      } as IInternalRoutingConfig;
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<IInternalRoutingConfig>): Promise<IInternalRoutingConfig> {
    try {
      // Get current config to merge metadata properly
      const currentConfig = await InternalRoutingConfig.findOne({ isActive: true });

      // Prepare update object with proper metadata merging
      const updateObj: any = { ...updates };

      // If metadata is being updated, merge it with existing metadata
      if (updates.metadata && currentConfig?.metadata) {
        updateObj.metadata = {
          ...currentConfig.metadata,
          ...updates.metadata,
          // Deep merge aiRuleConfigurator if it exists
          aiRuleConfigurator: {
            ...(currentConfig.metadata.aiRuleConfigurator || {}),
            ...(updates.metadata.aiRuleConfigurator || {})
          }
        };
      } else if (updates.metadata) {
        // If no existing metadata, use the new one
        updateObj.metadata = updates.metadata;
      }

      const config = await InternalRoutingConfig.findOneAndUpdate(
        { isActive: true },
        { $set: updateObj },
        { new: true, upsert: true }
      );

      // Clear cache
      this.configCache = null;
      this.configCacheTime = 0;

      logger.info('[InternalRouter] Config updated, metadata preserved:', {
        hasMetadata: !!config?.metadata,
        hasAiRuleConfigurator: !!config?.metadata?.aiRuleConfigurator,
        scoringMode: config?.metadata?.aiRuleConfigurator?.scoringMode
      });

      return config;
    } catch (error: unknown) {
      logger.error('[InternalRouter] Failed to update config:', error);
      throw error;
    }
  }

  /**
   * Get routing statistics
   */
  async getStatistics(timeRange: { start: Date; end: Date }): Promise<{
    totalDecisions: number;
    tierDistribution: Record<ModelTier, number>;
    avgConfidence: number;
    avgCost: number;
    successRate: number;
    topModels: Array<{ modelId: string; count: number; avgCost: number }>;
    costSavings: number;
  }> {
    try {
      const decisions = await InternalRoutingHistory.find({
        timestamp: { $gte: timeRange.start, $lte: timeRange.end }
      });

      const totalDecisions = decisions.length;

      const tierDistribution: Record<ModelTier, number> = {
        economy: 0,
        standard: 0,
        premium: 0
      };

      let totalConfidence = 0;
      let totalCost = 0;
      let successCount = 0;
      let totalWithOutcome = 0;

      const modelCounts = new Map<string, { count: number; totalCost: number }>();

      decisions.forEach(d => {
        tierDistribution[d.selectedTier]++;
        totalConfidence += d.confidence;

        if (d.outcome) {
          totalWithOutcome++;
          totalCost += d.outcome.actualCost || d.estimatedCost;
          if (d.outcome.success) successCount++;
        } else {
          totalCost += d.estimatedCost;
        }

        const existing = modelCounts.get(d.selectedModelId) || { count: 0, totalCost: 0 };
        modelCounts.set(d.selectedModelId, {
          count: existing.count + 1,
          totalCost: existing.totalCost + (d.outcome?.actualCost || d.estimatedCost)
        });
      });

      // Calculate cost savings (compare to if all used premium)
      const premiumModel = modelRegistry.getModel('gemini-3-pro') || modelRegistry.getModel('gpt-4o');
      const premiumCostPer1M = premiumModel ?
        premiumModel.pricing.inputCostPer1MTokens + premiumModel.pricing.outputCostPer1MTokens : 10;

      const totalTokens = decisions.reduce((sum, d) => sum + d.tokenEstimate, 0);
      const premiumCost = (totalTokens / 1_000_000) * premiumCostPer1M;
      const costSavings = Math.max(0, premiumCost - totalCost);

      const topModels = Array.from(modelCounts.entries())
        .map(([modelId, data]) => ({
          modelId,
          count: data.count,
          avgCost: data.count > 0 ? data.totalCost / data.count : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalDecisions,
        tierDistribution,
        avgConfidence: totalDecisions > 0 ? totalConfidence / totalDecisions : 0,
        avgCost: totalDecisions > 0 ? totalCost / totalDecisions : 0,
        successRate: totalWithOutcome > 0 ? successCount / totalWithOutcome : 0,
        topModels,
        costSavings
      };
    } catch (error: unknown) {
      logger.error('[InternalRouter] Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
  }
}

export const internalTaskRouter = new InternalTaskRouterService();
export default internalTaskRouter;




