import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { agentKnowledgeLearning } from '../services/agentKnowledgeLearning.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Learning endpoints require admin access
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/agent-knowledge/learn/task
 * Manually trigger learning from a task execution
 */
router.post('/learn/task', async (req: AdminRequest, res, next) => {
  try {
    const {
      agentRole,
      taskTitle,
      taskDescription,
      success,
      evaluation,
      skillsUsed,
      domainsUsed,
      modelUsed,
      provider,
      latency,
      tokensUsed
    } = req.body;

    if (!agentRole) {
      return res.status(400).json({
        success: false,
        message: 'agentRole is required'
      });
    }

    await agentKnowledgeLearning.learnFromTaskExecution({
      agentRole,
      taskTitle: taskTitle || '',
      taskDescription: taskDescription || '',
      success: success !== undefined ? success : true,
      evaluation: evaluation,
      skillsUsed: skillsUsed || [],
      domainsUsed: domainsUsed || [],
      modelUsed: modelUsed,
      provider: provider,
      latency: latency,
      tokensUsed: tokensUsed
    });

    res.json({
      success: true,
      message: 'Knowledge updated from task execution'
    });
  } catch (error: unknown) {
    logger.error('Failed to learn from task:', error);
    next(error);
  }
});

/**
 * POST /api/admin/agent-knowledge/learn/audit
 * Learn from audit results
 */
router.post('/learn/audit', async (req: AdminRequest, res, next) => {
  try {
    const {
      agentRole,
      auditType,
      passed,
      findings,
      score,
      domain
    } = req.body;

    if (!agentRole || !auditType) {
      return res.status(400).json({
        success: false,
        message: 'agentRole and auditType are required'
      });
    }

    await agentKnowledgeLearning.learnFromAudit({
      agentRole,
      auditType,
      passed: passed !== undefined ? passed : true,
      findings: findings || [],
      score: score,
      domain: domain
    });

    res.json({
      success: true,
      message: 'Knowledge updated from audit'
    });
  } catch (error: unknown) {
    logger.error('Failed to learn from audit:', error);
    next(error);
  }
});

/**
 * POST /api/admin/agent-knowledge/aggregate
 * Trigger platform-wide knowledge aggregation
 */
router.post('/aggregate', async (req: AdminRequest, res, next) => {
  try {
    await agentKnowledgeLearning.aggregatePlatformLearning();

    res.json({
      success: true,
      message: 'Platform learning aggregation completed'
    });
  } catch (error: unknown) {
    logger.error('Failed to aggregate platform learning:', error);
    next(error);
  }
});

export default router;

