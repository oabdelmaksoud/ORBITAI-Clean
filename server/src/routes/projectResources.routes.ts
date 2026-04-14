/**
 * Project Resources Routes
 * Provides flaky tests, environments, disaster recovery, IaC templates,
 * mutation tests, performance tests, and test maintenance data
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { FlakyTest } from '../models/FlakyTest.model.js';
import { Environment } from '../models/Environment.model.js';
import { DisasterRecoveryPlan } from '../models/DisasterRecoveryPlan.model.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/projectResources/flaky-tests?projectId=&status=
 */
router.get('/flaky-tests', async (req: AuthRequest, res, next) => {
  try {
    const { projectId, status } = req.query;

    const query: Record<string, any> = {};
    if (projectId) query.projectId = projectId;
    if (status && status !== '') query.status = status;

    const tests = await FlakyTest.find(query).sort({ flakinessRate: -1 }).lean();

    res.json({ success: true, data: tests });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projectResources/environments?projectId=
 */
router.get('/environments', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;

    const query: Record<string, any> = {};
    if (projectId) query.projectId = projectId;

    const environments = await Environment.find(query)
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, data: environments });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projectResources/environments/:id/deploy
 */
router.post('/environments/:id/deploy', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const environment = await Environment.findById(id);
    if (!environment) {
      return res.status(404).json({ success: false, error: 'Environment not found' });
    }

    environment.status = 'deploying';
    await environment.save();

    res.json({ success: true, data: environment });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projectResources/disaster-recovery?projectId=
 */
router.get('/disaster-recovery', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;

    const query: Record<string, any> = {};
    if (projectId) query.projectId = projectId;

    const plan = await DisasterRecoveryPlan.findOne(query)
      .sort({ createdAt: -1 })
      .lean();

    if (!plan) {
      return res.json({ success: true, data: null });
    }

    // Map model's failoverProcedures shape to component's expected shape
    const mappedPlan = {
      ...plan,
      failoverProcedures: (plan.failoverProcedures || []).map(
        (fp: any, index: number) => ({
          step: index + 1,
          description: fp.scenario || fp.description || '',
          estimatedTime: fp.estimatedTime || 0,
        })
      ),
    };

    res.json({ success: true, data: mappedPlan });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projectResources/templates?projectId=&tool=
 * IaC templates are generated on-demand, not stored
 */
router.get('/templates', async (_req: AuthRequest, res, next) => {
  try {
    logger.debug('projectResources/templates: IaC templates are generated on-demand');
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projectResources/mutation-tests?projectId=
 * No mutation test model; returns empty array
 */
router.get('/mutation-tests', async (_req: AuthRequest, res, next) => {
  try {
    logger.debug('projectResources/mutation-tests: no model, returning []');
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projectResources/performance-tests?projectId=
 * No performance test model; returns empty array
 */
router.get('/performance-tests', async (_req: AuthRequest, res, next) => {
  try {
    logger.debug('projectResources/performance-tests: no model, returning []');
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projectResources/test-maintenance?projectId=
 * No test maintenance model; returns empty report
 */
router.get('/test-maintenance', async (_req: AuthRequest, res, next) => {
  try {
    logger.debug('projectResources/test-maintenance: no model, returning empty report');
    res.json({
      success: true,
      data: {
        updates: [],
        summary: { total: 0, updated: 0, needsUpdate: 0, new: 0, obsolete: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
