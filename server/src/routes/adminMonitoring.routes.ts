import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { monitoringService } from '../services/monitoring.service.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

/**
 * GET /api/admin/monitoring/metrics
 * Get current system metrics
 */
router.get('/metrics', async (_req: AdminRequest, res, next) => {
  try {
    const metrics = await monitoringService.getSystemMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/monitoring/live
 * Server-Sent Events stream for real-time metrics
 * Note: SSE doesn't support custom headers well, so authentication is handled via query param or cookie
 */
router.get('/live', async (req: AdminRequest, res, next) => {
  try {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for SSE

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // Send metrics every 2 seconds
    const interval = setInterval(async () => {
      try {
        const metrics = await monitoringService.getSystemMetrics();
        res.write(`data: ${JSON.stringify({ type: 'metrics', data: metrics })}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
      }
    }, 2000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/monitoring/active-sessions
 * Get active user sessions
 */
router.get('/active-sessions', async (_req: AdminRequest, res, next) => {
  try {
    const sessions = await monitoringService.getActiveSessions();
    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/monitoring/kill-session/:id
 * Kill a user session
 */
router.post('/kill-session/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    await monitoringService.killSession(id, req.admin!.id);
    res.json({
      success: true,
      message: 'Session killed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/monitoring/active-requests
 * Get active API requests
 */
router.get('/active-requests', async (_req: AdminRequest, res, next) => {
  try {
    const requests = monitoringService.getActiveRequests();
    res.json({
      success: true,
      data: { requests }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/monitoring/cancel-request/:id
 * Cancel an active request
 */
router.post('/cancel-request/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const cancelled = monitoringService.cancelRequest(id);
    
    if (cancelled) {
      res.json({
        success: true,
        message: 'Request cancelled'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/monitoring/queue-status
 * Get background job queue status
 */
router.get('/queue-status', async (_req: AdminRequest, res, next) => {
  try {
    const status = await monitoringService.getQueueStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/monitoring/clear-queue
 * Clear job queue
 */
router.post('/clear-queue', async (req: AdminRequest, res, next) => {
  try {
    await monitoringService.clearQueue(req.admin!.id);
    res.json({
      success: true,
      message: 'Queue cleared successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

