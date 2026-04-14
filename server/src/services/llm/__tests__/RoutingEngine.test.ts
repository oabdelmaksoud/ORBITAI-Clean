/**
 * RoutingEngine Unit Tests
 *
 * Mock paths are resolved relative to THIS test file so they reach the
 * same absolute paths that RoutingEngine.ts uses with its own relative imports.
 *
 * From server/src/services/llm/__tests__/:
 *   '../models/ModelRegistry.js'     → services/llm/models/ModelRegistry.ts
 *   '../../llmRouterSettings.service.js' → services/llmRouterSettings.service.ts
 *   '../../../utils/logger.js'       → src/utils/logger.ts
 *   '../../../errors/ApiError.js'    → src/errors/ApiError.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks (paths relative to this test file) ─────────────────────────────────

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../errors/ApiError.js', () => ({
  toApiError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

vi.mock('../models/ModelRegistry.js', () => ({
  modelRegistry: {
    getModel: vi.fn(),
    getActiveModels: vi.fn(() => []),
    getRecommendedModels: vi.fn(() => []),
  },
}));

vi.mock('../../llmRouterSettings.service.js', () => ({
  llmRouterSettingsService: {
    getEffectiveSettings: vi.fn(),
    testRoutingRule: vi.fn(),
  },
}));

vi.mock('../../llmRouterAI.service.js', () => ({
  llmRouterAIService: {
    predictOptimalModel: vi.fn(),
  },
}));

vi.mock('../../llmRouterPredictive.service.js', () => ({
  predictiveRoutingService: {
    predictOptimalModel: vi.fn(),
  },
}));

vi.mock('../../llmRouterRL.service.js', () => ({
  rlRouterService: {
    selectModel: vi.fn(),
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { RoutingEngine, routingEngine } from '../RoutingEngine.js';
import { modelRegistry } from '../models/ModelRegistry.js';
import { llmRouterSettingsService } from '../../llmRouterSettings.service.js';
import { predictiveRoutingService } from '../../llmRouterPredictive.service.js';
import { rlRouterService } from '../../llmRouterRL.service.js';
import { llmRouterAIService } from '../../llmRouterAI.service.js';
import type { ModelCapabilities } from '../models/ModelRegistry.js';
import type { TaskAnalysis } from '../TaskAnalyzer.js';
import type { RoutingContext } from '../RoutingEngine.js';
import type { EffectiveRouterSettings } from '../../llmRouterSettings.service.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeModel(overrides: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return {
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
      functionCalling: false,
    },
    limits: { maxTokens: 1_000_000, maxContextLength: 1_000_000 },
    pricing: { inputCostPer1MTokens: 0.075, outputCostPer1MTokens: 0.30 },
    performance: { avgLatencyMs: 200, reliability: 0.99 },
    recommendedFor: {
      agentRoles: ['Orchestrator'],
      taskTypes: ['chat', 'conversation'],
      complexity: ['simple'],
    },
    status: 'active',
    isEnabled: true,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskAnalysis> = {}): TaskAnalysis {
  return {
    taskType: 'chat',
    complexity: 'simple',
    domain: 'conversation',
    outputType: 'text',
    latencyRequirement: 'fast',
    costSensitivity: 'medium',
    estimatedTokens: 200,
    requiredCapabilities: [],
    priority: 1,
    ...overrides,
  };
}

const defaultContext: RoutingContext = {};

function makeDefaultSettings(overrides: Partial<EffectiveRouterSettings> = {}): EffectiveRouterSettings {
  return {
    routingRules: [],
    enabled: true,
    enableIntelligentRouting: false,
    enableCostOptimization: false,
    enablePerformanceOptimization: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RoutingEngine', () => {
  let engine: RoutingEngine;

  beforeEach(() => {
    engine = new RoutingEngine();
    vi.clearAllMocks();

    vi.mocked(llmRouterSettingsService.getEffectiveSettings).mockResolvedValue(
      makeDefaultSettings()
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── selectModel – happy path ─────────────────────────────────────────────

  describe('selectModel – happy path', () => {
    it('returns a ModelSelection with primaryModel', async () => {
      const model = makeModel();
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([model]);
      vi.mocked(modelRegistry.getActiveModels).mockReturnValue([model]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result).toHaveProperty('primaryModel');
      expect(result.primaryModel.id).toBe('gemini-2.5-flash');
    });

    it('includes non-empty reasoning in the selection', async () => {
      const model = makeModel();
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([model]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('returns numeric estimated cost and latency', async () => {
      const model = makeModel();
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([model]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(typeof result.estimatedCost).toBe('number');
      expect(result.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(result.estimatedLatency).toBe(200);
    });

    it('selects a fallback from a different provider when available', async () => {
      // model-a: clearly dominant (lowest cost + latency near target)
      const primary = makeModel({
        id: 'model-a',
        provider: 'gemini',
        performance: { avgLatencyMs: 1000, reliability: 0.99 }, // on-target latency
        pricing: { inputCostPer1MTokens: 0.01, outputCostPer1MTokens: 0.01 },
      });
      // model-b: fallback candidate (different provider, higher cost)
      const fallback = makeModel({
        id: 'model-b',
        provider: 'openai',
        performance: { avgLatencyMs: 1000, reliability: 0.95 },
        pricing: { inputCostPer1MTokens: 10, outputCostPer1MTokens: 30 },
      });
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([primary, fallback]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      // The fallback model should differ from the primary's provider
      expect(result.fallbackModel).toBeDefined();
      expect(result.fallbackModel?.provider).not.toBe(result.primaryModel.provider);
    });

    it('falls back to active models when recommended candidates list is empty', async () => {
      const model = makeModel();
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([]);
      vi.mocked(modelRegistry.getActiveModels).mockReturnValue([model]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('gemini-2.5-flash');
    });
  });

  // ─── Provider / model filtering ───────────────────────────────────────────

  describe('provider selection logic', () => {
    it('filters out models that lack required capabilities', async () => {
      const noFunctionCall = makeModel({
        id: 'no-fc',
        capabilities: { ...makeModel().capabilities, functionCalling: false },
      });
      const withFunctionCall = makeModel({
        id: 'with-fc',
        capabilities: { ...makeModel().capabilities, functionCalling: true },
      });
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([noFunctionCall, withFunctionCall]);

      const task = makeTask({ requiredCapabilities: ['functionCalling'] });
      const result = await engine.selectModel(task, defaultContext);

      expect(result.primaryModel.id).toBe('with-fc');
    });

    it('filters out models listed in defaultBlockedModels', async () => {
      const blocked = makeModel({ id: 'blocked-model' });
      const allowed = makeModel({
        id: 'allowed-model',
        performance: { avgLatencyMs: 300, reliability: 0.98 },
      });
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([blocked, allowed]);
      vi.mocked(llmRouterSettingsService.getEffectiveSettings).mockResolvedValue(
        makeDefaultSettings({ defaultBlockedModels: ['blocked-model'] })
      );

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('allowed-model');
    });

    it('throws when no suitable model is found after all filtering', async () => {
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([]);
      vi.mocked(modelRegistry.getActiveModels).mockReturnValue([]);

      await expect(engine.selectModel(makeTask(), defaultContext)).rejects.toThrow(
        'No suitable model found for task'
      );
    });
  });

  // ─── Intelligent routing (predictive / RL / AI) ───────────────────────────

  describe('intelligent routing', () => {
    beforeEach(() => {
      vi.mocked(llmRouterSettingsService.getEffectiveSettings).mockResolvedValue(
        makeDefaultSettings({ enableIntelligentRouting: true })
      );
    });

    it('uses predictive routing when confidence > 0.6', async () => {
      const predictedModel = makeModel({ id: 'predicted-model' });
      vi.mocked(modelRegistry.getModel).mockReturnValue(predictedModel);
      vi.mocked(predictiveRoutingService.predictOptimalModel).mockResolvedValue({
        modelId: 'predicted-model',
        confidence: 0.8,
        reasoning: 'High confidence prediction',
        predictedCost: 0.001,
        predictedLatency: 200,
      });

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('predicted-model');
      expect(result.reasoning).toContain('Predictive routing');
    });

    it('skips predictive routing when confidence <= 0.6', async () => {
      const standardModel = makeModel({ id: 'standard-model' });
      vi.mocked(modelRegistry.getModel).mockReturnValue(makeModel({ id: 'low-confidence-model' }));
      vi.mocked(predictiveRoutingService.predictOptimalModel).mockResolvedValue({
        modelId: 'low-confidence-model',
        confidence: 0.4,
        reasoning: 'Low confidence',
        predictedCost: 0.001,
        predictedLatency: 200,
      });
      vi.mocked(rlRouterService.selectModel).mockRejectedValue(new Error('RL unavailable'));
      vi.mocked(llmRouterAIService.predictOptimalModel).mockRejectedValue(new Error('AI unavailable'));
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([standardModel]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('standard-model');
    });

    it('falls back to standard routing when predictive service throws', async () => {
      const standardModel = makeModel({ id: 'standard-model' });
      vi.mocked(predictiveRoutingService.predictOptimalModel).mockRejectedValue(
        new Error('Predictive service unavailable')
      );
      vi.mocked(rlRouterService.selectModel).mockRejectedValue(new Error('RL unavailable'));
      vi.mocked(llmRouterAIService.predictOptimalModel).mockRejectedValue(new Error('AI unavailable'));
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([standardModel]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('standard-model');
    });

    it('uses RL routing when predictive gives no result and confidence > 0.5', async () => {
      const rlModel = makeModel({ id: 'rl-selected-model' });
      vi.mocked(predictiveRoutingService.predictOptimalModel).mockResolvedValue(null as any);
      vi.mocked(modelRegistry.getActiveModels).mockReturnValue([rlModel]);
      vi.mocked(modelRegistry.getModel).mockReturnValue(rlModel);
      vi.mocked(rlRouterService.selectModel).mockResolvedValue({
        modelId: 'rl-selected-model',
        confidence: 0.7,
        reasoning: 'RL optimized',
      });

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('rl-selected-model');
      expect(result.reasoning).toContain('RL optimization');
    });
  });

  // ─── Routing rules ────────────────────────────────────────────────────────

  describe('routing rules', () => {
    it('uses preferred model when a matched rule specifies preferredModel', async () => {
      const ruleModel = makeModel({ id: 'rule-model' });
      vi.mocked(modelRegistry.getModel).mockImplementation((id) =>
        id === 'rule-model' ? ruleModel : undefined
      );
      vi.mocked(llmRouterSettingsService.getEffectiveSettings).mockResolvedValue(
        makeDefaultSettings({
          enableIntelligentRouting: true,
          routingRules: [
            {
              name: 'test-rule',
              enabled: true,
              priority: 100,
              actions: { preferredModel: 'rule-model' },
              conditions: {},
            } as any,
          ],
        })
      );
      vi.mocked(llmRouterSettingsService.testRoutingRule).mockResolvedValue({ matches: true });
      vi.mocked(predictiveRoutingService.predictOptimalModel).mockResolvedValue(null as any);
      vi.mocked(rlRouterService.selectModel).mockRejectedValue(new Error('skip'));
      vi.mocked(llmRouterAIService.predictOptimalModel).mockRejectedValue(new Error('skip'));

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('rule-model');
      expect(result.reasoning).toContain('routing rule');
    });

    it('falls through to standard selection when no rules match', async () => {
      const standardModel = makeModel({ id: 'std' });
      vi.mocked(llmRouterSettingsService.getEffectiveSettings).mockResolvedValue(
        makeDefaultSettings({
          enableIntelligentRouting: true,
          routingRules: [
            { name: 'no-match-rule', enabled: true, priority: 1, actions: {}, conditions: {} } as any,
          ],
        })
      );
      vi.mocked(llmRouterSettingsService.testRoutingRule).mockResolvedValue({ matches: false });
      vi.mocked(predictiveRoutingService.predictOptimalModel).mockResolvedValue(null as any);
      vi.mocked(rlRouterService.selectModel).mockRejectedValue(new Error('skip'));
      vi.mocked(llmRouterAIService.predictOptimalModel).mockRejectedValue(new Error('skip'));
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([standardModel]);

      const result = await engine.selectModel(makeTask(), defaultContext);

      expect(result.primaryModel.id).toBe('std');
    });
  });

  // ─── Circuit breaker ──────────────────────────────────────────────────────

  describe('circuit breaker', () => {
    it('starts with circuit breaker closed for any model', () => {
      expect(engine.isCircuitBreakerOpen('model-x')).toBe(false);
    });

    it('opens the circuit after 3 consecutive failures', () => {
      engine.recordFailure('model-fail');
      engine.recordFailure('model-fail');
      expect(engine.isCircuitBreakerOpen('model-fail')).toBe(false);
      engine.recordFailure('model-fail');
      expect(engine.isCircuitBreakerOpen('model-fail')).toBe(true);
    });

    it('recordSuccess decrements the failure count', () => {
      engine.recordFailure('model-s');
      engine.recordFailure('model-s');
      engine.recordSuccess('model-s');
      // 2 failures - 1 success = 1 failure, still closed
      expect(engine.isCircuitBreakerOpen('model-s')).toBe(false);
    });

    it('getCircuitBreakerState returns the correct model state object', () => {
      engine.recordFailure('model-state');
      const state = engine.getCircuitBreakerState('model-state');
      expect(state.modelId).toBe('model-state');
      expect(state.failures).toBe(1);
      expect(state.isOpen).toBe(false);
    });

    it('resetCircuitBreakers clears all breaker states', () => {
      engine.recordFailure('model-r');
      engine.recordFailure('model-r');
      engine.recordFailure('model-r');
      expect(engine.isCircuitBreakerOpen('model-r')).toBe(true);

      engine.resetCircuitBreakers();
      expect(engine.isCircuitBreakerOpen('model-r')).toBe(false);
    });

    it('getCircuitBreakerStates returns all registered breaker states', () => {
      engine.recordFailure('m1');
      engine.recordFailure('m2');
      const states = engine.getCircuitBreakerStates();
      const ids = states.map((s) => s.modelId);
      expect(ids).toContain('m1');
      expect(ids).toContain('m2');
    });
  });

  // ─── executeWithFallback ──────────────────────────────────────────────────

  describe('executeWithFallback', () => {
    function makeStep(modelId: string) {
      return {
        modelId,
        provider: 'gemini' as const,
        maxRetries: 0,
        timeoutMs: 5000,
        circuitBreakerThreshold: 50,
        priority: 1,
      };
    }

    it('returns result from the first successful model', async () => {
      const chain = [makeStep('model-ok')];
      const result = await engine.executeWithFallback(chain, async () => 'success');
      expect(result.result).toBe('success');
      expect(result.modelUsed).toBe('model-ok');
      expect(result.fallbacksUsed).toBe(0);
    });

    it('advances to the next step when the first model fails', async () => {
      const chain = [makeStep('model-bad'), makeStep('model-good')];
      const result = await engine.executeWithFallback(chain, async (id) => {
        if (id === 'model-bad') throw new Error('primary failed');
        return 'fallback-result';
      });
      expect(result.result).toBe('fallback-result');
      expect(result.modelUsed).toBe('model-good');
      expect(result.fallbacksUsed).toBe(1);
    });

    it('throws when all models in the chain fail', async () => {
      const chain = [makeStep('fail-1'), makeStep('fail-2')];
      await expect(
        engine.executeWithFallback(chain, async () => {
          throw new Error('always fails');
        })
      ).rejects.toThrow();
    });

    it('calls onFallback callback when switching to a fallback model', async () => {
      const chain = [makeStep('model-a'), makeStep('model-b')];
      const onFallback = vi.fn();
      await engine.executeWithFallback(
        chain,
        async (id) => {
          if (id === 'model-a') throw new Error('a failed');
          return 'ok';
        },
        onFallback
      );
      expect(onFallback).toHaveBeenCalledWith('model-a', 'model-b', expect.any(Error));
    });

    it('skips steps whose circuit breakers are open', async () => {
      engine.recordFailure('tripped');
      engine.recordFailure('tripped');
      engine.recordFailure('tripped'); // circuit now open
      const chain = [makeStep('tripped'), makeStep('healthy')];
      const result = await engine.executeWithFallback(chain, async () => 'done');
      expect(result.modelUsed).toBe('healthy');
    });
  });

  // ─── getNextFallback ──────────────────────────────────────────────────────

  describe('getNextFallback', () => {
    function makeStep(modelId: string) {
      return {
        modelId,
        priority: 1,
        maxRetries: 0,
        timeoutMs: 5000,
        provider: 'gemini' as const,
        circuitBreakerThreshold: 50,
      };
    }

    it('returns the first step that is not in failedModels', () => {
      const chain = [makeStep('a'), makeStep('b')];
      const next = engine.getNextFallback(chain, ['a']);
      expect(next?.modelId).toBe('b');
    });

    it('returns null when all steps are in failedModels', () => {
      const chain = [makeStep('x')];
      const next = engine.getNextFallback(chain, ['x']);
      expect(next).toBeNull();
    });

    it('skips steps with open circuit breakers', () => {
      engine.recordFailure('cb-open');
      engine.recordFailure('cb-open');
      engine.recordFailure('cb-open'); // open
      const chain = [makeStep('cb-open'), makeStep('good')];
      const next = engine.getNextFallback(chain, []);
      expect(next?.modelId).toBe('good');
    });
  });

  // ─── clearCache ───────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('clears the full settings cache without throwing', async () => {
      const model = makeModel();
      vi.mocked(modelRegistry.getRecommendedModels).mockReturnValue([model]);
      await engine.selectModel(makeTask(), defaultContext);
      expect(() => engine.clearCache()).not.toThrow();
    });

    it('clears per-user cache when userId is provided', () => {
      expect(() => engine.clearCache('user-123')).not.toThrow();
    });
  });

  // ─── exported singleton ───────────────────────────────────────────────────

  describe('exported routingEngine singleton', () => {
    it('is an instance of RoutingEngine', () => {
      expect(routingEngine).toBeInstanceOf(RoutingEngine);
    });
  });
});
