/**
 * Harness MCP Server routes
 *
 * Exposes read-only metadata about the OrbitAI MCP *server* (the new
 * `mcpServer.service.ts`). This router is auto-mounted by `routeLoader.ts`
 * at `/api/harness-mcp-server`.
 *
 * Mounting the router is always safe (it only reports status). The opt-in
 * `HARNESS_MCP_SERVER_ENABLED` flag controls whether the server is meant to be
 * *connected* to a transport — mounting is not the same as starting.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { logger } from '../utils/logger.js';
import {
  ORBIT_MCP_SERVER_INFO,
  HARNESS_CAPABILITIES,
  ORBIT_MCP_TOOL_NAMES,
  isHarnessMcpServerEnabled,
} from '../services/mcpServer.service.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/harness-mcp-server
 * Report OrbitAI MCP server identity, opt-in state, and exposed tool names.
 * Read-only; does not construct or connect the server.
 */
router.get('/', async (_req: AdminRequest, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        info: ORBIT_MCP_SERVER_INFO,
        enabled: isHarnessMcpServerEnabled(),
        tools: Object.values(ORBIT_MCP_TOOL_NAMES),
        capabilities: [...HARNESS_CAPABILITIES],
      },
    });
  } catch (error) {
    logger.error('Failed to report harness MCP server status', { error });
    next(error);
  }
});

export default router;
