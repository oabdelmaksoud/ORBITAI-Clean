import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { systemControlService } from '../services/systemControl.service.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

/**
 * GET /api/admin/system/health
 * Get detailed system health metrics
 */
router.get('/health', async (_req: AdminRequest, res, next) => {
  try {
    const health = await systemControlService.getSystemHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/system/processes
 * List running processes
 */
router.get('/processes', async (_req: AdminRequest, res, next) => {
  try {
    const processes = await systemControlService.getProcesses();
    res.json({
      success: true,
      data: { processes }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/system/kill-process/:pid
 * Kill a specific process
 */
router.post('/kill-process/:pid', async (req: AdminRequest, res, next) => {
  try {
    const pid = parseInt(req.params.pid);
    if (isNaN(pid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid process ID'
      });
    }

    await systemControlService.killProcess(pid, req.admin!.id);
    res.json({
      success: true,
      message: `Process ${pid} killed successfully`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/system/maintenance-mode
 * Get maintenance mode status
 */
router.get('/maintenance-mode', async (_req: AdminRequest, res, next) => {
  try {
    const enabled = await systemControlService.isMaintenanceModeEnabled();
    res.json({
      success: true,
      data: { enabled }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/system/maintenance-mode
 * Enable/disable maintenance mode
 */
router.post('/maintenance-mode', async (req: AdminRequest, res, next) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean'
      });
    }

    await systemControlService.setMaintenanceMode(enabled, req.admin!.id);
    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      data: { enabled }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/system/clear-cache
 * Clear all caches or specific cache type
 */
router.post('/clear-cache', async (req: AdminRequest, res, next) => {
  try {
    const { type } = req.body; // 'redis', 'memory', or undefined for all

    const result = await systemControlService.clearCache(type, req.admin!.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/system/restart
 * Schedule server restart
 */
router.post('/restart', async (req: AdminRequest, res, next) => {
  try {
    const delaySeconds = parseInt(req.body.delaySeconds || '10');

    if (isNaN(delaySeconds) || delaySeconds < 0) {
      return res.status(400).json({
        success: false,
        error: 'delaySeconds must be a non-negative number'
      });
    }

    await systemControlService.scheduleRestart(delaySeconds, req.admin!.id);
    res.json({
      success: true,
      message: `Server will restart in ${delaySeconds} seconds`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/system/logs
 * View system logs
 */
router.get('/logs', async (req: AdminRequest, res, next) => {
  try {
    const { lines = 100, level } = req.query;
    const logDir = join(process.cwd(), 'server', 'logs');
    
    try {
      const files = await readdir(logDir);
      const logFiles = files.filter(f => f.endsWith('.log'));
      
      // Read the most recent log file
      if (logFiles.length > 0) {
        const latestLog = logFiles.sort().reverse()[0];
        const logPath = join(logDir, latestLog);
        const content = await readFile(logPath, 'utf-8');
        const logLines = content.split('\n').filter(line => {
          if (level && !line.toLowerCase().includes(level.toLowerCase())) {
            return false;
          }
          return true;
        }).slice(-parseInt(lines as string));

        res.json({
          success: true,
          data: {
            file: latestLog,
            lines: logLines,
            totalLines: content.split('\n').length
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            file: null,
            lines: [],
            totalLines: 0,
            message: 'No log files found'
          }
        });
      }
    } catch (error: any) {
      // If log directory doesn't exist, return empty
      res.json({
        success: true,
        data: {
          file: null,
          lines: [],
          totalLines: 0,
          message: 'Log directory not found'
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/system/gc
 * Force garbage collection
 */
router.post('/gc', async (req: AdminRequest, res, next) => {
  try {
    await systemControlService.forceGarbageCollection(req.admin!.id);
    res.json({
      success: true,
      message: 'Garbage collection completed'
    });
  } catch (error) {
    next(error);
  }
});

export default router;




