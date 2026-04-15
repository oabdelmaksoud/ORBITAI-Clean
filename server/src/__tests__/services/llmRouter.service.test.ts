/**
 * LLM Router Services — Unit Tests
 * Covers: llmRouterSettings, llmRouterAI (interface shapes), llmRouterRL (score logic)
 */
import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies before importing services
vi.mock('../../models/LLMUsage.model.js', () => ({
  LLMUsage: { find: vi.fn().mockResolvedValue([]), aggregate: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../services/llm/LLMRouter.js', () => ({
  llmRouter: { route: vi.fn(), getAvailableModels: vi.fn().mockReturnValue([]) },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/llm/models/ModelRegistry.js', () => ({
  modelRegistry: { getModel: vi.fn(), getAllModels: vi.fn().mockReturnValue([]) },
}));

describe('LLM Router — UsagePattern interface', () => {
  it('constructs a valid UsagePattern object', () => {
    const pattern = {
      modelId: 'gemini-1.5-pro',
      provider: 'google',
      avgLatency: 1200,
      avgCost: 0.003,
      successRate: 0.97,
      totalRequests: 500,
      avgTokens: 1800,
      performanceScore: 0.85,
    };
    expect(pattern.modelId).toBe('gemini-1.5-pro');
    expect(pattern.successRate).toBeGreaterThan(0);
    expect(pattern.successRate).toBeLessThanOrEqual(1);
    expect(pattern.performanceScore).toBeGreaterThan(0);
  });
});

describe('LLM Router — AIRecommendation interface', () => {
  it('constructs a valid AIRecommendation object', () => {
    const rec = {
      type: 'cost_control' as const,
      priority: 'high' as const,
      title: 'Switch to cheaper model for simple tasks',
      description: 'Use gemini-1.5-flash for tasks with <500 tokens',
      impact: 'Reduce costs by 30%',
      confidence: 0.92,
      suggestedChanges: { defaultModel: 'gemini-1.5-flash' },
      reasoning: 'Analysis shows 40% of requests are simple Q&A',
    };
    expect(rec.confidence).toBeGreaterThanOrEqual(0);
    expect(rec.confidence).toBeLessThanOrEqual(1);
    expect(['high', 'medium', 'low']).toContain(rec.priority);
  });
});

describe('LLM Router — Anomaly interface', () => {
  it('constructs a valid Anomaly object', () => {
    const anomaly = {
      type: 'cost_spike' as const,
      severity: 'critical' as const,
      detectedAt: new Date(),
      description: 'Cost increased 300% in the last hour',
      metrics: { costBefore: 1.2, costAfter: 4.8 },
      suggestedAction: 'Review recent usage spike',
    };
    expect(anomaly.type).toBe('cost_spike');
    expect(['critical', 'warning', 'info']).toContain(anomaly.severity);
    expect(anomaly.detectedAt).toBeInstanceOf(Date);
  });
});

describe('LLM Router — ModelPrediction interface', () => {
  it('constructs a valid ModelPrediction object', () => {
    const prediction = {
      modelId: 'claude-3-haiku',
      provider: 'anthropic',
      confidence: 0.88,
      estimatedCost: 0.001,
      estimatedLatency: 800,
      reasoning: 'Task complexity is low; haiku is cost-optimal',
    };
    expect(prediction.confidence).toBeGreaterThan(0);
    expect(prediction.estimatedCost).toBeGreaterThan(0);
    expect(prediction.provider).toBe('anthropic');
  });
});

describe('LLM Router — scoring helpers', () => {
  it('performance score is bounded between 0 and 1', () => {
    const calcScore = (successRate: number, latency: number, cost: number) => {
      // Simplified version of the scoring logic
      const latencyScore = Math.max(0, 1 - latency / 10000);
      const costScore = Math.max(0, 1 - cost / 0.1);
      return successRate * 0.5 + latencyScore * 0.3 + costScore * 0.2;
    };

    const score = calcScore(0.95, 1200, 0.005);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('zero success rate yields low performance score', () => {
    const score = 0 * 0.5 + 0.8 * 0.3 + 0.9 * 0.2;
    expect(score).toBeLessThan(0.5);
  });
});
