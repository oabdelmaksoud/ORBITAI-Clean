import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findOneAndUpdate, findOne, deleteOne } = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock('../../models/ExecutionCheckpoint.model.js', () => ({
  ExecutionCheckpoint: {
    findOneAndUpdate,
    findOne: (...args: any[]) => ({ lean: () => findOne(...args) }),
    deleteOne,
  },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { executionCheckpointService } from '../executionCheckpoint.service.js';

beforeEach(() => {
  findOneAndUpdate.mockReset().mockResolvedValue({});
  findOne.mockReset();
  deleteOne.mockReset().mockResolvedValue({});
});

describe('executionCheckpointService (state, dim 11 → 5)', () => {
  it('save upserts the latest checkpoint for a task', async () => {
    await executionCheckpointService.save('t1', 2, { phase: 'impl' }, 'p1');
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ taskId: 't1' });
    expect(update).toMatchObject({ taskId: 't1', step: 2, projectId: 'p1' });
  });

  it('save no-ops without a taskId', async () => {
    await executionCheckpointService.save('', 1);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('load returns the stored snapshot', async () => {
    findOne.mockResolvedValue({ taskId: 't1', step: 3, data: { x: 1 } });
    const s = await executionCheckpointService.load('t1');
    expect(s).toEqual({ taskId: 't1', step: 3, data: { x: 1 } });
  });

  it('load returns null when no checkpoint exists', async () => {
    findOne.mockResolvedValue(null);
    expect(await executionCheckpointService.load('t1')).toBeNull();
  });

  it('isStepComplete compares against the checkpoint step', () => {
    const cp = { taskId: 't1', step: 2, data: {} };
    expect(executionCheckpointService.isStepComplete(cp, 2)).toBe(true);
    expect(executionCheckpointService.isStepComplete(cp, 3)).toBe(false);
    expect(executionCheckpointService.isStepComplete(null, 1)).toBe(false);
  });
});
