import { describe, it, expect, vi, beforeEach } from 'vitest';

const { executeWithFallback, create } = vi.hoisted(() => ({
  executeWithFallback: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../llm/LLMRouter.js', () => ({ llmRouter: { executeWithFallback } }));
vi.mock('../../models/AgentExecution.model.js', () => ({ AgentExecution: { create } }));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { agentExecutionEngine } from '../agentExecutionEngine.service.js';

beforeEach(() => {
  executeWithFallback.mockReset();
  create.mockReset();
  create.mockResolvedValue({});
});

describe('agentExecutionEngine (multi-agent, dim 8)', () => {
  it('runAgent runs the agent via the router and records the execution', async () => {
    executeWithFallback.mockResolvedValue({ text: 'agent output', modelUsed: 'gpt-4o' });
    const r = await agentExecutionEngine.runAgent(
      { id: 'a1', role: 'Implementer', preferredLLM: 'gpt-4o' },
      'do the thing',
      { userId: 'u1', projectId: 'p1', taskId: 't1' }
    );
    expect(r.success).toBe(true);
    expect(r.output).toBe('agent output');
    expect(r.agentRole).toBe('Implementer');

    const call = executeWithFallback.mock.calls[0][0];
    expect(call.context.agentRole).toBe('Implementer');
    expect(call.context.model).toBe('gpt-4o');
    expect(call.prompt).toBe('do the thing');

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      projectId: 'p1',
      taskId: 't1',
      agentRole: 'Implementer',
      status: 'completed',
    });
  });

  it('runAgent returns success:false (no throw) when the router fails', async () => {
    executeWithFallback.mockRejectedValue(new Error('router down'));
    const r = await agentExecutionEngine.runAgent({ role: 'X' }, 'in', {
      projectId: 'p',
      taskId: 't',
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/router down/);
    expect(create.mock.calls[0][0]).toMatchObject({ status: 'failed' });
  });

  it('runSequence chains agents, threading outputs and preserving order', async () => {
    executeWithFallback
      .mockResolvedValueOnce({ text: 'plan from orchestrator', modelUsed: 'm' })
      .mockResolvedValueOnce({ text: 'final impl', modelUsed: 'm' });
    const result = await agentExecutionEngine.runSequence(
      [{ role: 'Orchestrator' }, { role: 'Implementer' }],
      'build feature',
      {}
    );
    expect(result.steps.map(s => s.agentRole)).toEqual(['Orchestrator', 'Implementer']);
    expect(result.finalOutput).toBe('final impl');

    const secondPrompt = executeWithFallback.mock.calls[1][0].prompt;
    expect(secondPrompt).toContain('plan from orchestrator'); // prior output threaded in
    expect(secondPrompt).toContain('build feature'); // original task retained
  });

  it('runAgent skips recording when projectId/taskId are missing', async () => {
    executeWithFallback.mockResolvedValue({ text: 'x' });
    await agentExecutionEngine.runAgent({ role: 'X' }, 'in', {});
    expect(create).not.toHaveBeenCalled();
  });

  it('formTeam orders agents planner -> implementer -> reviewer', () => {
    const ordered = agentExecutionEngine.formTeam([
      { role: 'QA Reviewer' },
      { role: 'Implementer' },
      { role: 'Orchestrator' },
    ]);
    expect(ordered.map(a => a.role)).toEqual(['Orchestrator', 'Implementer', 'QA Reviewer']);
  });

  it('runTeam forms a team and runs it as a pipeline', async () => {
    executeWithFallback.mockResolvedValue({ text: 'out', modelUsed: 'm' });
    const r = await agentExecutionEngine.runTeam(
      [{ role: 'Implementer' }, { role: 'Orchestrator' }],
      'do it',
      {}
    );
    expect(r.steps.map(s => s.agentRole)).toEqual(['Orchestrator', 'Implementer']);
    expect(executeWithFallback).toHaveBeenCalledTimes(2);
  });
});
