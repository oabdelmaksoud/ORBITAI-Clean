import { describe, it, expect, vi, beforeEach } from 'vitest';

const { executeWithFallback } = vi.hoisted(() => ({ executeWithFallback: vi.fn() }));

vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { executeWithFallback } }));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { planningService } from '../planning.service.js';

beforeEach(() => {
  executeWithFallback.mockReset();
  process.env.HARNESS_PLANNING_ENABLED = 'true';
});

describe('planning.service (dim 9)', () => {
  it('parseSteps extracts an ordered plan from embedded JSON', () => {
    const steps = planningService.parseSteps(
      'plan: [{"step":1,"description":"a"},{"description":"b"}] done'
    );
    expect(steps).toEqual([
      { step: 1, description: 'a' },
      { step: 2, description: 'b' },
    ]);
  });

  it('parseSteps returns [] on non-JSON', () => {
    expect(planningService.parseSteps('no json here')).toEqual([]);
  });

  it('formatPlanForPrompt returns "" for empty plan and a block otherwise', () => {
    expect(planningService.formatPlanForPrompt({ steps: [] })).toBe('');
    const block = planningService.formatPlanForPrompt({ steps: [{ step: 1, description: 'do x' }] });
    expect(block).toContain('EXECUTION PLAN');
    expect(block).toContain('1. do x');
  });

  it('createPlan returns empty and makes no LLM call when disabled', async () => {
    process.env.HARNESS_PLANNING_ENABLED = 'false';
    const plan = await planningService.createPlan('t', 'd');
    expect(plan.steps).toEqual([]);
    expect(executeWithFallback).not.toHaveBeenCalled();
  });

  it('createPlan parses the LLM output when enabled', async () => {
    executeWithFallback.mockResolvedValue({ text: '[{"step":1,"description":"first"}]' });
    const plan = await planningService.createPlan('t', 'd');
    expect(plan.steps).toEqual([{ step: 1, description: 'first' }]);
  });

  it('reflect parses needsRevision + critique', async () => {
    executeWithFallback.mockResolvedValue({ text: '{"needsRevision":true,"critique":"fix it"}' });
    const r = await planningService.reflect('t', 'some output');
    expect(r).toEqual({ needsRevision: true, critique: 'fix it' });
  });

  it('reflect returns no-revision and no LLM call when disabled', async () => {
    process.env.HARNESS_PLANNING_ENABLED = 'false';
    const r = await planningService.reflect('t', 'out');
    expect(r.needsRevision).toBe(false);
    expect(executeWithFallback).not.toHaveBeenCalled();
  });
});
