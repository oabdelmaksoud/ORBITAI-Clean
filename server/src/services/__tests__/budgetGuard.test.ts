import { describe, it, expect, vi, beforeEach } from 'vitest';

const { aggregate } = vi.hoisted(() => ({ aggregate: vi.fn() }));

vi.mock('../../models/LLMUsage.model.js', () => ({ LLMUsage: { aggregate } }));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { budgetGuard, BudgetExceededError } from '../budgetGuard.service.js';

beforeEach(() => aggregate.mockReset());

describe('budgetGuard (cost governance, dim 16)', () => {
  it('no-ops (no query) when no cap is configured', async () => {
    await expect(budgetGuard.assertWithinBudget('u1', undefined)).resolves.toBeUndefined();
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('no-ops when there is no userId', async () => {
    await budgetGuard.assertWithinBudget(undefined, 100);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('allows the request when month-to-date spend is under the cap', async () => {
    aggregate.mockResolvedValue([{ total: 40 }]);
    await expect(budgetGuard.assertWithinBudget('u1', 100)).resolves.toBeUndefined();
  });

  it('throws BudgetExceededError at/over the cap (fail-closed)', async () => {
    aggregate.mockResolvedValue([{ total: 100 }]);
    await expect(budgetGuard.assertWithinBudget('u1', 100)).rejects.toBeInstanceOf(
      BudgetExceededError
    );
  });

  it('reports 0 spend when the user has no usage this month', async () => {
    aggregate.mockResolvedValue([]);
    await expect(budgetGuard.getMonthlySpend('u1')).resolves.toBe(0);
    // ...and therefore allows the request under any positive cap.
    await expect(budgetGuard.assertWithinBudget('u1', 100)).resolves.toBeUndefined();
  });

  it('blocks when the estimated request cost would push spend over the cap (pre-estimate)', async () => {
    aggregate.mockResolvedValue([{ total: 90 }]);
    await expect(budgetGuard.assertWithinBudget('u1', 100, 20)).rejects.toBeInstanceOf(
      BudgetExceededError
    );
  });

  it('allows when spend + estimated request cost stays under the cap', async () => {
    aggregate.mockResolvedValue([{ total: 50 }]);
    await expect(budgetGuard.assertWithinBudget('u1', 100, 20)).resolves.toBeUndefined();
  });
});
