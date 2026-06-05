import { describe, it, expect, vi, beforeEach } from 'vitest';

const { find } = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock('../../models/Project.model.js', () => ({ Project: { find } }));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  recoverInterruptedRuns,
  IN_PROGRESS_STATUS,
  RESUMABLE_STATUS,
} from '../executionRecovery.service.js';

const MINUTE = 60 * 1000;

/** Build a synthetic project doc with mockable save/markModified. */
function makeProject(tasks: any[]) {
  return {
    _id: 'proj-1',
    tasks,
    markModified: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  find.mockReset();
});

describe('executionRecovery.recoverInterruptedRuns (state & resumability, dim 11)', () => {
  it("resets an orphaned 'In Progress' task past the threshold to 'Pending' and persists", async () => {
    // startTime well past the default 2-minute threshold (10 minutes ago)
    const staleTask = {
      id: 't-stale',
      status: IN_PROGRESS_STATUS,
      startTime: Date.now() - 10 * MINUTE,
      logs: [],
    };
    const project = makeProject([staleTask]);
    find.mockResolvedValue([project]);

    const result = await recoverInterruptedRuns();

    expect(staleTask.status).toBe(RESUMABLE_STATUS);
    expect(result.tasksReset).toBe(1);
    expect(result.projectsScanned).toBe(1);
    expect(result.errors).toBe(0);
    // Mixed array mutation must be flagged + persisted.
    expect(project.markModified).toHaveBeenCalledWith('tasks');
    expect(project.save).toHaveBeenCalledTimes(1);
    // A recovery log line is appended.
    expect(staleTask.logs.length).toBe(1);
    expect(staleTask.logs[0]).toContain('ExecutionRecovery');
  });

  it("leaves a fresh 'In Progress' task (within threshold) untouched", async () => {
    const freshTask = {
      id: 't-fresh',
      status: IN_PROGRESS_STATUS,
      startTime: Date.now() - 5 * 1000, // 5s ago, well within 2-minute threshold
      logs: [],
    };
    const project = makeProject([freshTask]);
    find.mockResolvedValue([project]);

    const result = await recoverInterruptedRuns();

    expect(freshTask.status).toBe(IN_PROGRESS_STATUS);
    expect(result.tasksReset).toBe(0);
    expect(project.markModified).not.toHaveBeenCalled();
    expect(project.save).not.toHaveBeenCalled();
  });

  it('leaves an In Progress task with no startTime untouched (ambiguous)', async () => {
    const noStart = { id: 't-nostart', status: IN_PROGRESS_STATUS, logs: [] };
    const project = makeProject([noStart]);
    find.mockResolvedValue([project]);

    const result = await recoverInterruptedRuns();

    expect(noStart.status).toBe(IN_PROGRESS_STATUS);
    expect(result.tasksReset).toBe(0);
    expect(project.save).not.toHaveBeenCalled();
  });

  it('is idempotent: an already-resumable task is not touched', async () => {
    const pending = {
      id: 't-pending',
      status: RESUMABLE_STATUS,
      startTime: Date.now() - 10 * MINUTE,
      logs: [],
    };
    const project = makeProject([pending]);
    find.mockResolvedValue([project]);

    const result = await recoverInterruptedRuns();

    expect(pending.status).toBe(RESUMABLE_STATUS);
    expect(result.tasksReset).toBe(0);
    expect(pending.logs.length).toBe(0);
    expect(project.save).not.toHaveBeenCalled();
  });

  it('resets only the stale task when stale and fresh coexist in one project', async () => {
    const stale = {
      id: 's',
      status: IN_PROGRESS_STATUS,
      startTime: Date.now() - 10 * MINUTE,
      logs: [],
    };
    const fresh = {
      id: 'f',
      status: IN_PROGRESS_STATUS,
      startTime: Date.now() - 1000,
      logs: [],
    };
    const project = makeProject([stale, fresh]);
    find.mockResolvedValue([project]);

    const result = await recoverInterruptedRuns();

    expect(stale.status).toBe(RESUMABLE_STATUS);
    expect(fresh.status).toBe(IN_PROGRESS_STATUS);
    expect(result.tasksReset).toBe(1);
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('honors a custom threshold', async () => {
    // 3 minutes old; with a 5-minute threshold it should NOT be reset.
    const task = {
      id: 't',
      status: IN_PROGRESS_STATUS,
      startTime: Date.now() - 3 * MINUTE,
      logs: [],
    };
    const project = makeProject([task]);
    find.mockResolvedValue([project]);

    const result = await recoverInterruptedRuns(5);

    expect(task.status).toBe(IN_PROGRESS_STATUS);
    expect(result.tasksReset).toBe(0);
  });

  it('counts an error and continues when a project save fails', async () => {
    const stale = {
      id: 's',
      status: IN_PROGRESS_STATUS,
      startTime: Date.now() - 10 * MINUTE,
      logs: [],
    };
    const project = makeProject([stale]);
    project.save.mockRejectedValue(new Error('db down'));
    find.mockResolvedValue([project]);

    const result = await recoverInterruptedRuns();

    expect(result.errors).toBe(1);
    expect(result.projectsScanned).toBe(1);
  });
});
