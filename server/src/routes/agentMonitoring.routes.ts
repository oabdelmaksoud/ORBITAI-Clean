/**
 * Agent Monitoring Routes
 * Provides agent communication, health, rollback, and conflict data
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AgentMessage } from '../models/AgentMessage.model.js';
import { AgentExecution } from '../models/AgentExecution.model.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/agentMonitoring/messages?projectId=&type=&limit=
 */
router.get('/messages', async (req: AuthRequest, res, next) => {
  try {
    const { projectId, type, limit } = req.query;
    const maxLimit = Math.min(Number(limit) || 50, 200);

    const query: Record<string, any> = {};
    if (projectId) query.projectId = projectId;
    if (type && type !== '') query.messageType = type;

    const messages = await AgentMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(maxLimit)
      .lean();

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentMonitoring/health?projectId=&agentRole=&agentId=
 */
router.get('/health', async (req: AuthRequest, res, next) => {
  try {
    const { projectId, agentRole, agentId } = req.query;

    const query: Record<string, any> = {};
    if (projectId) query.projectId = projectId;
    if (agentRole) query.agentRole = agentRole;
    if (agentId) query.agentId = agentId;

    const executions = await AgentExecution.find(query).sort({ startedAt: -1 }).lean();

    if (executions.length === 0) {
      return res.json({ success: true, data: null });
    }

    const total = executions.length;
    const successful = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const successRate = total > 0 ? successful / total : 0;
    const errorRate = total > 0 ? failed / total : 0;

    const completedWithTime = executions.filter(
      e => e.status === 'completed' && e.completedAt && e.startedAt
    );
    const averageExecutionTime =
      completedWithTime.length > 0
        ? completedWithTime.reduce(
            (sum, e) =>
              sum +
              (new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime()),
            0
          ) / completedWithTime.length
        : 0;

    const recentErrors = executions
      .filter(e => e.status === 'failed')
      .slice(0, 10)
      .map(e => ({
        timestamp: e.completedAt || e.startedAt,
        error: e.rollbackReason || 'Execution failed',
        taskId: e.taskId,
      }));

    const healthScore = Math.max(0, Math.round(successRate * 100));
    const firstExec = executions[executions.length - 1];
    const metrics = {
      agentId: (agentId as string) || firstExec?.agentId || '',
      agentRole: (agentRole as string) || firstExec?.agentRole || '',
      healthScore,
      successRate,
      averageExecutionTime: Math.round(averageExecutionTime),
      errorRate,
      totalExecutions: total,
      recentErrors,
      trends: {
        healthScore: 'stable' as const,
        successRate: 'stable' as const,
        executionTime: 'stable' as const,
      },
      issues: errorRate > 0.2 ? ['High error rate detected'] : [],
    };

    res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentMonitoring/rollbacks?projectId=
 */
router.get('/rollbacks', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;

    const query: Record<string, any> = {
      status: { $in: ['rolled_back', 'failed'] },
      stateSnapshot: { $exists: true, $ne: null },
    };
    if (projectId) query.projectId = projectId;

    const executions = await AgentExecution.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    const rollbacks = executions.map(e => ({
      _id: e._id,
      executionId: String(e._id),
      agentId: e.agentId,
      agentRole: e.agentRole,
      reason: e.rollbackReason || 'Execution failed',
      artifactsReverted: (e.artifactsCreated || []).map((a: any) => ({
        artifactId: a.artifactId,
        artifactName: a.artifactId,
        previousVersion: a.snapshot ? '1' : '0',
      })),
      rollbackTime: e.rolledBackAt || e.updatedAt,
      status: e.status === 'rolled_back' ? 'success' : 'failed',
    }));

    res.json({ success: true, data: rollbacks });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentMonitoring/conflicts?projectId=
 */
router.get('/conflicts', async (_req: AuthRequest, res, next) => {
  try {
    // No dedicated conflict model — return empty array for now
    logger.debug('agentMonitoring/conflicts: no conflict model, returning []');
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

export default router;
