/**
 * Agent Discovery Routes
 * Endpoints for discovering and managing agents across projects
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { agentDiscovery } from '../services/agentDiscovery.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/agents/available
 * Get all available agents for reuse across projects (public for authenticated users)
 * Note: This route is registered at /api/agents, so the full path is /api/agents/available
 */
router.get('/available', authenticateToken, async (_req: AuthRequest, res, next) => {
  try {
    const agents = await agentDiscovery.getAllAvailableAgents();

    res.json({
      success: true,
      data: { agents }
    });
  } catch (error: unknown) {
    logger.error('Failed to get available agents:', error);
    next(error);
  }
});

/**
 * POST /api/admin/agents/discover
 * Manually trigger agent discovery from all projects (admin only)
 */
router.post('/discover', requireAdmin, async (_req: AdminRequest, res, next) => {
  try {
    const discoveredAgents = await agentDiscovery.discoverAgentsFromProjects();

    res.json({
      success: true,
      data: {
        discoveredAgents,
        count: discoveredAgents.length,
        message: `Discovered and created/updated ${discoveredAgents.length} agent profiles`
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to discover agents:', error);
    next(error);
  }
});

/**
 * POST /api/admin/agents/discover/project/:projectId
 * Discover agents from a specific project (admin only)
 */
router.post('/discover/project/:projectId', requireAdmin, async (req: AdminRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const discoveredAgents = await agentDiscovery.processProject(projectId);

    res.json({
      success: true,
      data: {
        projectId,
        discoveredAgents,
        count: discoveredAgents.length
      }
    });
  } catch (error: unknown) {
    logger.error(`Failed to discover agents from project ${req.params.projectId}:`, error);
    next(error);
  }
});

export default router;

