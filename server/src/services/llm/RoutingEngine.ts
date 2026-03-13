/**
 * Routing Engine - Selects the best LLM model for a given task
 * Enhanced with configurable routing rules, cost controls, and model priorities
 * 
 * IMPORTANT: This is for END USER ROUTER only.
 * - Uses RoutingRule model with routerType='end-user'
 * - Completely independent from Internal Router
 * - Internal Router uses InternalTaskRouterService with InternalRoutingConfig
 * - These two routers do NOT share state, rules, or configuration
 */

import { ModelCapabilities, modelRegistry } from './models/ModelRegistry.js';
import { TaskAnalysis, buildRoutingSignals, RoutingSignals } from './TaskAnalyzer.js';
import { llmRouterSettingsService, EffectiveRouterSettings } from '../llmRouterSettings.service.js';
import { IRoutingRule, IFallbackStep, ISchedule } from '../../models/RoutingRule.model.js';
import { logger } from '../../utils/logger.js';
import { toApiError } from '../../errors/ApiError.js';
import { llmRouterAIService } from '../llmRouterAI.service.js';
import { predictiveRoutingService } from '../llmRouterPredictive.service.js';
import { rlRouterService } from '../llmRouterRL.service.js';

export interface RoutingContext {
  userId?: string;
  projectId?: string;
  packageLimits?: {
    maxMonthlyBudget?: number;
    maxAPICalls?: number;
    maxTokensPerMonth?: number;
  };
  userPreferences?: {
    preferredModels?: string[];
    costPreference?: 'low' | 'balanced' | 'quality';
  };
  projectState?: {
    currentPhase: string;
    budgetUsed: number;
    tokensUsed: number;
  };
}

export interface ScoredModel {
  model: ModelCapabilities;
  score: number;
  reasoning: string;
}

export interface ModelSelection {
  primaryModel: ModelCapabilities;
  fallbackModel?: ModelCapabilities;
  fallbackChain?: IFallbackStep[];
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
}

// Circuit breaker state for fallback chains
interface CircuitBreakerState {
  modelId: string;
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

export class RoutingEngine {
  private settingsCache: Map<string, { settings: EffectiveRouterSettings; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  // Circuit breaker state for fallback chains
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute cooldown

  /**
   * Clear the settings cache - call this when settings are updated
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.settingsCache.delete(userId);
      logger.info(`[RoutingEngine] Cache cleared for user: ${userId}`);
    } else {
      this.settingsCache.clear();
      logger.info('[RoutingEngine] Full cache cleared');
    }
  }

  async selectModel(
    task: TaskAnalysis,
    context: RoutingContext
  ): Promise<ModelSelection> {
    // Load effective router settings
    const settings = await this.getEffectiveSettings(context.userId);

    // Try predictive routing first (ML-based, faster)
    let predictivePrediction = null;
    if (settings.enabled && settings.enableIntelligentRouting) {
      try {
        predictivePrediction = await predictiveRoutingService.predictOptimalModel({
          agentRole: task.agentRole,
          taskType: task.taskType,
          complexity: task.complexity,
          estimatedTokens: task.estimatedTokens,
          requiredCapabilities: task.requiredCapabilities,
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay()
        });

        // If predictive routing has high confidence (>0.6), use it
        if (predictivePrediction && predictivePrediction.confidence > 0.6) {
          const predictedModel = modelRegistry.getModel(predictivePrediction.modelId);
          if (predictedModel && predictedModel.status === 'active' && predictedModel.isEnabled) {
            const meetsRequirements = task.requiredCapabilities.length === 0 ||
              task.requiredCapabilities.every(cap => {
                const capKey = cap as keyof ModelCapabilities['capabilities'];
                return predictedModel.capabilities[capKey] === true;
              });

            if (meetsRequirements) {
              logger.debug(`Using predictive routing model: ${predictivePrediction.modelId} (confidence: ${predictivePrediction.confidence})`);
              return {
                primaryModel: predictedModel,
                fallbackModel: this.selectFallback(predictedModel, []),
                reasoning: `Predictive routing: ${predictivePrediction.reasoning}`,
                estimatedCost: predictivePrediction.predictedCost,
                estimatedLatency: predictivePrediction.predictedLatency
              };
            }
          }
        }
      } catch (error: unknown) {
        logger.error('[RoutingEngine] Predictive routing failed:', toApiError(error));
        // Continue to rule-based routing
      }
    }

    // Try RL routing if enabled (cost/quality optimization)
    let rlSelection = null;
    if (settings.enabled && settings.enableIntelligentRouting && !predictivePrediction) {
      try {
        const availableModelIds = modelRegistry.getActiveModels()
          .filter(model => {
            // Filter by required capabilities
            if (task.requiredCapabilities.length > 0) {
              return task.requiredCapabilities.every(cap => {
                const capKey = cap as keyof ModelCapabilities['capabilities'];
                return model.capabilities[capKey] === true;
              });
            }
            return true;
          })
          .map(m => m.id);

        if (availableModelIds.length > 0) {
          rlSelection = await rlRouterService.selectModel(task, availableModelIds);

          if (rlSelection && rlSelection.confidence > 0.5) {
            const rlModel = modelRegistry.getModel(rlSelection.modelId);
            if (rlModel && rlModel.status === 'active' && rlModel.isEnabled) {
              logger.debug(`Using RL-selected model: ${rlSelection.modelId} (confidence: ${rlSelection.confidence})`);
              return {
                primaryModel: rlModel,
                fallbackModel: this.selectFallback(rlModel, []),
                reasoning: `RL optimization: ${rlSelection.reasoning}`,
                estimatedCost: this.estimateCost(rlModel, task.estimatedTokens),
                estimatedLatency: rlModel.performance.avgLatencyMs
              };
            }
          }
        }
      } catch (error: unknown) {
        logger.debug('RL routing failed, falling back to standard routing:', toApiError(error).message);
      }
    }

    // Try AI prediction if enabled (non-blocking, fallback to predictive/RL)
    let aiPrediction = null;
    if (settings.enabled && settings.enableIntelligentRouting && !predictivePrediction && !rlSelection) {
      try {
        aiPrediction = await llmRouterAIService.predictOptimalModel(
          {
            agentRole: task.agentRole,
            taskType: task.taskType,
            complexity: task.complexity,
            estimatedTokens: task.estimatedTokens,
            requiredCapabilities: task.requiredCapabilities
          },
          {
            userId: context.userId,
            costPreference: context.userPreferences?.costPreference || settings.defaultCostPreference,
            maxLatency: undefined
          }
        );

        // If AI prediction has high confidence (>0.7), consider using it
        if (aiPrediction.confidence > 0.7) {
          const predictedModel = modelRegistry.getModel(aiPrediction.modelId);
          if (predictedModel && predictedModel.status === 'active' && predictedModel.isEnabled) {
            // Check if predicted model meets requirements
            const meetsRequirements = task.requiredCapabilities.length === 0 ||
              task.requiredCapabilities.every(cap => {
                const capKey = cap as keyof ModelCapabilities['capabilities'];
                return predictedModel.capabilities[capKey] === true;
              });

            if (meetsRequirements) {
              logger.debug(`Using AI-predicted model: ${aiPrediction.modelId} (confidence: ${aiPrediction.confidence})`);
              return {
                primaryModel: predictedModel,
                fallbackModel: this.selectFallback(predictedModel, []),
                reasoning: `AI prediction: ${aiPrediction.reasoning}`,
                estimatedCost: aiPrediction.estimatedCost,
                estimatedLatency: aiPrediction.estimatedLatency
              };
            }
          }
        }
      } catch (error: unknown) {
        // Log but don't fail - fall back to standard routing
        logger.debug('AI prediction failed, using standard routing:', toApiError(error).message);
      }
    }

    // Apply custom routing rules first (if enabled)
    let ruleApplied = false;
    let ruleActions: {
      blockedModels?: string[];
      blockedProviders?: string[];
      costLimit?: number;
      maxLatency?: number;
      costPreference?: 'low' | 'balanced' | 'quality';
      ruleName?: string;
    } = {};

    if (settings.enabled && settings.enableIntelligentRouting && settings.routingRules.length > 0) {
      const ruleResult = await this.applyRoutingRules(task, context, settings.routingRules);
      if (ruleResult) {
        ruleApplied = true;
        ruleActions = ruleResult;

        // If rule specifies a preferred/forced model, use it directly
        if (ruleResult.preferredModel) {
          const preferredModel = modelRegistry.getModel(ruleResult.preferredModel);
          if (preferredModel && preferredModel.status === 'active' && preferredModel.isEnabled) {
            logger.info(`[RoutingEngine] Rule "${ruleResult.ruleName}" selected model: ${preferredModel.name}`);
            return {
              primaryModel: preferredModel,
              fallbackModel: this.selectFallback(preferredModel, []),
              reasoning: `Applied routing rule: ${ruleResult.ruleName}`,
              estimatedCost: this.estimateCost(preferredModel, task.estimatedTokens),
              estimatedLatency: preferredModel.performance.avgLatencyMs
            };
          }
        }

        // If rule specifies a forced provider, filter to only that provider
        if (ruleResult.forceProvider) {
          const providerModels = modelRegistry.getActiveModels()
            .filter(m => m.provider === ruleResult.forceProvider && m.isEnabled);
          if (providerModels.length > 0) {
            const bestModel = providerModels[0];
            logger.info(`[RoutingEngine] Rule "${ruleResult.ruleName}" forced provider: ${ruleResult.forceProvider}`);
            return {
              primaryModel: bestModel,
              fallbackModel: this.selectFallback(bestModel, []),
              reasoning: `Applied routing rule: ${ruleResult.ruleName} (forced provider: ${ruleResult.forceProvider})`,
              estimatedCost: this.estimateCost(bestModel, task.estimatedTokens),
              estimatedLatency: bestModel.performance.avgLatencyMs
            };
          }
        }

        // Log other rule actions that will be applied during scoring
        if (ruleResult.blockedModels?.length || ruleResult.blockedProviders?.length) {
          logger.info(`[RoutingEngine] Rule "${ruleResult.ruleName}" blocking: models=${ruleResult.blockedModels?.join(',') || 'none'}, providers=${ruleResult.blockedProviders?.join(',') || 'none'}`);
        }
        if (ruleResult.costLimit || ruleResult.maxLatency) {
          logger.info(`[RoutingEngine] Rule "${ruleResult.ruleName}" constraints: costLimit=$${ruleResult.costLimit || 'none'}, maxLatency=${ruleResult.maxLatency || 'none'}ms`);
        }
      }
    }

    // 1. Get candidate models
    let candidates = modelRegistry.getRecommendedModels(
      task.agentRole,
      task.taskType,
      task.complexity
    );

    // Apply model priorities from settings
    if (settings.modelPriorities) {
      candidates = this.applyModelPriorities(candidates, settings.modelPriorities, task);
    }

    // Filter by required capabilities
    if (task.requiredCapabilities.length > 0) {
      candidates = candidates.filter(model => {
        return task.requiredCapabilities.every(cap => {
          const capKey = cap as keyof ModelCapabilities['capabilities'];
          return model.capabilities[capKey] === true;
        });
      });
    }

    // Apply blocked models from settings
    if (settings.defaultBlockedModels && settings.defaultBlockedModels.length > 0) {
      candidates = candidates.filter(model => !settings.defaultBlockedModels!.includes(model.id));
    }

    // Apply blocked models from routing rule
    if (ruleActions.blockedModels && ruleActions.blockedModels.length > 0) {
      candidates = candidates.filter(model => !ruleActions.blockedModels!.includes(model.id));
    }

    // Apply blocked providers from routing rule
    if (ruleActions.blockedProviders && ruleActions.blockedProviders.length > 0) {
      candidates = candidates.filter(model => !ruleActions.blockedProviders!.includes(model.provider));
    }

    // Filter by subscription package limits (premium model access)
    if (context.packageLimits) {
      const packageLimits = context.packageLimits as any;

      // If user has allowedLLMModels list, filter to only those models
      if (packageLimits.allowedLLMModels && Array.isArray(packageLimits.allowedLLMModels) && packageLimits.allowedLLMModels.length > 0) {
        candidates = candidates.filter(model => {
          // Check if model ID is in allowed list, or if it's a standard model (not premium)
          const isAllowed = packageLimits.allowedLLMModels.includes(model.id) ||
            packageLimits.allowedLLMModels.includes(model.modelIdentifier);

          // If premium models are disabled, exclude premium models
          if (!packageLimits.premiumModelsEnabled) {
            const premiumModelPatterns = [
              'gpt-4', 'gpt-4o', 'claude-3-opus', 'claude-3-5-sonnet',
              'gemini-3-pro', 'gemini-3-pro-preview', 'mistral-large'
            ];
            const isPremium = premiumModelPatterns.some(pattern =>
              model.id.toLowerCase().includes(pattern) ||
              model.modelIdentifier.toLowerCase().includes(pattern)
            );
            return isAllowed && !isPremium;
          }

          return isAllowed;
        });

        logger.debug(`[RoutingEngine] After package model filter: ${candidates.length} candidates`);
      } else if (packageLimits.premiumModelsEnabled === false) {
        // If premium models are explicitly disabled, filter out premium models
        const premiumModelPatterns = [
          'gpt-4', 'gpt-4o', 'claude-3-opus', 'claude-3-5-sonnet',
          'gemini-3-pro', 'gemini-3-pro-preview', 'mistral-large'
        ];
        candidates = candidates.filter(model => {
          const isPremium = premiumModelPatterns.some(pattern =>
            model.id.toLowerCase().includes(pattern) ||
            model.modelIdentifier.toLowerCase().includes(pattern)
          );
          return !isPremium;
        });
        logger.debug(`[RoutingEngine] Premium models disabled, filtered to ${candidates.length} candidates`);
      }
    }

    // If no candidates, get all active models
    if (candidates.length === 0) {
      candidates = modelRegistry.getActiveModels();
    }

    // 2. Build routing signals for context-aware filtering and scoring
    const routingSignals = buildRoutingSignals(task, context);

    // 3. Filter by cost constraints (enhanced with routing signals and rule constraints)
    candidates = await this.filterByCost(candidates, task, context, settings, routingSignals, ruleActions);

    // 4. Filter by latency constraints from rules
    if (ruleActions.maxLatency) {
      candidates = candidates.filter(model => model.performance.avgLatencyMs <= ruleActions.maxLatency!);
      logger.debug(`[RoutingEngine] After latency filter (max ${ruleActions.maxLatency}ms): ${candidates.length} candidates`);
    }

    // 5. Score models (enhanced with weighted cost/performance engine)
    const scoredModels = this.scoreModels(candidates, task, context, settings, routingSignals);

    // 5. Select primary model
    if (scoredModels.length === 0) {
      throw new Error('No suitable model found for task');
    }

    const primaryModel = scoredModels[0].model;

    // Log model selection with context
    logger.info(`[RoutingEngine] Selected model: ${primaryModel.name} (${primaryModel.modelIdentifier})`);
    logger.info(`[RoutingEngine] Selection reasoning: ${scoredModels[0].reasoning}`);
    logger.info(`[RoutingEngine] Context: costPressure=${(routingSignals.costPressure * 100).toFixed(0)}%, qualityNeed=${(routingSignals.qualityNeed * 100).toFixed(0)}%, latencyTarget=${routingSignals.latencyTarget}ms`);

    // 6. Select fallback model (different provider if possible)
    const fallbackModel = this.selectFallback(primaryModel, scoredModels);

    // 7. Calculate estimates
    const estimatedCost = this.estimateCost(primaryModel, task.estimatedTokens);
    const estimatedLatency = primaryModel.performance.avgLatencyMs;

    return {
      primaryModel,
      fallbackModel,
      reasoning: scoredModels[0].reasoning + (ruleApplied ? ' (rule applied)' : ''),
      estimatedCost,
      estimatedLatency
    };
  }

  /**
   * Get effective settings with caching
   * Filters rules to only 'end-user' router type since RoutingEngine is for End User Router
   */
  private async getEffectiveSettings(userId?: string): Promise<EffectiveRouterSettings> {
    const cacheKey = userId || 'global';
    const cached = this.settingsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.settings;
    }

    // Filter rules to only 'end-user' router type since RoutingEngine is for End User Router
    const settings = await llmRouterSettingsService.getEffectiveSettings(userId, 'end-user');
    this.settingsCache.set(cacheKey, { settings, timestamp: Date.now() });
    return settings;
  }

  /**
   * Apply custom routing rules
   * Returns rule actions that should be applied to model selection
   */
  private async applyRoutingRules(
    task: TaskAnalysis,
    context: RoutingContext,
    rules: IRoutingRule[]
  ): Promise<{
    preferredModel?: string;
    preferredProvider?: string;
    forceProvider?: string;
    blockedModels?: string[];
    blockedProviders?: string[];
    costLimit?: number;
    maxLatency?: number;
    costPreference?: 'low' | 'balanced' | 'quality';
    fallbackChain?: IFallbackStep[];
    ruleName: string
  } | null> {
    // Sort rules by priority (highest first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      // Check schedule constraint first
      if (rule.schedule && !this.isScheduleActive(rule.schedule)) {
        logger.debug(`[RoutingEngine] Rule "${rule.name}" skipped - schedule not active`);
        continue;
      }

      const testResult = await llmRouterSettingsService.testRoutingRule(rule, {
        agentRole: task.agentRole,
        taskType: task.taskType,
        complexity: task.complexity,
        estimatedTokens: task.estimatedTokens
      });

      if (testResult.matches) {
        logger.info(`Routing rule matched: ${rule.name}`);

        // Build fallback chain if present
        const fallbackChain = this.buildFallbackChain(rule);

        // Return all rule actions for the caller to apply
        return {
          preferredModel: rule.actions.preferredModel,
          preferredProvider: rule.actions.preferredProvider,
          forceProvider: rule.actions.forceProvider,
          blockedModels: rule.actions.blockedModels,
          blockedProviders: rule.actions.blockedProviders,
          costLimit: rule.actions.costLimit,
          maxLatency: rule.actions.maxLatency,
          costPreference: rule.actions.costPreference,
          fallbackChain: fallbackChain.length > 0 ? fallbackChain : undefined,
          ruleName: rule.name
        };
      }
    }

    return null;
  }

  /**
   * Apply model priorities from settings
   */
  private applyModelPriorities(
    candidates: ModelCapabilities[],
    priorities: EffectiveRouterSettings['modelPriorities'],
    task: TaskAnalysis
  ): ModelCapabilities[] {
    if (!priorities) return candidates;

    // Check task type preferences
    if (priorities.taskTypePreferences && task.taskType) {
      const preferredModels = priorities.taskTypePreferences[task.taskType];
      if (preferredModels && preferredModels.length > 0) {
        const preferred = candidates.filter(m => preferredModels.includes(m.id));
        const others = candidates.filter(m => !preferredModels.includes(m.id));
        return [...preferred, ...others];
      }
    }

    // Check agent role preferences
    if (priorities.agentRolePreferences && task.agentRole) {
      const preferredModels = priorities.agentRolePreferences[task.agentRole];
      if (preferredModels && preferredModels.length > 0) {
        const preferred = candidates.filter(m => preferredModels.includes(m.id));
        const others = candidates.filter(m => !preferredModels.includes(m.id));
        return [...preferred, ...others];
      }
    }

    // Apply provider rankings
    if (priorities.providerRankings) {
      const providerMap = new Map(Object.entries(priorities.providerRankings));
      candidates.sort((a, b) => {
        const aRank = providerMap.get(a.provider) || 999;
        const bRank = providerMap.get(b.provider) || 999;
        return aRank - bRank;
      });
    }

    // Apply model rankings
    if (priorities.modelRankings) {
      const modelMap = new Map(Object.entries(priorities.modelRankings));
      candidates.sort((a, b) => {
        const aRank = modelMap.get(a.id) || 999;
        const bRank = modelMap.get(b.id) || 999;
        return aRank - bRank;
      });
    }

    return candidates;
  }

  private async filterByCost(
    models: ModelCapabilities[],
    task: TaskAnalysis,
    context: RoutingContext,
    settings: EffectiveRouterSettings,
    routingSignals: RoutingSignals,
    ruleActions?: { costLimit?: number; costPreference?: 'low' | 'balanced' | 'quality' }
  ): Promise<ModelCapabilities[]> {
    let filtered = models;

    // Apply cost limit from routing rule (takes precedence)
    if (ruleActions?.costLimit) {
      filtered = filtered.filter(model => {
        const estimatedCost = this.estimateCost(model, task.estimatedTokens);
        return estimatedCost <= ruleActions.costLimit!;
      });
      logger.debug(`[RoutingEngine] After rule cost limit ($${ruleActions.costLimit}): ${filtered.length} candidates`);
    }

    // Apply cost controls from settings
    if (settings.costControls) {
      const { globalBudget, userBudgets } = settings.costControls;

      // Check global budget
      if (globalBudget?.perRequestLimit) {
        // Dynamically adjust limit based on cost pressure
        let effectiveLimit = globalBudget.perRequestLimit;
        if (routingSignals.costPressure > 0.7) {
          // Reduce limit by 30% when cost pressure is high
          effectiveLimit = effectiveLimit * 0.7;
          logger.info(`[RoutingEngine] High cost pressure detected (${(routingSignals.costPressure * 100).toFixed(0)}%), reducing per-request limit to $${effectiveLimit.toFixed(4)}`);
        }

        filtered = filtered.filter(model => {
          const estimatedCost = this.estimateCost(model, task.estimatedTokens);
          return estimatedCost <= effectiveLimit;
        });
      }

      // Check user budget if applicable
      if (context.userId && userBudgets) {
        const userBudget = userBudgets[context.userId];
        if (userBudget?.perRequestLimit) {
          // Apply same cost pressure adjustment
          let effectiveLimit = userBudget.perRequestLimit;
          if (routingSignals.costPressure > 0.7) {
            effectiveLimit = effectiveLimit * 0.7;
          }

          filtered = filtered.filter(model => {
            const estimatedCost = this.estimateCost(model, task.estimatedTokens);
            return estimatedCost <= effectiveLimit;
          });
        }
      }
    }

    // Apply package limits with context-aware adjustments
    if (context.packageLimits?.maxMonthlyBudget) {
      const budgetRemaining =
        (context.packageLimits.maxMonthlyBudget || Infinity) -
        (context.projectState?.budgetUsed || 0);

      // When quality need is high and budget allows, relax cost constraints slightly
      let effectiveBudgetRemaining = budgetRemaining;
      if (routingSignals.qualityNeed > 0.7 && routingSignals.budgetUsageRatio !== undefined && routingSignals.budgetUsageRatio < 0.5) {
        // Allow 20% more cost for high-quality tasks when budget is healthy
        effectiveBudgetRemaining = budgetRemaining * 1.2;
        logger.info(`[RoutingEngine] High quality need (${(routingSignals.qualityNeed * 100).toFixed(0)}%) with healthy budget, allowing up to $${effectiveBudgetRemaining.toFixed(4)} per request`);
      } else if (routingSignals.costPressure > 0.7) {
        // Reduce effective budget when cost pressure is high
        effectiveBudgetRemaining = budgetRemaining * 0.8;
        logger.info(`[RoutingEngine] High cost pressure, reducing effective budget to $${effectiveBudgetRemaining.toFixed(4)}`);
      }

      filtered = filtered.filter(model => {
        const estimatedCost = this.estimateCost(model, task.estimatedTokens);
        return estimatedCost <= effectiveBudgetRemaining;
      });
    }

    return filtered;
  }

  private scoreModels(
    models: ModelCapabilities[],
    task: TaskAnalysis,
    context: RoutingContext,
    settings: EffectiveRouterSettings,
    routingSignals: RoutingSignals
  ): ScoredModel[] {
    // Merge preferred models from settings and context
    const preferredModels = [
      ...(settings.defaultPreferredModels || []),
      ...(context.userPreferences?.preferredModels || [])
    ];

    return models
      .map(model => {
        const scoreResult = this.computeModelScore(
          model,
          task,
          context,
          settings,
          routingSignals,
          preferredModels
        );

        return {
          model,
          score: scoreResult.score,
          reasoning: scoreResult.reasoning
        };
      })
      .sort((a, b) => b.score - a.score); // Sort by score descending
  }

  /**
   * Compute model score using weighted cost/performance engine
   */
  private computeModelScore(
    model: ModelCapabilities,
    task: TaskAnalysis,
    context: RoutingContext,
    settings: EffectiveRouterSettings,
    routingSignals: RoutingSignals,
    preferredModels: string[]
  ): { score: number; reasoning: string } {
    // Get weights from settings with defaults
    const costWeight = settings.performanceTuning?.costWeight ?? 0.33;
    const latencyWeight = settings.performanceTuning?.latencyWeight ?? 0.33;
    const qualityWeight = settings.performanceTuning?.qualityWeight ?? 0.34;

    // Normalize weights to sum to 1.0
    const totalWeight = costWeight + latencyWeight + qualityWeight;
    const normalizedCostWeight = costWeight / totalWeight;
    const normalizedLatencyWeight = latencyWeight / totalWeight;
    const normalizedQualityWeight = qualityWeight / totalWeight;

    // Calculate base metrics
    const estimatedCost = this.estimateCost(model, task.estimatedTokens);
    const avgLatency = model.performance.avgLatencyMs;
    const reliability = model.performance.reliability;

    // Normalize metrics to 0-1 scale for scoring
    // Cost: lower is better, normalize against max expected cost ($0.10 per request)
    const normalizedCost = Math.min(estimatedCost / 0.10, 1.0);
    const costScore = 1.0 - normalizedCost; // Invert so lower cost = higher score

    // Latency: lower is better, normalize against target latency
    const latencyDiff = Math.abs(avgLatency - routingSignals.latencyTarget);
    const maxLatencyDiff = Math.max(routingSignals.latencyTarget, 5000); // Cap at 5s
    const normalizedLatency = Math.min(latencyDiff / maxLatencyDiff, 1.0);
    const latencyScore = 1.0 - normalizedLatency; // Invert so lower latency = higher score

    // Quality: reliability + capability match
    const capabilityMatch = task.requiredCapabilities.length > 0
      ? task.requiredCapabilities.filter(cap => {
        const capKey = cap as keyof ModelCapabilities['capabilities'];
        return model.capabilities[capKey] === true;
      }).length / task.requiredCapabilities.length
      : 0.5; // Default if no specific requirements
    const qualityScore = (reliability * 0.6) + (capabilityMatch * 0.4);

    // Apply weighted scoring
    let weightedScore =
      (costScore * normalizedCostWeight) +
      (latencyScore * normalizedLatencyWeight) +
      (qualityScore * normalizedQualityWeight);

    // Context-driven boosts/penalties
    const boosts: string[] = [];
    const penalties: string[] = [];

    // Cost pressure adjustment
    if (routingSignals.costPressure > 0.7) {
      // High cost pressure: heavily penalize expensive models
      const costPenalty = normalizedCost * routingSignals.costPressure * 0.3;
      weightedScore -= costPenalty;
      penalties.push(`High cost pressure (${(routingSignals.costPressure * 100).toFixed(0)}%)`);
    } else if (routingSignals.costPressure < 0.3) {
      // Low cost pressure: allow premium models
      boosts.push('Low cost pressure');
    }

    // Quality need adjustment
    if (routingSignals.qualityNeed > 0.7) {
      // High quality need: boost reliable, capable models
      const qualityBoost = qualityScore * routingSignals.qualityNeed * 0.2;
      weightedScore += qualityBoost;
      boosts.push(`High quality requirement (${(routingSignals.qualityNeed * 100).toFixed(0)}%)`);
    }

    // Agent role match boost
    if (task.agentRole && model.recommendedFor?.agentRoles?.includes(task.agentRole)) {
      const roleBoost = 0.15 * routingSignals.agentRolePriority || 1.0;
      weightedScore += roleBoost;
      boosts.push(`Recommended for ${task.agentRole}`);
    }

    // Task type match boost
    if (model.recommendedFor?.taskTypes?.includes(task.taskType)) {
      weightedScore += 0.1;
      boosts.push(`Optimized for ${task.taskType}`);
    }

    // Complexity match boost
    if (model.recommendedFor?.complexity?.includes(task.complexity)) {
      weightedScore += 0.08;
      boosts.push(`Handles ${task.complexity} complexity`);
    }

    // Preferred model boost
    if (preferredModels.includes(model.id)) {
      weightedScore += 0.12;
      boosts.push('User preferred model');
    }

    // Latency constraint penalty
    if (settings.performanceTuning?.maxLatencyMs && avgLatency > settings.performanceTuning.maxLatencyMs) {
      const latencyPenalty = (avgLatency - settings.performanceTuning.maxLatencyMs) / 1000 * 0.1;
      weightedScore -= Math.min(latencyPenalty, 0.3);
      penalties.push(`Exceeds max latency (${settings.performanceTuning.maxLatencyMs}ms)`);
    }

    // Budget constraint penalty
    if (routingSignals.budgetRemaining !== undefined && estimatedCost > routingSignals.budgetRemaining) {
      weightedScore -= 0.5; // Heavy penalty if exceeds remaining budget
      penalties.push(`Exceeds remaining budget ($${routingSignals.budgetRemaining.toFixed(4)})`);
    }

    // Build reasoning string with top contributing factors
    const reasoningParts: string[] = [];

    if (boosts.length > 0) {
      reasoningParts.push(`Boosts: ${boosts.slice(0, 3).join(', ')}`);
    }

    if (penalties.length > 0) {
      reasoningParts.push(`Penalties: ${penalties.slice(0, 2).join(', ')}`);
    }

    reasoningParts.push(`Cost: $${estimatedCost.toFixed(4)} (weight: ${(normalizedCostWeight * 100).toFixed(0)}%)`);
    reasoningParts.push(`Latency: ${avgLatency}ms (weight: ${(normalizedLatencyWeight * 100).toFixed(0)}%)`);
    reasoningParts.push(`Quality: ${(qualityScore * 100).toFixed(0)}% (weight: ${(normalizedQualityWeight * 100).toFixed(0)}%)`);

    const reasoning = reasoningParts.join('; ');

    // Convert weighted score (0-1) to a larger scale for compatibility
    const finalScore = Math.max(0, weightedScore * 100);

    return {
      score: finalScore,
      reasoning
    };
  }

  /**
   * Build reasoning string (legacy method, now handled by computeModelScore)
   * Kept for backwards compatibility
   */
  private buildReasoning(
    model: ModelCapabilities,
    task: TaskAnalysis,
    context: RoutingContext,
    estimatedCost: number
  ): string {
    const reasons: string[] = [];

    if (task.agentRole && model.recommendedFor?.agentRoles?.includes(task.agentRole)) {
      reasons.push(`Recommended for ${task.agentRole}`);
    }

    if (model.recommendedFor?.taskTypes?.includes(task.taskType)) {
      reasons.push(`Optimized for ${task.taskType} tasks`);
    }

    if (model.capabilities.structuredOutput && task.outputType === 'structured') {
      reasons.push('Supports structured output');
    }

    if (model.capabilities.codeGeneration && task.taskType === 'code-generation') {
      reasons.push('Excellent code generation');
    }

    if (model.capabilities.fastResponse && task.latencyRequirement === 'fast') {
      reasons.push('Fast response time');
    }

    reasons.push(`Estimated cost: $${estimatedCost.toFixed(4)}`);
    reasons.push(`Avg latency: ${model.performance.avgLatencyMs}ms`);

    return reasons.join('; ');
  }

  private selectFallback(
    primary: ModelCapabilities,
    scoredModels: ScoredModel[]
  ): ModelCapabilities | undefined {
    // Prefer fallback from different provider
    const differentProvider = scoredModels.find(
      sm => sm.model.provider !== primary.provider && sm.model.status === 'active' && sm.model.isEnabled
    );

    if (differentProvider) {
      return differentProvider.model;
    }

    // Otherwise, use second best model
    if (scoredModels.length > 1) {
      return scoredModels[1].model;
    }

    return undefined;
  }

  private estimateCost(model: ModelCapabilities, estimatedTokens: number): number {
    // Estimate 70% input, 30% output tokens
    const inputTokens = estimatedTokens * 0.7;
    const outputTokens = estimatedTokens * 0.3;

    const inputCost = (inputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens;
    const outputCost = (outputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens;

    return inputCost + outputCost;
  }

  // ============ SCHEDULE EVALUATION ============

  /**
   * Check if a routing rule's schedule is currently active
   */
  isScheduleActive(schedule: ISchedule | undefined): boolean {
    if (!schedule || !schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
      return true; // No schedule = always active
    }

    try {
      const now = new Date();

      // Get current time in the schedule's timezone
      const options: Intl.DateTimeFormatOptions = {
        timeZone: schedule.timezone || 'UTC',
        weekday: 'short',
        hour: 'numeric',
        hour12: false,
      };

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);

      // Get day of week (0 = Sunday)
      const dayMap: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
      };
      const weekdayPart = parts.find(p => p.type === 'weekday');
      const currentDay = weekdayPart ? dayMap[weekdayPart.value] : now.getDay();

      // Get hour
      const hourPart = parts.find(p => p.type === 'hour');
      const currentHour = hourPart ? parseInt(hourPart.value) : now.getHours();

      // Check if current day is in schedule
      if (!schedule.daysOfWeek.includes(currentDay)) {
        return false;
      }

      // Check if current hour is within schedule
      const { startHour, endHour } = schedule;

      if (startHour <= endHour) {
        // Same day schedule (e.g., 9-17)
        return currentHour >= startHour && currentHour < endHour;
      } else {
        // Overnight schedule (e.g., 22-6)
        return currentHour >= startHour || currentHour < endHour;
      }
    } catch (error: unknown) {
      logger.warn(`[RoutingEngine] Schedule evaluation failed:`, toApiError(error));
      return true; // Default to active on error
    }
  }

  // ============ CIRCUIT BREAKER MANAGEMENT ============

  /**
   * Get circuit breaker state for a model
   */
  getCircuitBreakerState(modelId: string): CircuitBreakerState {
    let state = this.circuitBreakers.get(modelId);

    if (!state) {
      state = {
        modelId,
        failures: 0,
        lastFailure: 0,
        isOpen: false,
      };
      this.circuitBreakers.set(modelId, state);
    }

    // Check if circuit breaker should be reset (cooldown expired)
    if (state.isOpen && Date.now() - state.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
      state.isOpen = false;
      state.failures = 0;
      logger.info(`[RoutingEngine] Circuit breaker reset for model: ${modelId}`);
    }

    return state;
  }

  /**
   * Record a failure for circuit breaker
   */
  recordFailure(modelId: string, threshold: number = 50): void {
    const state = this.getCircuitBreakerState(modelId);
    state.failures++;
    state.lastFailure = Date.now();

    // Calculate error rate (simplified - would need total requests in production)
    // For now, trip after 3 consecutive failures
    if (state.failures >= 3) {
      state.isOpen = true;
      logger.warn(`[RoutingEngine] Circuit breaker opened for model: ${modelId}`);
    }
  }

  /**
   * Record a success for circuit breaker
   */
  recordSuccess(modelId: string): void {
    const state = this.getCircuitBreakerState(modelId);
    state.failures = Math.max(0, state.failures - 1);
    if (state.failures === 0) {
      state.isOpen = false;
    }
  }

  /**
   * Check if a model's circuit breaker is open
   */
  isCircuitBreakerOpen(modelId: string): boolean {
    return this.getCircuitBreakerState(modelId).isOpen;
  }

  // ============ FALLBACK CHAIN EXECUTION ============

  /**
   * Build a fallback chain for a rule
   */
  buildFallbackChain(rule: IRoutingRule): IFallbackStep[] {
    if (!rule.fallbackChain || rule.fallbackChain.length === 0) {
      return [];
    }

    // Filter out models with open circuit breakers
    return rule.fallbackChain.filter(step => {
      if (this.isCircuitBreakerOpen(step.modelId)) {
        logger.debug(`[RoutingEngine] Skipping ${step.modelId} - circuit breaker open`);
        return false;
      }

      // Verify model exists and is active
      const model = modelRegistry.getModel(step.modelId);
      return model && model.status === 'active' && model.isEnabled;
    });
  }

  /**
   * Get the next model in the fallback chain
   */
  getNextFallback(
    fallbackChain: IFallbackStep[],
    failedModels: string[]
  ): IFallbackStep | null {
    for (const step of fallbackChain) {
      if (!failedModels.includes(step.modelId) && !this.isCircuitBreakerOpen(step.modelId)) {
        return step;
      }
    }
    return null;
  }

  /**
   * Execute a request with fallback chain
   * This is a helper that wraps the actual LLM call with fallback logic
   */
  async executeWithFallback<T>(
    fallbackChain: IFallbackStep[],
    executor: (modelId: string, timeoutMs: number) => Promise<T>,
    onFallback?: (fromModel: string, toModel: string, error: Error) => void
  ): Promise<{ result: T; modelUsed: string; fallbacksUsed: number }> {
    const failedModels: string[] = [];
    let lastError: Error | null = null;
    let fallbacksUsed = 0;

    for (const step of fallbackChain) {
      if (this.isCircuitBreakerOpen(step.modelId)) {
        logger.debug(`[RoutingEngine] Skipping ${step.modelId} - circuit breaker open`);
        continue;
      }

      let retries = 0;
      while (retries <= step.maxRetries) {
        try {
          const result = await Promise.race([
            executor(step.modelId, step.timeoutMs),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout after ${step.timeoutMs}ms`)), step.timeoutMs)
            )
          ]);

          this.recordSuccess(step.modelId);
          return { result, modelUsed: step.modelId, fallbacksUsed };
        } catch (error: any) {
          retries++;
          lastError = error;
          logger.warn(`[RoutingEngine] Model ${step.modelId} failed (attempt ${retries}/${step.maxRetries + 1}): ${error.message}`);
        }
      }

      // All retries exhausted for this model
      this.recordFailure(step.modelId, step.circuitBreakerThreshold || 50);
      failedModels.push(step.modelId);

      // Notify about fallback
      const nextStep = this.getNextFallback(fallbackChain, failedModels);
      if (nextStep && onFallback) {
        onFallback(step.modelId, nextStep.modelId, lastError!);
      }
      fallbacksUsed++;
    }

    throw lastError || new Error('All models in fallback chain failed');
  }

  /**
   * Get all circuit breaker states (for monitoring)
   */
  getCircuitBreakerStates(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
    logger.info('[RoutingEngine] All circuit breakers reset');
  }
}

export const routingEngine = new RoutingEngine();

