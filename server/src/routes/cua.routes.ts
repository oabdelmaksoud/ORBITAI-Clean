/**
 * CUA (Computer Using Agent) Routes
 * API endpoints for prototype testing with LIVE streaming
 * Supports both local Playwright testing and CUA Cloud integration
 *
 * @module routes/cua
 */

import { Router, Request, Response } from 'express';
import { cuaService, TestScenario } from '../services/cua.service.js';
import { cuaAdapterService, CUATestMode } from '../services/cua-adapter.service.js';
import { authenticateToken } from '../middleware/auth.js';
import { taskExecutionRateLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { projectFileService } from '../services/projectFile.service.js';

const router = Router();

/**
 * POST /api/cua/test
 * Start a live CUA test with dynamic scenarios (legacy endpoint)
 * Returns immediately - listen for WebSocket events for live updates
 */
router.post(
  '/test',
  authenticateToken,
  taskExecutionRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { html, sessionId: providedSessionId, wait } = req.body;

      if (!html || typeof html !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "html" field',
        });
      }

      // Generate session ID if not provided
      const sessionId = providedSessionId || uuidv4();

      logger.info(`[CUA] Starting live test for session: ${sessionId}`);

      // Determine what to test: Project (if synced files exist) or HTML (fallback)
      const { projectId } = req.body;
      let contentToTest = html;

      if (projectId) {
        const files = projectFileService.getFiles(projectId);
        if (files.length > 0) {
          // console.log(`[CUA] Using synced project files for ${projectId}`);
          contentToTest = projectId;
        }
      }

      if (wait) {
        // Synchronous mode - wait for completion
        const result = await cuaService.testPrototypeLive(contentToTest, sessionId);

        return res.json({
          success: true,
          sessionId,
          status: result.status,
          summary: result.summary,
          videoUrl: result.videoUrl,
          screenshot: result.screenshot,
          scenarios: result.scenarios,
          passedCount: result.passedCount,
          failedCount: result.failedCount,
          duration: result.totalDuration,
        });
      }

      // Async mode - return immediately, stream via WebSocket
      cuaService
        .testPrototypeLive(contentToTest, sessionId)
        .then(result => {
          logger.info(`[CUA] Test completed for session ${sessionId}: ${result.summary}`);
        })
        .catch(error => {
          logger.error(`[CUA] Test failed for session ${sessionId}:`, error);
        });

      res.json({
        success: true,
        sessionId,
        message:
          'Live CUA test started. Listen for WebSocket events: cua:frame, cua:scenarios, cua:scenario:start, cua:scenario:result, cua:test:complete',
      });
    } catch (error: unknown) {
      logger.error('[CUA] Route error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/cua/test/advanced
 * Advanced CUA test with mode selection (local/cloud/auto)
 * Uses @trycua/agent SDK for standardized response format
 */
router.post(
  '/test/advanced',
  authenticateToken,
  taskExecutionRateLimiter,
  [
    body('html').isString().notEmpty().withMessage('HTML content is required'),
    body('mode')
      .optional()
      .isIn(['local', 'llm-enhanced', 'cloud', 'auto'])
      .withMessage('Mode must be local, llm-enhanced, cloud, or auto'),
    body('model').optional().isString().withMessage('Model must be a string'),
    body('timeout')
      .optional()
      .isInt({ min: 1000, max: 300000 })
      .withMessage('Timeout must be between 1000 and 300000ms'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const {
        html,
        sessionId: providedSessionId,
        mode = 'local',
        model,
        timeout,
        saveTrajectory = false,
        wait = true,
      } = req.body;

      const sessionId = providedSessionId || uuidv4();

      logger.info(`[CUA Advanced] Starting test - Mode: ${mode}, Session: ${sessionId}`);

      const options = {
        mode: mode as CUATestMode,
        model,
        timeout,
        saveTrajectory,
      };

      if (wait) {
        // Synchronous mode - wait for completion and return CUA response format
        const response = await cuaAdapterService.test(html, sessionId, options);

        return res.json({
          success: true,
          sessionId,
          response,
        });
      }

      // Async mode - return immediately
      cuaAdapterService
        .test(html, sessionId, options)
        .then(response => {
          logger.info(`[CUA Advanced] Test completed for session ${sessionId}: ${response.status}`);
        })
        .catch(error => {
          logger.error(`[CUA Advanced] Test failed for session ${sessionId}:`, error);
        });

      res.json({
        success: true,
        sessionId,
        message:
          'Advanced CUA test started. Listen for WebSocket events including cua:reasoning and cua:usage',
      });
    } catch (error: unknown) {
      logger.error('[CUA Advanced] Route error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/cua/health
 * Health check for CUA services (both local and cloud)
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await cuaAdapterService.healthCheck();
    const isHealthy = health.local || health.cloud === true;

    res.json({
      success: true,
      healthy: isHealthy,
      details: {
        local: health.local,
        cloud: health.cloud,
        cloudAvailable: cuaAdapterService.isCloudAvailable(),
      },
      message: isHealthy ? 'CUA service is healthy' : 'CUA service is not responding',
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      healthy: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/cua/capabilities
 * Get available CUA capabilities and modes
 */
router.get('/capabilities', (_req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: {
      modes: ['local', 'cloud', 'auto', 'llm-enhanced'],
      cloudAvailable: cuaAdapterService.isCloudAvailable(),
      supportedActions: ['click', 'input', 'keyboard', 'hover', 'scroll'],
      features: {
        liveStreaming: true,
        videoRecording: true,
        aiScenarioGeneration: true,
        humanLikeInteractions: true,
        autoFix: true,
      },
    },
  });
});

/**
 * POST /api/cua/test/autofix
 * Run CUA tests with automatic fix and re-run on failure
 */
router.post(
  '/test/autofix',
  authenticateToken,
  taskExecutionRateLimiter,
  [
    body('html').isString().notEmpty().withMessage('HTML content is required'),
    body('maxRetries')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('maxRetries must be between 1 and 5'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { html, sessionId: providedSessionId, maxRetries = 2 } = req.body;

      const sessionId = providedSessionId || `autofix-${uuidv4()}`;
      logger.info(`[CUA Auto-Fix] Starting test with auto-fix for session: ${sessionId}`);

      const result = await cuaService.runLiveTestWithAutoFix(html, sessionId, maxRetries);

      res.json({
        success: true,
        sessionId,
        status: result.status,
        summary: result.summary,
        passedCount: result.passedCount,
        failedCount: result.failedCount,
        attempts: result.attempts,
        autoFixApplied: result.autoFixApplied,
        fixedHtml: result.fixedHtml,
        fixChanges: result.fixChanges,
        scenarios: result.scenarios,
        videoUrl: result.videoUrl,
        duration: result.totalDuration,
      });
    } catch (error: unknown) {
      logger.error('[CUA Auto-Fix] Route error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/cua/session/cancel
 * Cancel an active CUA session to stop frame streaming
 * This helps clean up stale sessions when starting a new test
 */
router.post(
  '/session/cancel',
  authenticateToken,
  taskExecutionRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing sessionId',
        });
      }

      logger.info(`[CUA] Cancelling session: ${sessionId}`);

      // Notify via WebSocket that session is cancelled
      // The cuaService will handle cleanup if session exists
      if (cuaService.cancelSession) {
        await cuaService.cancelSession(sessionId);
      }

      res.json({
        success: true,
        message: `Session ${sessionId} cancelled`,
      });
    } catch (error: unknown) {
      logger.error('[CUA] Cancel session error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
