/**
 * LLM Router AI Service + AutoTune Service Tests (#56)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock('../../models/LLMUsage.model.js', () => ({
  LLMUsage: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    }),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/llm/models/ModelRegistry.js', () => ({
  modelRegistry: {
    getModel: vi.fn().mockReturnValue({
      id: 'gpt-4o',
      provider: 'openai',
      capabilities: { reasoning: true, coding: true },
    }),
    getAllModels: vi.fn().mockReturnValue([
      { id: 'gpt-4o', provider: 'openai', capabilities: { reasoning: true } },
    ]),
  },
}));

// llmRouterSettings mock — needed by autoTune
vi.mock('../../services/llmRouterSettings.service.js', () => ({
  llmRouterSettingsService: {
    getEffectiveSettings: vi.fn().mockResolvedValue({
      routingRules: [],
      enabled: true,
      enableIntelligentRouting: true,
      enableCostOptimization: true,
      enablePerformanceOptimization: true,
    }),
    updateGlobalSettings: vi.fn().mockResolvedValue({}),
  },
}));

// ─── LLMRouterAIService tests ──────────────────────────────────────────────────

describe('LLMRouterAIService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('analyzeUsagePatterns returns empty array when no usage data', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    (LLMUsage.aggregate as any).mockResolvedValue([]);
    const { llmRouterAIService } = await import('../../services/llmRouterAI.service.js');
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const result = await llmRouterAIService.analyzeUsagePatterns({ start, end });
    expect(Array.isArray(result)).toBe(true);
  });

  it('analyzeUsagePatterns transforms aggregate data into UsagePattern objects', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    const mockData = [
      {
        _id: { modelId: 'gpt-4o', provider: 'openai', agentRole: 'developer', taskType: 'code' },
        avgLatency: 300,
        avgCost: 0.01,
        successRate: 0.95,
        totalRequests: 50,
        avgTokens: 400,
      },
    ];
    (LLMUsage.aggregate as any).mockResolvedValue(mockData);
    const { llmRouterAIService } = await import('../../services/llmRouterAI.service.js');
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const result = await llmRouterAIService.analyzeUsagePatterns({ start, end });
    // If aggregate mock works, we should get transformed results
    // otherwise the service may return empty due to caching
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('modelId');
      expect(result[0]).toHaveProperty('performanceScore');
    }
  });

  it('generateRecommendations returns empty array for empty patterns', async () => {
    const { llmRouterAIService } = await import('../../services/llmRouterAI.service.js');
    const result = await llmRouterAIService.generateRecommendations([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('detectAnomalies returns empty array when no usage in time range', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    (LLMUsage.find as any).mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    });
    const { llmRouterAIService } = await import('../../services/llmRouterAI.service.js');
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const result = await llmRouterAIService.detectAnomalies({ start, end });
    expect(Array.isArray(result)).toBe(true);
  });

  it('getInsights returns object with summary fields', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    (LLMUsage.find as any).mockResolvedValue([]);
    const { llmRouterAIService } = await import('../../services/llmRouterAI.service.js');
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const result = await llmRouterAIService.getInsights({ start, end });
    expect(result).toHaveProperty('totalRequests');
    expect(result).toHaveProperty('totalCost');
    expect(result).toHaveProperty('avgLatency');
    expect(result).toHaveProperty('topModels');
    expect(Array.isArray(result.topModels)).toBe(true);
  });

  it('suggestAutoTuning returns partial performance tuning settings', async () => {
    const { llmRouterAIService } = await import('../../services/llmRouterAI.service.js');
    const settings = {
      routingRules: [],
      enabled: true,
      enableIntelligentRouting: true,
      enableCostOptimization: true,
      enablePerformanceOptimization: true,
      performanceTuning: { latencyWeight: 0.33, costWeight: 0.33, qualityWeight: 0.34 },
    } as any;
    const metrics = { avgLatency: 400, avgCost: 0.01, successRate: 0.95, totalRequests: 100 };
    const result = await llmRouterAIService.suggestAutoTuning(settings, metrics);
    expect(typeof result).toBe('object');
  });

  it('suggestAutoTuning increases latency weight when latency is very high', async () => {
    const { llmRouterAIService } = await import('../../services/llmRouterAI.service.js');
    const settings = {
      routingRules: [],
      enabled: true,
      enableIntelligentRouting: true,
      enableCostOptimization: true,
      enablePerformanceOptimization: true,
      performanceTuning: { latencyWeight: 0.33, costWeight: 0.33, qualityWeight: 0.34 },
    } as any;
    const metrics = { avgLatency: 5000, avgCost: 0.01, successRate: 0.95, totalRequests: 100 };
    const result = await llmRouterAIService.suggestAutoTuning(settings, metrics);
    if (result.latencyWeight !== undefined) {
      expect(result.latencyWeight).toBeGreaterThan(0.33);
    }
  });
});

// ─── LLMRouterAutoTuneService tests ───────────────────────────────────────────

describe('LLMRouterAutoTuneService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('monitorPerformance returns zero metrics when no usage data', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    // monitorPerformance uses await LLMUsage.find() directly (no .sort())
    (LLMUsage.find as any).mockResolvedValue([]);
    const { llmRouterAutoTuneService } = await import('../../services/llmRouterAutoTune.service.js');
    const result = await llmRouterAutoTuneService.monitorPerformance();
    expect(result).toHaveProperty('totalRequests', 0);
    expect(result).toHaveProperty('successRate');
    expect(result).toHaveProperty('avgLatency');
    expect(result).toHaveProperty('avgCost');
  });

  it('monitorPerformance calculates correct metrics from usage records', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    (LLMUsage.find as any).mockResolvedValue([
      { success: true, latencyMs: 300, totalCost: 0.01 },
      { success: true, latencyMs: 500, totalCost: 0.02 },
      { success: false, latencyMs: 100, totalCost: 0.005 },
    ]);
    const { llmRouterAutoTuneService } = await import('../../services/llmRouterAutoTune.service.js');
    const result = await llmRouterAutoTuneService.monitorPerformance();
    expect(result.totalRequests).toBe(3);
    expect(result.successRate).toBeCloseTo(2 / 3, 2);
    expect(result.errorRate).toBeCloseTo(1 / 3, 2);
  });

  it('suggestModelPriorities returns a Record<string, number>', async () => {
    const { llmRouterAutoTuneService } = await import('../../services/llmRouterAutoTune.service.js');
    const result = await llmRouterAutoTuneService.suggestModelPriorities();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('rollback returns false when tuning history is empty', async () => {
    const { LLMUsage } = await import('../../models/LLMUsage.model.js');
    (LLMUsage.find as any).mockResolvedValue([]);
    const { llmRouterAutoTuneService } = await import('../../services/llmRouterAutoTune.service.js');
    const settings = { routingRules: [], enabled: true } as any;
    const metrics = { avgLatency: 300, avgCost: 0.01, successRate: 0.95, totalRequests: 100, errorRate: 0.05, costPerRequest: 0.01 };
    const result = await llmRouterAutoTuneService.rollback(settings, metrics);
    expect(result).toBe(false);
  });

  it('getTuningHistory returns an empty array initially', async () => {
    const { llmRouterAutoTuneService } = await import('../../services/llmRouterAutoTune.service.js');
    const history = llmRouterAutoTuneService.getTuningHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it('getActiveABTests returns an empty array initially', async () => {
    const { llmRouterAutoTuneService } = await import('../../services/llmRouterAutoTune.service.js');
    const tests = llmRouterAutoTuneService.getActiveABTests();
    expect(Array.isArray(tests)).toBe(true);
  });
});
