/**
 * Execution Checkpoint Service (state & resumability — dim 11 → 5).
 *
 * Per-step checkpointing so a resumed run continues from its last completed step instead of
 * restarting. Complements executionRecovery (which re-queues orphaned runs at boot): a long task
 * saves a checkpoint after each step; on resume it loads the checkpoint and skips completed steps.
 * All methods degrade gracefully (no-op / null on error) so checkpointing never breaks execution.
 */

import { logger } from '../utils/logger.js';
import { ExecutionCheckpoint } from '../models/ExecutionCheckpoint.model.js';

export interface CheckpointSnapshot {
  taskId: string;
  step: number;
  data: Record<string, unknown>;
}

class ExecutionCheckpointService {
  /** Upsert the latest checkpoint for a task. Fire-and-forget; never throws. */
  async save(
    taskId: string,
    step: number,
    data: Record<string, unknown> = {},
    projectId?: string
  ): Promise<void> {
    if (!taskId) return;
    try {
      await ExecutionCheckpoint.findOneAndUpdate(
        { taskId },
        { taskId, projectId, step, data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      logger.warn('[Checkpoint] save failed (non-fatal):', error);
    }
  }

  /** Load the latest checkpoint for a task, or null if none / on error. */
  async load(taskId: string): Promise<CheckpointSnapshot | null> {
    if (!taskId) return null;
    try {
      const doc: any = await ExecutionCheckpoint.findOne({ taskId }).lean();
      if (!doc) return null;
      return { taskId: doc.taskId, step: doc.step ?? 0, data: doc.data ?? {} };
    } catch (error) {
      logger.warn('[Checkpoint] load failed (non-fatal):', error);
      return null;
    }
  }

  /** Remove a task's checkpoint once it completes. Never throws. */
  async clear(taskId: string): Promise<void> {
    if (!taskId) return;
    try {
      await ExecutionCheckpoint.deleteOne({ taskId });
    } catch (error) {
      logger.warn('[Checkpoint] clear failed (non-fatal):', error);
    }
  }

  /** True if a step has already been completed per the loaded checkpoint (resume helper). */
  isStepComplete(checkpoint: CheckpointSnapshot | null, step: number): boolean {
    return !!checkpoint && checkpoint.step >= step;
  }
}

export const executionCheckpointService = new ExecutionCheckpointService();
