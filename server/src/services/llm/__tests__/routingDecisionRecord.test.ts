import { describe, it, expect } from 'vitest';
import { buildRoutingDecisionRecord } from '../routingDecisionRecord.js';

describe('buildRoutingDecisionRecord (observability dim 13 → 5)', () => {
  it('builds a valid record with passthrough values + confidence default', () => {
    const r: any = buildRoutingDecisionRecord({
      requestId: 'r1',
      selectedModel: 'm',
      selectedProvider: 'openai',
      taskType: 'code',
      estimatedTokens: 100,
      complexity: 'complex',
    });
    expect(r.requestId).toBe('r1');
    expect(r.selectedModel).toBe('m');
    expect(r.selectedProvider).toBe('openai');
    expect(r.task.type).toBe('code');
    expect(r.task.complexity).toBe('complex');
    expect(r.task.estimatedTokens).toBe(100);
    expect(r.confidence).toBe(0.7); // default when not provided
    expect(r.decisionPath).toEqual([]);
  });

  it('coerces unknown complexity to moderate and defaults missing fields', () => {
    const r: any = buildRoutingDecisionRecord({
      requestId: 'r2',
      selectedModel: 'm',
      selectedProvider: 'p',
      complexity: 'wild',
    });
    expect(r.task.complexity).toBe('moderate');
    expect(r.task.type).toBe('unknown');
    expect(r.task.estimatedTokens).toBe(0);
    expect(r.task.requiredCapabilities).toEqual([]);
  });

  it('honors a provided confidence', () => {
    const r: any = buildRoutingDecisionRecord({
      requestId: 'r3',
      selectedModel: 'm',
      selectedProvider: 'p',
      confidence: 0.9,
    });
    expect(r.confidence).toBe(0.9);
  });
});
