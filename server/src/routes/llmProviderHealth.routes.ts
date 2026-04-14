/**
 * LLM Provider Health Routes
 * Exposes provider health metrics to authenticated users
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { llmHealthMonitoringService } from '../services/llmHealthMonitoring.service.js';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/llmProviderHealth/provider-health?provider=
 */
router.get('/provider-health', async (req: AuthRequest, res, next) => {
  try {
    const { provider } = req.query;

    let data;
    if (provider && typeof provider === 'string') {
      const metrics = await llmHealthMonitoringService.calculateHealthMetrics(provider);
      data = [
        {
          provider: metrics.provider,
          healthScore: metrics.healthScore,
          uptime: metrics.uptime,
          averageResponseTime: metrics.averageResponseTime,
          errorRate: metrics.errorRate / 100,
          rateLimitFrequency: metrics.rateLimitFrequency / 1000,
          totalRequests: 0,
          recentErrors: [],
          trends: {
            uptime: 'stable' as const,
            responseTime: 'stable' as const,
            errorRate: 'stable' as const,
          },
          status:
            metrics.healthScore >= 90
              ? ('healthy' as const)
              : metrics.healthScore >= 60
              ? ('degraded' as const)
              : ('unhealthy' as const),
        },
      ];
    } else {
      const report = await llmHealthMonitoringService.generateHealthReport();
      data = report.providers.map(p => ({
        provider: p.provider,
        healthScore: p.healthScore,
        uptime: p.uptime,
        averageResponseTime: p.averageResponseTime,
        errorRate: p.errorRate / 100,
        rateLimitFrequency: p.rateLimitFrequency / 1000,
        totalRequests: 0,
        recentErrors: [],
        trends: {
          uptime: 'stable' as const,
          responseTime: 'stable' as const,
          errorRate: 'stable' as const,
        },
        status:
          p.healthScore >= 90
            ? ('healthy' as const)
            : p.healthScore >= 60
            ? ('degraded' as const)
            : ('unhealthy' as const),
      }));
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
