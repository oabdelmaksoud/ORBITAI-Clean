/**
 * Execution Recovery Service (state & resumability — harness dim 11)
 *
 * The background execution loops (backgroundAutoPilotService, backgroundTaskService)
 * keep their orchestration state in-memory (`activeAutoPilots` / `activeTasks` maps).
 * If the process crashes or restarts mid-run, those maps are lost, but any task that
 * was mid-flight has already been persisted to Mongo with status 'In Progress'.
 * Those tasks become orphaned: nothing in-memory owns them anymore, so they will
 * never advance.
 *
 * `recoverInterruptedRuns()` runs once at boot — before any new loop can start, the
 * in-memory maps are guaranteed empty, so every 'In Progress' task whose work began
 * before a small threshold is unambiguously orphaned. We reset those back to a
 * resumable state ('Pending') so the autopilot loop re-picks them. Progress, output,
 * and logs already persisted on the task are preserved, so a re-pick resumes with
 * prior context rather than starting from scratch.
 *
 * This is boot-only by design. A periodic version would be unsafe: a live in-memory
 * loop legitimately holds tasks in 'In Progress', and a periodic reset would clobber
 * work that is actively running.
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';

/** Status string a mid-flight task carries (set by both background services). */
export const IN_PROGRESS_STATUS = 'In Progress';

/** Resumable status the autopilot loop re-picks (alongside 'Failed' / 'Paused'). */
export const RESUMABLE_STATUS = 'Pending';

/** Default age (minutes) before an 'In Progress' task is considered orphaned. */
export const DEFAULT_RECOVERY_THRESHOLD_MINUTES = 2;

export interface RecoveryResult {
  projectsScanned: number;
  tasksReset: number;
  errors: number;
}

/**
 * Find tasks left in an in-progress state (orphaned because the in-memory loop died)
 * older than `thresholdMinutes` and reset them to a resumable state so they get
 * re-picked. Idempotent and safe to run repeatedly: already-resumable tasks are
 * untouched, and recent in-progress tasks (possibly owned by a live loop) are left
 * alone.
 *
 * @param thresholdMinutes Minimum age of the in-progress task before it is reset.
 */
export async function recoverInterruptedRuns(
  thresholdMinutes: number = DEFAULT_RECOVERY_THRESHOLD_MINUTES
): Promise<RecoveryResult> {
  const result: RecoveryResult = { projectsScanned: 0, tasksReset: 0, errors: 0 };

  try {
    // `task.startTime` is a numeric Date.now() millisecond timestamp (NOT a Date),
    // so the cutoff must also be a number — do not compare against Mongoose Dates here.
    const cutoffMs = Date.now() - thresholdMinutes * 60 * 1000;

    // Dot-into-array query: only load projects that have at least one in-progress task.
    const projects = await Project.find({ 'tasks.status': IN_PROGRESS_STATUS });

    logger.info(
      `[ExecutionRecovery] Scanning ${projects.length} project(s) for orphaned '${IN_PROGRESS_STATUS}' tasks older than ${thresholdMinutes} minute(s)`
    );

    for (const project of projects) {
      result.projectsScanned++;

      try {
        const tasks: any[] = project.tasks || [];
        let modifiedAny = false;

        for (const task of tasks) {
          if (!task || task.status !== IN_PROGRESS_STATUS) {
            continue;
          }

          // Require a startTime that is clearly past the threshold. A task with no
          // startTime is ambiguous; leave it rather than risk resetting something
          // that just started.
          const startTime = typeof task.startTime === 'number' ? task.startTime : undefined;
          if (startTime === undefined || startTime >= cutoffMs) {
            continue;
          }

          task.status = RESUMABLE_STATUS;
          if (!Array.isArray(task.logs)) {
            task.logs = [];
          }
          task.logs.push(
            `[ExecutionRecovery] Reset from '${IN_PROGRESS_STATUS}' to '${RESUMABLE_STATUS}' at ${new Date().toISOString()} (orphaned by process restart)`
          );

          modifiedAny = true;
          result.tasksReset++;
        }

        if (modifiedAny) {
          // `tasks` is an untyped (Mixed) Array; Mongoose does not auto-track in-place
          // mutation of properties inside it, so mark it dirty explicitly before save.
          project.markModified('tasks');
          await project.save();
          logger.info(
            `[ExecutionRecovery] Reset orphaned task(s) in project ${project._id}`
          );
        }
      } catch (error: unknown) {
        result.errors++;
        logger.error(
          `[ExecutionRecovery] Failed to recover project ${project._id}:`,
          error
        );
      }
    }

    logger.info(
      `[ExecutionRecovery] Recovery complete: scanned ${result.projectsScanned} project(s), reset ${result.tasksReset} task(s), ${result.errors} error(s)`
    );
    return result;
  } catch (error: unknown) {
    result.errors++;
    logger.error('[ExecutionRecovery] Recovery failed:', error);
    return result;
  }
}

export const executionRecoveryService = { recoverInterruptedRuns };
