/**
 * Agent Learning Manual Trigger Routes
 * Allows manual triggering of agent learning and embedding generation
 */

import express, { Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { agentKnowledgeAggregator } from '../services/agentKnowledgeAggregator.js';
import { embeddingService } from '../services/embedding.service.js';
import { autoEmbedArtifacts } from '../services/autoEmbedArtifacts.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/learning/trigger
 * Manually trigger agent knowledge aggregation
 */
router.post('/trigger', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`Manual agent learning trigger requested by admin: ${req.admin?.email}`);

    // Run aggregation
    await agentKnowledgeAggregator.runAggregation();

    res.json({
      success: true,
      message: 'Agent learning aggregation completed'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/learning/embed-artifacts
 * Batch embed all artifacts
 */
router.post('/embed-artifacts', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.body.limit as string) || 100;

    logger.info(`Manual artifact embedding requested by admin: ${req.admin?.email}, limit: ${limit}`);

    const embedded = await autoEmbedArtifacts.embedAllArtifacts(limit);

    res.json({
      success: true,
      message: `Embedded ${embedded} artifacts`,
      count: embedded
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/learning/status
 * Get learning service status
 */
router.get('/status', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const hasOpenAI = await embeddingService.hasApiKey?.('openai');
    const hasGemini = await embeddingService.hasApiKey?.('gemini');

    res.json({
      success: true,
      data: {
        embeddingProvider: (embeddingService as any).embeddingProvider || 'unknown',
        hasOpenAIKey: hasOpenAI,
        hasGeminiKey: hasGemini,
        embeddingDimensions: embeddingService.getEmbeddingDimensions?.() || 0,
        aggregatorRunning: agentKnowledgeAggregator.isRunning || false
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/learning/embed-single/:artifactId
 * Embed a specific artifact
 */
router.post('/embed-single/:artifactId', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { artifactId } = req.params;

    logger.info(`Manual single artifact embedding requested: ${artifactId}`);

    // Import dynamically to avoid circular dependency
    const { Artifact } = await import('../models/Artifact.model.js');
    const artifact = await Artifact.findById(artifactId);

    if (!artifact) {
      return res.status(404).json({
        success: false,
        message: 'Artifact not found'
      });
    }

    await autoEmbedArtifacts.embedArtifact(artifact);

    res.json({
      success: true,
      message: `Artifact ${artifactId} embedding generated`
    });
  } catch (error: unknown) {
    next(error);
  }
});

export const learningTriggerRoutes = router;
