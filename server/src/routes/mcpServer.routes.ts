/**
 * MCP Server Management Routes
 * CRUD operations for MCP servers, including agent-created servers
 */

import express from 'express';
import { authenticateToken, denyGuests, AuthRequest } from '../middleware/auth.js';
import { MCPServer } from '../models/MCPServer.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { mcpService } from '../services/mcp.service.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/mcp-servers
 * List all MCP servers (user's servers + system servers)
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { source, status, projectId } = req.query;

    // Build query
    const query: any = {
      $or: [
        { source: 'system' }, // System servers available to all
        { 'metadata.createdBy': userId }, // User's servers
        { source: 'agent', 'metadata.createdFor': projectId }, // Agent-created servers for this project
      ],
    };

    if (status) {
      query.status = status;
    }
    if (source) {
      query.source = source;
    }

    const servers = await MCPServer.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: servers.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        status: s.status,
        source: s.source,
        tools: s.tools,
        config: {
          type: s.config.type,
          // Don't expose sensitive config details
        },
        metadata: s.metadata,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastUsed: s.lastUsed,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mcp-servers/:id
 * Get a specific MCP server
 */
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const server = await MCPServer.findOne({ id });

    if (!server) {
      throw new AppError('MCP server not found', 404);
    }

    // Check access: system servers or user's own servers
    if (server.source !== 'system' && server.metadata?.createdBy !== userId) {
      throw new AppError('Access denied', 403);
    }

    res.json({
      success: true,
      data: {
        id: server.id,
        name: server.name,
        description: server.description,
        status: server.status,
        source: server.source,
        tools: server.tools,
        config: {
          ...server.config,
          // Never expose the secret on read — redact it explicitly here since
          // this handler serializes the raw config object.
          ...(server.config?.apiKey ? { apiKey: '***' } : {}),
        },
        metadata: server.metadata,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
        lastUsed: server.lastUsed,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mcp-servers
 * Create a new MCP server (user or agent-created)
 */
router.post('/', denyGuests, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { name, description, config, tools, source = 'user', metadata } = req.body;

    if (!name || !config || !config.type) {
      throw new AppError('Name and config.type are required', 400);
    }

    // Generate unique ID
    const id =
      source === 'agent'
        ? `mcp-agent-${Date.now()}-${Math.random().toString(36).substring(7)}`
        : `mcp-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Discover tools if not provided
    let serverTools = tools || [];
    if (serverTools.length === 0 && config.type === 'e2b') {
      // E2B servers have predefined tools
      serverTools = ['write_file', 'read_file', 'list_directory', 'run_shell_command'];
    }

    const server = new MCPServer({
      id,
      name,
      description: description || '',
      status: 'active',
      source: source === 'agent' ? 'agent' : 'user',
      tools: serverTools,
      config: {
        type: config.type,
        endpoint: config.endpoint,
        command: config.command,
        args: config.args,
        headers: config.headers,
        apiKey: config.apiKey, // Should be encrypted in production
      },
      metadata: {
        createdBy: userId,
        createdFor: metadata?.createdFor || metadata?.projectId,
        tags: metadata?.tags || [],
        notes: metadata?.notes,
      },
    });

    await server.save();

    logger.info(`Created MCP server: ${id} by ${userId} (source: ${source})`);

    res.status(201).json({
      success: true,
      data: {
        id: server.id,
        name: server.name,
        description: server.description,
        status: server.status,
        source: server.source,
        tools: server.tools,
        config: {
          type: server.config.type,
        },
        metadata: server.metadata,
        createdAt: server.createdAt,
      },
    });
  } catch (error: unknown) {
    if (error.code === 11000) {
      // Duplicate key error
      throw new AppError('MCP server with this ID already exists', 409);
    }
    next(error);
  }
});

/**
 * PUT /api/mcp-servers/:id
 * Update an MCP server
 */
router.put('/:id', denyGuests, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, description, status, tools, config, metadata } = req.body;

    const server = await MCPServer.findOne({ id });

    if (!server) {
      throw new AppError('MCP server not found', 404);
    }

    // Check access: only user's own servers or system servers (admin only)
    if (server.source !== 'system' && server.metadata?.createdBy !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Update fields
    if (name !== undefined) server.name = name;
    if (description !== undefined) server.description = description;
    if (status !== undefined) server.status = status;
    if (tools !== undefined) server.tools = tools;
    if (config !== undefined) {
      server.config = {
        ...server.config,
        ...config,
      };
    }
    if (metadata !== undefined) {
      server.metadata = {
        ...server.metadata,
        ...metadata,
      };
    }

    server.updatedAt = new Date();
    await server.save();

    logger.info(`Updated MCP server: ${id} by ${userId}`);

    res.json({
      success: true,
      data: {
        id: server.id,
        name: server.name,
        description: server.description,
        status: server.status,
        source: server.source,
        tools: server.tools,
        config: {
          type: server.config.type,
        },
        metadata: server.metadata,
        updatedAt: server.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/mcp-servers/:id
 * Delete an MCP server
 */
router.delete('/:id', denyGuests, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const server = await MCPServer.findOne({ id });

    if (!server) {
      throw new AppError('MCP server not found', 404);
    }

    // Check access: only user's own servers or agent-created servers
    // System servers cannot be deleted
    if (server.source === 'system') {
      throw new AppError('System MCP servers cannot be deleted', 403);
    }

    if (server.metadata?.createdBy !== userId && server.source !== 'agent') {
      throw new AppError('Access denied', 403);
    }

    await MCPServer.deleteOne({ id });

    logger.info(`Deleted MCP server: ${id} by ${userId}`);

    res.json({
      success: true,
      message: 'MCP server deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mcp-servers/:id/test
 * Test an MCP server connection
 */
router.post('/:id/test', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    let server = await MCPServer.findOne({ id });

    // For system servers, check health even if not in DB
    if (!server && id.startsWith('mcp-sys-')) {
      // System servers are available to all users
      try {
        const health = await mcpService.checkServerHealth(id);
        const tools = await mcpService.getAllTools([
          {
            id: id,
            name: id,
            description: 'System MCP server',
            status: health.status === 'healthy' ? 'active' : 'inactive',
            source: 'system',
            tools: [],
          },
        ]);

        const serverTools = tools.get(id) || [];

        return res.json({
          success: true,
          data: {
            serverId: id,
            status: health.status === 'healthy' ? 'connected' : 'error',
            tools: serverTools,
            message:
              health.status === 'healthy'
                ? 'Server connection successful'
                : health.message || 'Server connection failed',
          },
        });
      } catch (error: unknown) {
        return res.json({
          success: false,
          data: {
            serverId: id,
            status: 'error',
            message: error.message || 'Failed to connect to server',
          },
        });
      }
    }

    if (!server) {
      throw new AppError('MCP server not found', 404);
    }

    // Check access
    if (server.source !== 'system' && server.metadata?.createdBy !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Update last used timestamp
    server.lastUsed = new Date();
    await server.save();

    // Try to discover tools
    try {
      const tools = await mcpService.getAllTools([
        {
          id: server.id,
          name: server.name,
          description: server.description,
          status: server.status,
          source: server.source,
          tools: server.tools,
        },
      ]);

      const serverTools = tools.get(server.id) || [];

      res.json({
        success: true,
        data: {
          serverId: server.id,
          status: 'connected',
          tools: serverTools,
          message: 'Server connection successful',
        },
      });
    } catch (error: unknown) {
      res.json({
        success: false,
        data: {
          serverId: server.id,
          status: 'error',
          message: error.message || 'Failed to connect to server',
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mcp-servers/:id/health
 * Get health status of an MCP server
 */
router.get('/:id/health', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const server = await MCPServer.findOne({ id });

    if (!server) {
      // For system servers, check health even if not in DB
      if (id.startsWith('mcp-sys-')) {
        const health = await mcpService.checkServerHealth(id);
        return res.json({
          success: true,
          data: health,
        });
      }
      throw new AppError('MCP server not found', 404);
    }

    // Check access
    if (server.source !== 'system' && server.metadata?.createdBy !== userId) {
      throw new AppError('Access denied', 403);
    }

    const health = await mcpService.checkServerHealth(id);
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mcp-servers/health/all
 * Get health status of all system MCP servers
 */
router.get('/health/all', async (req: AuthRequest, res, next) => {
  try {
    const healthStatuses = await mcpService.checkAllSystemServersHealth();
    res.json({
      success: true,
      data: healthStatuses,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
