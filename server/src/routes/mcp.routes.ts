/**
 * MCP Routes - API endpoints for MCP tool discovery and execution
 */

import express from 'express';
import { mcpService } from '../services/mcp.service.js';
import { vectorSearchService } from '../services/vectorSearch.service.js';
import { logger } from '../utils/logger.js';
// MCPServer type - originally from shared types
type MCPServer = any;

const router = express.Router();

/**
 * Discover MCP tools from servers
 * POST /api/mcp/discover
 */
router.post('/discover', async (req, res, _next) => {
  try {
    const { servers } = req.body;

    if (!servers || !Array.isArray(servers)) {
      res.status(400).json({
        success: false,
        message: 'servers array is required',
      });
      return;
    }

    logger.info(`Discovering MCP tools from ${servers.length} servers`);

    const allTools = await mcpService.getAllTools(servers as MCPServer[]);

    // Convert Map to Record for JSON serialization
    const toolsByServer: Record<string, any[]> = {};
    for (const [serverId, tools] of allTools.entries()) {
      toolsByServer[serverId] = tools;
    }

    res.json({
      success: true,
      data: toolsByServer,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('MCP tool discovery failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to discover MCP tools',
      error: {
        message: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Call an MCP tool
 * POST /api/mcp/call
 */
router.post('/call', async (req, res, _next) => {
  try {
    const { serverId, toolName, args } = req.body;

    if (!serverId || !toolName) {
      res.status(400).json({
        success: false,
        message: 'serverId and toolName are required',
      });
      return;
    }

    logger.info(`Calling MCP tool: ${toolName} on server: ${serverId}`);

    const result = await mcpService.callTool(serverId, toolName, args || {});

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('MCP tool call failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to call MCP tool',
      error: {
        message: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Initialize vector search with project artifacts
 * POST /api/mcp/vector-search/initialize
 */
router.post('/vector-search/initialize', async (req, res, _next) => {
  try {
    const { artifacts } = req.body;

    if (!artifacts || !Array.isArray(artifacts)) {
      res.status(400).json({
        success: false,
        message: 'artifacts array is required',
      });
      return;
    }

    logger.info(`Initializing vector search with ${artifacts.length} artifacts`);

    // Initialize vector search service
    await vectorSearchService.initialize();

    // Add each artifact to the vector search index
    for (const artifact of artifacts) {
      if (artifact.id && artifact.content) {
        await vectorSearchService.addDocument({
          id: artifact.id,
          content: artifact.content,
          metadata: {
            type: artifact.type || 'unknown',
            title: artifact.title || artifact.id,
            projectId: artifact.projectId || 'unknown',
          },
        });
      }
    }

    res.json({
      success: true,
      message: `Vector search initialized with ${artifacts.length} artifacts`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Vector search initialization failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to initialize vector search',
      error: {
        message: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Vector search
 * POST /api/mcp/vector-search
 */
router.post('/vector-search', async (req, res, _next) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'query is required',
      });
      return;
    }

    logger.info(`Performing vector search for: ${query.substring(0, 50)}...`);

    const results = await vectorSearchService.vectorSearch(query, limit);

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Vector search failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to perform vector search',
      error: {
        message: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Recall context from vector search
 * POST /api/mcp/vector-search/recall-context
 */
router.post('/vector-search/recall-context', async (req, res, _next) => {
  try {
    const { query, limit = 3 } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'query is required',
      });
      return;
    }

    logger.info(`Recalling context for: ${query.substring(0, 50)}...`);

    const context = await vectorSearchService.recallContext(query, limit);

    res.json({
      success: true,
      data: context,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Context recall failed:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to recall context',
      error: {
        message: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
