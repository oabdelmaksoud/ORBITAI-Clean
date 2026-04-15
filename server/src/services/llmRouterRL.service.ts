/**
 * Reinforcement Learning Router Service
 * Uses multi-armed bandit algorithm to optimize cost/quality trade-offs
 * Learns optimal routing strategies through trial and exploration
 */

import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';
import { modelRegistry } from './llm/models/ModelRegistry.js';
import { TaskAnalysis } from './TaskAnalyzer.js';

export interface RLState {
  modelId: string;
  taskType: string;
  agentRole?: string;
  totalPulls: number; // Number of times this arm was selected
  totalReward: number; // Cumulative reward
  averageReward: number; // Average reward per pull
  lastUpdated: Date;
}

export interface RLReward {
  modelId: string;
  taskType: string;
  agentRole?: string;
  reward: number; // 0-1 normalized reward
  cost: number;
  latency: number;
  success: boolean;
  quality?: number; // 0-100 quality score if available
}

export interface RLSelection {
  modelId: string;
  confidence: number;
  explorationBonus: number;
  exploitationScore: number;
  reasoning: string;
}

class ReinforcementLearningRouterService {
  private rlStates: Map<string, RLState> = new Map();
  private readonly EXPLORATION_RATE = 0.1; // 10% exploration, 90% exploitation
  private readonly LEARNING_RATE = 0.1; // How quickly to update estimates
  private readonly MIN_PULLS_FOR_EXPLOITATION = 5; // Minimum pulls before exploiting

  /**
   * Select model using Upper Confidence Bound (UCB) algorithm
   * Balances exploration vs exploitation
   */
  async selectModel(
    task: TaskAnalysis,
    availableModels: string[]
  ): Promise<RLSelection | null> {
    try {
      if (availableModels.length === 0) {
        return null;
      }

      // Get or create RL states for each model
      const states = await this.getOrCreateStates(task, availableModels);

      // Calculate UCB scores for each model
      const scoredModels = states.map(state => {
        const exploitationScore = state.averageReward;
        const explorationBonus = this.calculateExplorationBonus(
          state.totalPulls,
          states.reduce((sum, s) => sum + s.totalPulls, 0)
        );
        const ucbScore = exploitationScore + explorationBonus;

        return {
          modelId: state.modelId,
          exploitationScore,
          explorationBonus,
          ucbScore,
          state
        };
      });

      // Sort by UCB score (descending)
      scoredModels.sort((a, b) => b.ucbScore - a.ucbScore);

      const bestModel = scoredModels[0];
      const totalPulls = bestModel.state.totalPulls;

      // Calculate confidence based on sample size
      const confidence = Math.min(0.95, totalPulls / 20); // Max confidence at 20+ pulls

      return {
        modelId: bestModel.modelId,
        confidence,
        explorationBonus: bestModel.explorationBonus,
        exploitationScore: bestModel.exploitationScore,
        reasoning: `RL selection: ${bestModel.modelId} (UCB score: ${bestModel.ucbScore.toFixed(3)}, pulls: ${totalPulls}, avg reward: ${bestModel.exploitationScore.toFixed(3)})`
      };
    } catch (error: unknown) {
      logger.error('Failed to select model using RL:', error);
      return null;
    }
  }

  /**
   * Update RL state based on observed reward
   */
  async updateReward(reward: RLReward): Promise<void> {
    try {
      const stateKey = this.getStateKey(reward.taskType, reward.modelId, reward.agentRole);
      const state = this.rlStates.get(stateKey);

      if (!state) {
        // Create new state
        this.rlStates.set(stateKey, {
          modelId: reward.modelId,
          taskType: reward.taskType,
          agentRole: reward.agentRole,
          totalPulls: 1,
          totalReward: reward.reward,
          averageReward: reward.reward,
          lastUpdated: new Date()
        });
        return;
      }

      // Update state using exponential moving average
      state.totalPulls += 1;
      state.totalReward += reward.reward;
      
      // Update average reward using learning rate
      state.averageReward = (1 - this.LEARNING_RATE) * state.averageReward + 
                           this.LEARNING_RATE * reward.reward;
      state.lastUpdated = new Date();

      // Persist to database (async, non-blocking)
      this.persistState(state).catch(err => {
        logger.warn('Failed to persist RL state:', err);
      });
    } catch (error: unknown) {
      logger.error('Failed to update RL reward:', error);
    }
  }

  /**
   * Calculate reward from task execution results
   */
  calculateReward(params: {
    success: boolean;
    cost: number;
    latency: number;
    quality?: number;
    expectedCost?: number;
    expectedLatency?: number;
  }): number {
    const { success, cost, latency, quality, expectedCost, expectedLatency } = params;

    // Base reward: success = 1, failure = 0
    let reward = success ? 1.0 : 0.0;

    // Cost component (lower is better)
    // Normalize cost reward (0-0.3 range)
    if (expectedCost && expectedCost > 0) {
      const costRatio = cost / expectedCost;
      const costReward = costRatio < 1 ? 0.3 : Math.max(0, 0.3 * (2 - costRatio));
      reward += costReward;
    } else {
      // No expected cost, use absolute cost (assume $1 max)
      const costReward = Math.max(0, 0.3 * (1 - Math.min(1, cost)));
      reward += costReward;
    }

    // Latency component (lower is better)
    // Normalize latency reward (0-0.2 range)
    if (expectedLatency && expectedLatency > 0) {
      const latencyRatio = latency / expectedLatency;
      const latencyReward = latencyRatio < 1 ? 0.2 : Math.max(0, 0.2 * (2 - latencyRatio));
      reward += latencyReward;
    } else {
      // No expected latency, use absolute latency (assume 30s max)
      const latencyReward = Math.max(0, 0.2 * (1 - Math.min(1, latency / 30000)));
      reward += latencyReward;
    }

    // Quality component (if available)
    // Normalize quality reward (0-0.2 range)
    if (quality !== undefined) {
      const qualityReward = (quality / 100) * 0.2;
      reward += qualityReward;
    }

    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, reward));
  }

  /**
   * Get or create RL states for available models
   */
  private async getOrCreateStates(
    task: TaskAnalysis,
    availableModels: string[]
  ): Promise<RLState[]> {
    const states: RLState[] = [];

    for (const modelId of availableModels) {
      const stateKey = this.getStateKey(task.taskType, modelId, task.agentRole);
      
      // Check cache first
      if (this.rlStates.has(stateKey)) {
        states.push(this.rlStates.get(stateKey)!);
        continue;
      }

      // Load from database
      const dbState = await this.loadStateFromDatabase(stateKey);
      if (dbState) {
        this.rlStates.set(stateKey, dbState);
        states.push(dbState);
        continue;
      }

      // Create new state with optimistic initial value
      const newState: RLState = {
        modelId,
        taskType: task.taskType,
        agentRole: task.agentRole,
        totalPulls: 0,
        totalReward: 0,
        averageReward: 0.5, // Optimistic initial value (encourages exploration)
        lastUpdated: new Date()
      };
      
      this.rlStates.set(stateKey, newState);
      states.push(newState);
    }

    return states;
  }

  /**
   * Calculate exploration bonus using UCB formula
   */
  private calculateExplorationBonus(
    pulls: number,
    totalPulls: number
  ): number {
    if (pulls === 0) {
      return Infinity; // Always explore unexplored arms
    }

    if (totalPulls === 0) {
      return 1.0; // Default exploration bonus
    }

    // UCB1 formula: c * sqrt(ln(totalPulls) / pulls)
    // c = exploration constant (tunable)
    const c = 1.414; // sqrt(2) - standard UCB1 constant
    const explorationBonus = c * Math.sqrt(Math.log(totalPulls) / pulls);

    return explorationBonus;
  }

  /**
   * Generate state key for caching
   */
  private getStateKey(taskType: string, modelId: string, agentRole?: string): string {
    return `${taskType}_${modelId}_${agentRole || 'any'}`;
  }

  /**
   * Load RL state from database
   */
  private async loadStateFromDatabase(stateKey: string): Promise<RLState | null> {
    try {
      // Parse state key
      const [taskType, modelId, agentRole] = stateKey.split('_');
      const actualAgentRole = agentRole === 'any' ? undefined : agentRole;

      // Query historical usage for this model/task combination
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const usageData = await LLMUsage.find({
        modelId,
        taskType,
        agentRole: actualAgentRole || { $exists: false },
        timestamp: { $gte: thirtyDaysAgo },
        success: true // Only successful calls for reward calculation
      }).lean();

      if (usageData.length === 0) {
        return null;
      }

      // Calculate average reward from historical data
      let totalReward = 0;
      let totalPulls = 0;

      for (const usage of usageData) {
        const reward = this.calculateReward({
          success: usage.success || false,
          cost: usage.totalCost || 0,
          latency: usage.latencyMs || 1000,
          expectedCost: undefined, // Don't have baseline
          expectedLatency: undefined
        });
        totalReward += reward;
        totalPulls += 1;
      }

      const averageReward = totalPulls > 0 ? totalReward / totalPulls : 0.5;

      return {
        modelId,
        taskType,
        agentRole: actualAgentRole,
        totalPulls,
        totalReward,
        averageReward,
        lastUpdated: new Date()
      };
    } catch (error: unknown) {
      logger.warn('Failed to load RL state from database:', error);
      return null;
    }
  }

  /**
   * Persist RL state to database (for future sessions)
   */
  private async persistState(state: RLState): Promise<void> {
    // For now, we rely on in-memory cache and database queries
    // In production, you might want to create a dedicated RLState collection
    // This is a lightweight implementation that works with existing LLMUsage data
    
    // The state is reconstructed from LLMUsage on each load, so no explicit persistence needed
    // But we could add a RLState model if needed for faster lookups
  }

  /**
   * Get RL statistics for monitoring
   */
  getStatistics(): {
    totalStates: number;
    totalPulls: number;
    averageReward: number;
    topModels: Array<{ modelId: string; averageReward: number; pulls: number }>;
  } {
    const states = Array.from(this.rlStates.values());
    const totalPulls = states.reduce((sum, s) => sum + s.totalPulls, 0);
    const totalReward = states.reduce((sum, s) => sum + s.totalReward, 0);
    const averageReward = totalPulls > 0 ? totalReward / totalPulls : 0;

    // Get top models by average reward
    const modelStats = new Map<string, { pulls: number; totalReward: number }>();
    states.forEach(state => {
      const existing = modelStats.get(state.modelId) || { pulls: 0, totalReward: 0 };
      modelStats.set(state.modelId, {
        pulls: existing.pulls + state.totalPulls,
        totalReward: existing.totalReward + state.totalReward
      });
    });

    const topModels = Array.from(modelStats.entries())
      .map(([modelId, stats]) => ({
        modelId,
        averageReward: stats.pulls > 0 ? stats.totalReward / stats.pulls : 0,
        pulls: stats.pulls
      }))
      .sort((a, b) => b.averageReward - a.averageReward)
      .slice(0, 10);

    return {
      totalStates: states.length,
      totalPulls,
      averageReward,
      topModels
    };
  }

  /**
   * Clear RL cache (useful for testing or reset)
   */
  clearCache(): void {
    this.rlStates.clear();
  }
}

export const rlRouterService = new ReinforcementLearningRouterService();




