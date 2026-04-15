/**
 * Pipecat Voice Routes
 * Session management endpoints for voice conversations
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { pipecatBridgeService } from '../services/pipecatBridge.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createSessionSchema = z
  .object({
    conversationId: z.string().nullable().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

const updateSessionSchema = z
  .object({
    conversationId: z.string().nullable().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

/**
 * GET /api/pipecat/health
 * Health check endpoint
 */
router.get('/health', async (_req, res) => {
  try {
    const isEnabled = pipecatBridgeService.isEnabled();
    const serviceUrl = pipecatBridgeService.getServiceUrl();

    res.json({
      success: true,
      enabled: isEnabled,
      serviceUrl,
      message: isEnabled ? 'Pipecat service is enabled' : 'Pipecat service is disabled',
    });
  } catch (error: unknown) {
    logger.error('[Pipecat] Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/pipecat/session/create
 * Create a new voice session
 */
router.post(
  '/session/create',
  authenticateToken,
  validate(createSessionSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.user?.id;
      const { conversationId, metadata } = req.body;

      if (!pipecatBridgeService.isEnabled()) {
        throw new AppError('Pipecat voice service is not enabled', 503);
      }

      const session = await pipecatBridgeService.createSession({
        userId,
        conversationId,
        metadata,
      });

      // Get WebSocket URL for client
      const openaiKey = await import('../services/apiKeyProvider.service.js').then(m =>
        m.apiKeyProvider.getApiKey('openai')
      );
      const wsUrl = pipecatBridgeService.getWebSocketUrl(session.sessionId, {
        conversationId: session.conversationId,
        userId: session.userId,
        apiKey: openaiKey || undefined,
      });

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          wsUrl,
          serviceUrl: pipecatBridgeService.getServiceUrl(),
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/pipecat/session/:id
 * Get session information (for Python service to fetch API keys)
 */
router.get('/session/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await pipecatBridgeService.getSession(id);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Return session with API key (for Python service)
    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        userId: session.userId,
        conversationId: session.conversationId,
        metadata: session.metadata,
        apiKey: (session as any).apiKey, // OpenAI key for STT/TTS
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/pipecat/session/:id/update
 * Update session context (conversation metadata)
 */
router.post(
  '/session/:id/update',
  authenticateToken,
  validate(updateSessionSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { conversationId, metadata } = req.body;

      // Verify session belongs to user
      const session = await pipecatBridgeService.getSession(id);
      if (!session) {
        throw new AppError('Session not found', 404);
      }

      if (session.userId && session.userId !== userId) {
        throw new AppError('Unauthorized: Session does not belong to user', 403);
      }

      const updatedSession = await pipecatBridgeService.updateSession(id, {
        conversationId,
        metadata,
      });

      if (!updatedSession) {
        throw new AppError('Failed to update session', 500);
      }

      res.json({
        success: true,
        data: {
          sessionId: updatedSession.sessionId,
          conversationId: updatedSession.conversationId,
          metadata: updatedSession.metadata,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * DELETE /api/pipecat/session/:id
 * End session and save conversation to database
 */
router.delete('/session/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Verify session belongs to user
    const session = await pipecatBridgeService.getSession(id);
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.userId && session.userId !== userId) {
      throw new AppError('Unauthorized: Session does not belong to user', 403);
    }

    // End session and save conversation
    await pipecatBridgeService.endSession(id);

    res.json({
      success: true,
      message: 'Session ended and conversation saved',
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/pipecat/session/:id/transcript
 * Add a transcript to the session (called by Python service)
 */
router.post('/session/:id/transcript', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userText, aiText } = req.body;

    if (!userText || !aiText) {
      throw new AppError('userText and aiText are required', 400);
    }

    await pipecatBridgeService.addTranscript(id, userText, aiText);

    res.json({
      success: true,
      message: 'Transcript added',
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
