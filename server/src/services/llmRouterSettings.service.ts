/**
 * LLM Router Settings Service
 * Manages router configuration including global defaults and per-user overrides
 * 
 * IMPORTANT: This service is for END USER ROUTER only.
 * - Manages RoutingRule documents with routerType='end-user'
 * - Completely independent from Internal Router
 * - Internal Router uses InternalRoutingConfig model directly
 * - These two routers do NOT share state, rules, or configuration
 */

import { LLMRouterSettings, ILLMRouterSettings } from '../models/LLMRouterSettings.model.js';
import { RoutingRule, IRoutingRule } from '../models/RoutingRule.model.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

export interface EffectiveRouterSettings {
  routingRules: IRoutingRule[];
  costControls?: ILLMRouterSettings['costControls'];
  modelPriorities?: ILLMRouterSettings['modelPriorities'];
  performanceTuning?: ILLMRouterSettings['performanceTuning'];
  defaultCostPreference?: 'low' | 'balanced' | 'quality';
  defaultPreferredModels?: string[];
  defaultBlockedModels?: string[];
  enabled: boolean;
  enableIntelligentRouting: boolean;
  enableCostOptimization: boolean;
  enablePerformanceOptimization: boolean;
}

class LLMRouterSettingsService {
  /**
   * Get global router settings
   */
  async getGlobalSettings(): Promise<ILLMRouterSettings | null> {
    try {
      const settings = await LLMRouterSettings.findOne({ scope: 'global' })
        .populate('routingRules')
        .lean();
      return settings;
    } catch (error: unknown) {
      logger.error('Failed to get global router settings:', error);
      throw error;
    }
  }

  /**
   * Get user-specific router settings
   */
  async getUserSettings(userId: string): Promise<ILLMRouterSettings | null> {
    try {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`Invalid userId provided to getUserSettings: ${userId}`);
        return null; // Return null if invalid ID to prevent crash
      }

      const settings = await LLMRouterSettings.findOne({
        scope: 'user',
        userId: new mongoose.Types.ObjectId(userId)
      })
        .populate('routingRules')
        .lean();
      return settings;
    } catch (error: unknown) {
      logger.error(`Failed to get user router settings for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get effective settings (global + user overrides merged)
   * @param userId Optional user ID for user-specific overrides
   * @param routerType Optional router type filter ('end-user' | 'internal')
   */
  async getEffectiveSettings(userId?: string, routerType?: 'end-user' | 'internal'): Promise<EffectiveRouterSettings> {
    try {
      // Get global settings
      const globalSettings = await this.getGlobalSettings();

      // Get user settings if userId provided
      let userSettings: ILLMRouterSettings | null = null;
      if (userId) {
        userSettings = await this.getUserSettings(userId);
      }

      // Merge settings (user overrides global)
      const effective: EffectiveRouterSettings = {
        routingRules: [],
        enabled: true,
        enableIntelligentRouting: true,
        enableCostOptimization: true,
        enablePerformanceOptimization: true
      };

      // Start with global defaults
      if (globalSettings) {
        effective.routingRules = (globalSettings.routingRules as any) || [];
        effective.costControls = globalSettings.costControls;
        effective.modelPriorities = globalSettings.modelPriorities;
        effective.performanceTuning = globalSettings.performanceTuning;
        effective.defaultCostPreference = globalSettings.defaultCostPreference || 'balanced';
        effective.defaultPreferredModels = globalSettings.defaultPreferredModels || [];
        effective.defaultBlockedModels = globalSettings.defaultBlockedModels || [];
        effective.enabled = globalSettings.enabled;
        effective.enableIntelligentRouting = globalSettings.enableIntelligentRouting;
        effective.enableCostOptimization = globalSettings.enableCostOptimization;
        effective.enablePerformanceOptimization = globalSettings.enablePerformanceOptimization;
      }

      // Apply user overrides
      if (userSettings && userSettings.enabled) {
        if (userSettings.routingRules && userSettings.routingRules.length > 0) {
          effective.routingRules = (userSettings.routingRules as any) || effective.routingRules;
        }
        if (userSettings.costControls) {
          effective.costControls = { ...effective.costControls, ...userSettings.costControls };
        }
        if (userSettings.modelPriorities) {
          effective.modelPriorities = { ...effective.modelPriorities, ...userSettings.modelPriorities };
        }
        if (userSettings.performanceTuning) {
          effective.performanceTuning = { ...effective.performanceTuning, ...userSettings.performanceTuning };
        }
        if (userSettings.defaultCostPreference) {
          effective.defaultCostPreference = userSettings.defaultCostPreference;
        }
        if (userSettings.defaultPreferredModels) {
          effective.defaultPreferredModels = userSettings.defaultPreferredModels;
        }
        if (userSettings.defaultBlockedModels) {
          effective.defaultBlockedModels = userSettings.defaultBlockedModels;
        }
        effective.enabled = userSettings.enabled;
        effective.enableIntelligentRouting = userSettings.enableIntelligentRouting;
        effective.enableCostOptimization = userSettings.enableCostOptimization;
        effective.enablePerformanceOptimization = userSettings.enablePerformanceOptimization;
      }

      // Load enabled routing rules from database, filtered by routerType if specified
      // Rules are stored separately and should all be considered for routing
      const ruleQuery: any = { enabled: true };
      if (routerType) {
        ruleQuery.routerType = routerType;
      }

      const allEnabledRules = await RoutingRule.find(ruleQuery)
        .sort({ priority: -1 })
        .lean();

      // If settings has specific rule references, use those; otherwise use all enabled rules
      if (effective.routingRules.length > 0) {
        const ruleIds = effective.routingRules.map((r: any) =>
          typeof r === 'object' && r._id ? r._id.toString() : r.toString()
        );
        // Filter to only referenced rules that are enabled and match routerType
        effective.routingRules = allEnabledRules.filter(rule =>
          ruleIds.includes(rule._id.toString())
        ) as IRoutingRule[];
      } else {
        // No specific rules referenced, use all enabled rules (already filtered by routerType)
        effective.routingRules = allEnabledRules as IRoutingRule[];
      }

      return effective;
    } catch (error: unknown) {
      logger.error('Failed to get effective router settings:', error);
      throw error;
    }
  }

  /**
   * Update global router settings
   */
  async updateGlobalSettings(settings: Partial<ILLMRouterSettings>): Promise<ILLMRouterSettings> {
    try {
      // Get current settings to merge metadata properly
      const currentSettings = await LLMRouterSettings.findOne({ scope: 'global' });

      // Prepare update object with proper metadata merging
      const updateObj: any = { ...settings, scope: 'global' };

      // If metadata is being updated, merge it with existing metadata
      if (settings.metadata) {
        if (currentSettings?.metadata) {
          updateObj.metadata = {
            ...currentSettings.metadata,
            ...settings.metadata,
            // Deep merge aiRuleConfigurator if it exists
            aiRuleConfigurator: {
              ...(currentSettings.metadata.aiRuleConfigurator || {}),
              ...(settings.metadata.aiRuleConfigurator || {})
            }
          };
        } else {
          // If no existing metadata, use the new one
          updateObj.metadata = settings.metadata;
        }
      }

      // Use $set to ensure proper nested updates
      const updated = await LLMRouterSettings.findOneAndUpdate(
        { scope: 'global' },
        { $set: updateObj },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate('routingRules');

      logger.info('Global router settings updated', {
        hasMetadata: !!updated?.metadata,
        hasAiRuleConfigurator: !!updated?.metadata?.aiRuleConfigurator,
        scoringMode: updated?.metadata?.aiRuleConfigurator?.scoringMode
      });
      return updated;
    } catch (error: unknown) {
      logger.error('Failed to update global router settings:', error);
      throw error;
    }
  }

  /**
   * Update user router settings
   */
  async updateUserSettings(userId: string, settings: Partial<ILLMRouterSettings>): Promise<ILLMRouterSettings> {
    try {
      const updated = await LLMRouterSettings.findOneAndUpdate(
        { scope: 'user', userId: new mongoose.Types.ObjectId(userId) },
        { ...settings, scope: 'user', userId: new mongoose.Types.ObjectId(userId) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate('routingRules');

      logger.info(`User router settings updated for ${userId}`);
      return updated;
    } catch (error: unknown) {
      logger.error(`Failed to update user router settings for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reset user settings to global defaults
   */
  async resetUserSettings(userId: string): Promise<void> {
    try {
      await LLMRouterSettings.deleteOne({
        scope: 'user',
        userId: new mongoose.Types.ObjectId(userId)
      });
      logger.info(`User router settings reset to global defaults for ${userId}`);
    } catch (error: unknown) {
      logger.error(`Failed to reset user router settings for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Validate router settings
   */
  validateSettings(settings: Partial<ILLMRouterSettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate performance tuning weights sum to ~1
    if (settings.performanceTuning) {
      const { latencyWeight = 0, costWeight = 0, qualityWeight = 0 } = settings.performanceTuning;
      const sum = latencyWeight + costWeight + qualityWeight;
      if (Math.abs(sum - 1) > 0.01) {
        errors.push(`Performance tuning weights must sum to 1.0 (current: ${sum})`);
      }
    }

    // Validate cost controls
    if (settings.costControls?.globalBudget) {
      const { monthlyLimit, dailyLimit, perRequestLimit } = settings.costControls.globalBudget;
      if (dailyLimit && monthlyLimit && dailyLimit * 30 > monthlyLimit) {
        errors.push('Daily limit * 30 should not exceed monthly limit');
      }
      if (perRequestLimit && dailyLimit && perRequestLimit > dailyLimit) {
        errors.push('Per-request limit should not exceed daily limit');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Test a routing rule against a sample task
   */
  async testRoutingRule(
    rule: Partial<IRoutingRule>,
    sampleTask: {
      agentRole?: string;
      taskType?: string;
      complexity?: 'simple' | 'moderate' | 'complex';
      requestType?: string;
      estimatedTokens?: number;
      projectPhase?: string;
    }
  ): Promise<{ matches: boolean; reason: string }> {
    try {
      if (!rule.conditions) {
        return { matches: false, reason: 'Rule has no conditions' };
      }

      const conditions = rule.conditions;
      let matches = true;
      const reasons: string[] = [];

      // Check agent role
      if (conditions.agentRoles && conditions.agentRoles.length > 0) {
        if (!sampleTask.agentRole || !conditions.agentRoles.includes(sampleTask.agentRole)) {
          matches = false;
          reasons.push(`Agent role '${sampleTask.agentRole}' not in allowed roles`);
        }
      }

      // Check task type
      if (conditions.taskTypes && conditions.taskTypes.length > 0) {
        if (!sampleTask.taskType || !conditions.taskTypes.includes(sampleTask.taskType)) {
          matches = false;
          reasons.push(`Task type '${sampleTask.taskType}' not in allowed types`);
        }
      }

      // Check complexity
      if (conditions.complexity && conditions.complexity.length > 0) {
        if (!sampleTask.complexity || !conditions.complexity.includes(sampleTask.complexity)) {
          matches = false;
          reasons.push(`Complexity '${sampleTask.complexity}' not in allowed complexities`);
        }
      }

      // Check request type
      if (conditions.requestTypes && conditions.requestTypes.length > 0) {
        if (!sampleTask.requestType || !conditions.requestTypes.includes(sampleTask.requestType)) {
          matches = false;
          reasons.push(`Request type '${sampleTask.requestType}' not in allowed types`);
        }
      }

      // Check token range
      if (conditions.minTokens !== undefined && sampleTask.estimatedTokens !== undefined) {
        if (sampleTask.estimatedTokens < conditions.minTokens) {
          matches = false;
          reasons.push(`Token count ${sampleTask.estimatedTokens} below minimum ${conditions.minTokens}`);
        }
      }
      if (conditions.maxTokens !== undefined && sampleTask.estimatedTokens !== undefined) {
        if (sampleTask.estimatedTokens > conditions.maxTokens) {
          matches = false;
          reasons.push(`Token count ${sampleTask.estimatedTokens} above maximum ${conditions.maxTokens}`);
        }
      }

      // Check project phase
      if (conditions.projectPhases && conditions.projectPhases.length > 0) {
        if (!sampleTask.projectPhase || !conditions.projectPhases.includes(sampleTask.projectPhase)) {
          matches = false;
          reasons.push(`Project phase '${sampleTask.projectPhase}' not in allowed phases`);
        }
      }

      return {
        matches,
        reason: matches ? 'Rule matches' : reasons.join('; ')
      };
    } catch (error: unknown) {
      logger.error('Failed to test routing rule:', error);
      throw error;
    }
  }

  /**
   * Initialize default global settings if none exist
   */
  async initializeDefaultSettings(): Promise<void> {
    try {
      const existing = await LLMRouterSettings.findOne({ scope: 'global' });
      if (existing) {
        return;
      }

      const defaultSettings: Partial<ILLMRouterSettings> = {
        scope: 'global',
        enabled: true,
        enableIntelligentRouting: true,
        enableCostOptimization: true,
        enablePerformanceOptimization: true,
        defaultCostPreference: 'balanced',
        costControls: {
          costPreference: 'balanced'
        },
        performanceTuning: {
          latencyWeight: 0.33,
          costWeight: 0.33,
          qualityWeight: 0.34,
          enableCaching: true
        }
      };

      await LLMRouterSettings.create(defaultSettings);
      logger.info('Default global router settings initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize default router settings:', error);
      throw error;
    }
  }
}

export const llmRouterSettingsService = new LLMRouterSettingsService();


