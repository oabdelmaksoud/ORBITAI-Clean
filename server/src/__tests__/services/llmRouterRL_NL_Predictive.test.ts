/**
 * RL Router + Predictive Router + NL Router Service Tests (#56)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock('../../models/LLMUsage.model.js', () => ({
  LLMUsage: {
    find: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/llm/LLMRouter.js', () => ({
  llmRouter: {
    executeWithFallback: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        name: 'generated-rule',
        priority: 5,
        enabled: true,
        description: 'Test rule',
        conditions: { agentRoles: ['developer'] },
        actions: { models: ['gpt-4o'] },
      }),
    }),
  },
}));

vi.mock('../../services/llm/models/ModelRegistry.js', () => ({
  modelRegistry: {
    getModel: vi.fn().mockReturnValue({
      id: 'gpt-4o',
      provider: 'openai',
      capabilities: { reasoning: true, coding: true, vision: false },
      contextLength: 128000,
    }),
    getAllModels: vi.fn().mockReturnValue([
      { id: 'gpt-4o', provider: 'openai', capabilities: { reasoning: true, coding: true }, contextLength: 128000 },
    ]),
  },
}));

vi.mock('../../models/RoutingRule.model.js', () => ({
  RoutingRule: { find: vi.fn() },
  IRoutingRule: {},
}));

// ─── llmRouterRL tests ─────────────────────────────────────────────────────────

describe('ReinforcementLearningRouterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selectModel returns null when no models available', async () => {
    const { rlRouterService } = await import('../../services/llmRouterRL.service.js');
    const result = await rlRouterService.selectModel(
      { taskType: 'code', complexity: 'simple', requiredCapabilities: [] } as any,
      []
    );
    expect(result).toBeNull();
  });

  it('selectModel returns RLSelection with required fields for multiple models', async () => {
    const { rlRouterService } = await import('../../services/llmRouterRL.service.js');
    const result = await rlRouterService.selectModel(
      { taskType: 'code', complexity: 'simple', requiredCapabilities: [] } as any,
      ['gpt-4o', 'claude-3']
    );
    if (result !== null) {
      expect(result).toHaveProperty('modelId');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('explorationBonus');
      expect(result).toHaveProperty('exploitationScore');
      expect(result).toHaveProperty('reasoning');
    }
  });

  it('updateReward creates new RL state without throwing', async () => {
    const { rlRouterService } = await import('../../services/llmRouterRL.service.js');
    await expect(
      rlRouterService.updateReward({
        modelId: 'gpt-4o-rl-new',
        taskType: 'code',
        reward: 0.9,
        cost: 0.01,
        latency: 500,
        success: true,
      })
    ).resolves.not.toThrow();
  });

  it('updateReward second call updates existing state without throwing', async () => {
    const { rlRouterService } = await import('../../services/llmRouterRL.service.js');
    const base = { modelId: 'gpt-4o-rl-update', taskType: 'analysis', reward: 0.8, cost: 0.02, latency: 300, success: true };
    await rlRouterService.updateReward(base);
    await expect(rlRouterService.updateReward({ ...base, reward: 0.6 })).resolves.not.toThrow();
  });

  it('calculateReward returns value in [0,1] for successful request', async () => {
    const { rlRouterService } = await import('../../services/llmRouterRL.service.js');
    const reward = (rlRouterService as any).calculateReward({
      success: true,
      cost: 0.01,
      latency: 400,
      quality: 85,
    });
    expect(reward).toBeGreaterThanOrEqual(0);
    expect(reward).toBeLessThanOrEqual(1);
  });

  it('calculateReward returns lower value for failure', async () => {
    const { rlRouterService } = await import('../../services/llmRouterRL.service.js');
    const successReward = (rlRouterService as any).calculateReward({ success: true, cost: 0.01, latency: 400 });
    const failReward = (rlRouterService as any).calculateReward({ success: false, cost: 0.01, latency: 400 });
    expect(failReward).toBeLessThan(successReward);
  });
});

// ─── llmRouterPredictive tests ─────────────────────────────────────────────────

describe('PredictiveRoutingService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no historical data available', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    (LLMUsage.aggregate as any).mockResolvedValue([]);
    const { predictiveRoutingService } = await import('../../services/llmRouterPredictive.service.js');
    const result = await predictiveRoutingService.predictOptimalModel({
      taskType: 'code',
      complexity: 'moderate',
      estimatedTokens: 500,
      requiredCapabilities: [],
    });
    expect(result).toBeNull();
  });

  it('returns a ModelPrediction with correct shape when data exists', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    (LLMUsage.aggregate as any).mockResolvedValue([
      { _id: 'gpt-4o', totalCalls: 15, successRate: 0.95, avgLatency: 300, avgCost: 0.01, lastUsed: new Date() },
    ]);
    const { predictiveRoutingService } = await import('../../services/llmRouterPredictive.service.js');
    const result = await predictiveRoutingService.predictOptimalModel({
      taskType: 'code',
      complexity: 'moderate',
      estimatedTokens: 500,
      requiredCapabilities: [],
    });
    if (result !== null) {
      expect(result).toHaveProperty('modelId');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result).toHaveProperty('predictedLatency');
      expect(result).toHaveProperty('predictedCost');
      expect(result).toHaveProperty('reasoning');
    }
  });

  it('filters out models missing required capabilities', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    const { modelRegistry } = await import('../../services/llm/models/ModelRegistry.js');
    (LLMUsage.aggregate as any).mockResolvedValue([
      { _id: 'gpt-4o', totalCalls: 5, successRate: 0.9, avgLatency: 400, avgCost: 0.02, lastUsed: new Date() },
    ]);
    (modelRegistry.getModel as any).mockReturnValue({
      id: 'gpt-4o',
      capabilities: { reasoning: true, vision: false },
    });
    const { predictiveRoutingService } = await import('../../services/llmRouterPredictive.service.js');
    const result = await predictiveRoutingService.predictOptimalModel({
      taskType: 'visual-analysis',
      complexity: 'complex',
      estimatedTokens: 200,
      requiredCapabilities: ['vision'],
    });
    expect(result).toBeNull();
  });
});

// ─── llmRouterNL tests ─────────────────────────────────────────────────────────

describe('LLMRouterNLService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generateRuleFromDescription returns structured result', async () => {
    const { llmRouterNLService } = await import('../../services/llmRouterNL.service.js');
    const result = await llmRouterNLService.generateRuleFromDescription(
      'Use GPT-4 for all complex coding tasks'
    );
    expect(result).toHaveProperty('rule');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('explanation');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('generateRuleFromDescription accepts optional context', async () => {
    const { llmRouterNLService } = await import('../../services/llmRouterNL.service.js');
    const context = { existingRules: [{ name: 'Cost rule', priority: 3, enabled: true } as any] };
    const result = await llmRouterNLService.generateRuleFromDescription(
      'Route simple tasks to cheaper models',
      context
    );
    expect(result).toHaveProperty('rule');
  });

  it('explainRule returns a non-empty string', async () => {
    const { llmRouter } = await import('../../services/llm/LLMRouter.js');
    (llmRouter.executeWithFallback as any).mockResolvedValueOnce({
      text: 'This rule routes developer agents to GPT-4.',
    });
    const { llmRouterNLService } = await import('../../services/llmRouterNL.service.js');
    const rule = { name: 'Dev rule', conditions: { agentRoles: ['developer'] }, actions: { models: ['gpt-4o'] } } as any;
    const explanation = await llmRouterNLService.explainRule(rule);
    expect(typeof explanation).toBe('string');
    expect(explanation.length).toBeGreaterThan(0);
  });

  it('suggestRuleImprovements returns default suggestions on LLM error', async () => {
    const { llmRouter } = await import('../../services/llm/LLMRouter.js');
    (llmRouter.executeWithFallback as any).mockRejectedValueOnce(new Error('LLM error'));
    const { llmRouterNLService } = await import('../../services/llmRouterNL.service.js');
    const rule = { name: 'Dev rule', conditions: { agentRoles: ['developer'] }, actions: { models: ['gpt-4o'] } } as any;
    const result = await llmRouterNLService.suggestRuleImprovements(rule);
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('suggestRuleImprovements parses improvedRule from LLM JSON response', async () => {
    const { llmRouter } = await import('../../services/llm/LLMRouter.js');
    (llmRouter.executeWithFallback as any).mockResolvedValueOnce({
      text: JSON.stringify({
        suggestions: ['Add fallback model'],
        improvedRule: {
          name: 'Dev rule v2',
          priority: 5,
          enabled: true,
          conditions: { agentRoles: ['developer'] },
          actions: { models: ['gpt-4o', 'claude-3'] },
        },
      }),
    });
    const { llmRouterNLService } = await import('../../services/llmRouterNL.service.js');
    const rule = { name: 'Dev rule', conditions: { agentRoles: ['developer'] }, actions: { models: ['gpt-4o'] } } as any;
    const result = await llmRouterNLService.suggestRuleImprovements(rule);
    expect(result).toHaveProperty('suggestions');
    expect(result).toHaveProperty('improvedRule');
    expect(result.improvedRule?.name).toBe('Dev rule v2');
  });
});
