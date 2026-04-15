import express from 'express';
import { authenticateToken} from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { AppError } from '../middleware/errorHandler.js';
import { executeCommand, getTerminalInfo } from '../services/terminalService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/terminal/execute
 * Execute a command in sandboxed environment - protected by terminal_access feature flag
 */
router.post('/execute', checkFeatureAccess('terminal_access'), async (req: FeatureRequest, res, next) => {
  try {
    const { command, cwd, timeout, maxOutputSize } = req.body;
    const userId = req.user!.id;

    if (!command || typeof command !== 'string') {
      throw new AppError('Command is required', 400);
    }

    // Log command execution (for audit)
    logger.info(`[Terminal] User ${userId} executing command: ${command.substring(0, 100)}`);

    const result = await executeCommand(
      {
        command: command.trim(),
        cwd,
        timeout: timeout || 30000,
        maxOutputSize: maxOutputSize || 1024 * 1024, // 1MB
      },
      userId
    );

    res.json({
      success: result.success,
      data: {
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        executionTime: result.executionTime,
      },
    });
  } catch (error: unknown) {
    logger.error('[Terminal] Error executing command:', error);
    next(error);
  }
});

/**
 * GET /api/terminal/info
 * Get terminal environment information - protected by terminal_access feature flag
 */
router.get('/info', checkFeatureAccess('terminal_access'), async (_req: FeatureRequest, res, next) => {
  try {
    const info = await getTerminalInfo();

    res.json({
      success: true,
      data: info,
    });
  } catch (error: unknown) {
    logger.error('[Terminal] Error getting terminal info:', error);
    next(error);
  }
});

export default router;




