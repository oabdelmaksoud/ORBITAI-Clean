/**
 * Dynamic Tooling Routes
 * API endpoints for runtime tool discovery and management
 */

import { Router, Request, Response } from 'express';
import { dynamicToolingService, ToolCategory, ToolMatchCriteria } from '../services/dynamicTooling.service.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * @swagger
 * /api/tools:
 *   get:
 *     summary: Get all registered tools
 *     tags: [Dynamic Tooling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: capability
 *         schema:
 *           type: string
 *         description: Filter by capability
 *     responses:
 *       200:
 *         description: List of tools
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { category, capability, tag } = req.query;
    
    const criteria: ToolMatchCriteria = {};
    
    if (category) {
      criteria.categories = [category as ToolCategory];
    }
    if (capability) {
      criteria.capabilities = [capability as string];
    }
    if (tag) {
      criteria.tags = [tag as string];
    }

    const tools = Object.keys(criteria).length > 0
      ? dynamicToolingService.findTools(criteria)
      : dynamicToolingService.getAllTools();

    res.json({
      success: true,
      count: tools.length,
      tools
    });
  } catch (error: unknown) {
    logger.error('Get tools error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tools'
    });
  }
});

/**
 * @swagger
 * /api/tools/discover:
 *   post:
 *     summary: Discover new tools from all sources
 *     tags: [Dynamic Tooling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Discovered tools
 */
router.post('/discover', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const discoveredTools = await dynamicToolingService.discoverTools();
    
    res.json({
      success: true,
      discovered: discoveredTools.length,
      tools: discoveredTools
    });
  } catch (error: unknown) {
    logger.error('Discover tools error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to discover tools'
    });
  }
});

/**
 * @swagger
 * /api/tools/{toolId}:
 *   get:
 *     summary: Get a specific tool by ID
 *     tags: [Dynamic Tooling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: toolId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tool details
 *       404:
 *         description: Tool not found
 */
router.get('/:toolId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { toolId } = req.params;
    const tool = dynamicToolingService.getTool(toolId);

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }

    res.json({
      success: true,
      tool
    });
  } catch (error: unknown) {
    logger.error('Get tool error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tool'
    });
  }
});

/**
 * @swagger
 * /api/tools/category/{category}:
 *   get:
 *     summary: Get tools by category
 *     tags: [Dynamic Tooling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [code_execution, file_management, web_search, data_processing, api_integration, image_generation, text_analysis, database, communication, utility, custom]
 *     responses:
 *       200:
 *         description: Tools in category
 */
router.get('/category/:category', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const tools = dynamicToolingService.getToolsByCategory(category as ToolCategory);

    res.json({
      success: true,
      category,
      count: tools.length,
      tools
    });
  } catch (error: unknown) {
    logger.error('Get tools by category error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tools'
    });
  }
});

/**
 * @swagger
 * /api/tools/statistics:
 *   get:
 *     summary: Get tool statistics
 *     tags: [Dynamic Tooling]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tool statistics
 */
router.get('/stats/overview', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const statistics = dynamicToolingService.getStatistics();

    res.json({
      success: true,
      statistics
    });
  } catch (error: unknown) {
    logger.error('Get tool statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
    });
  }
});

/**
 * @swagger
 * /api/tools/search:
 *   post:
 *     summary: Search for tools matching criteria
 *     tags: [Dynamic Tooling]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Matching tools
 */
router.post('/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const criteria: ToolMatchCriteria = req.body;
    const tools = dynamicToolingService.findTools(criteria);

    res.json({
      success: true,
      count: tools.length,
      tools
    });
  } catch (error: unknown) {
    logger.error('Search tools error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search tools'
    });
  }
});

export default router;




