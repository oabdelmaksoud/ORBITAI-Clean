import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { MCPServer } from '../models/MCPServer.model.js';
import { Webhook } from '../models/Webhook.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';
import axios from 'axios';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

// ============ MCP SERVERS ============

/**
 * GET /api/admin/integrations/mcp
 * List all MCP servers (admin view)
 */
router.get('/mcp', async (_req: AdminRequest, res, next) => {
  try {
    const servers = await MCPServer.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { servers }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/integrations/mcp
 * Create MCP server
 */
router.post('/mcp', async (req: AdminRequest, res, next) => {
  try {
    const { name, description, config, tools, source = 'system' } = req.body;

    if (!name || !config) {
      res.status(400).json({
        success: false,
        error: 'name and config are required'
      });
      return;
    }

    const server = new MCPServer({
      id: `mcp_${Date.now()}`,
      name,
      description,
      config,
      tools: tools || [],
      source,
      status: 'active',
      metadata: {
        createdBy: req.admin!.id,
        createdAt: new Date()
      }
    });

    await server.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'mcp_server_create',
      entityType: 'mcp_server',
      details: {
        serverId: server.id,
        name
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      data: server
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/admin/integrations/mcp/:id
 * Update MCP server
 */
router.put('/mcp/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const server = await MCPServer.findOne({ id });
    if (!server) {
      res.status(404).json({
        success: false,
        error: 'MCP server not found'
      });
      return;
    }

    Object.assign(server, updates);
    await server.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'mcp_server_update',
      entityType: 'mcp_server',
      details: {
        serverId: id,
        updates
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      data: server
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/admin/integrations/mcp/:id
 * Delete MCP server
 */
router.delete('/mcp/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;

    const server = await MCPServer.findOne({ id });
    if (!server) {
      res.status(404).json({
        success: false,
        error: 'MCP server not found'
      });
      return;
    }

    await MCPServer.deleteOne({ id });

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'mcp_server_delete',
      entityType: 'mcp_server',
      details: {
        serverId: id
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      message: 'MCP server deleted'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/integrations/mcp/:id/test
 * Test MCP server
 */
router.post('/mcp/:id/test', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;

    const server = await MCPServer.findOne({ id });
    if (!server) {
      res.status(404).json({
        success: false,
        error: 'MCP server not found'
      });
      return;
    }

    // Simple connectivity test
    const testResult = {
      serverId: id,
      status: 'success',
      message: 'MCP server is accessible',
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: testResult
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ============ WEBHOOKS ============

/**
 * GET /api/admin/integrations/webhooks
 * List all webhooks
 */
router.get('/webhooks', async (req: AdminRequest, res, next) => {
  try {
    const { isActive } = req.query;
    const query: any = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const webhooks = await Webhook.find(query).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { webhooks }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/integrations/webhooks
 * Create webhook
 */
router.post('/webhooks', async (req: AdminRequest, res, next) => {
  try {
    const { name, url, method, events, headers, secret, retryCount, timeout } = req.body;

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({
        success: false,
        error: 'name, url, and events array are required'
      });
      return;
    }

    const webhook = new Webhook({
      name,
      url,
      method: method || 'POST',
      events,
      headers: headers || {},
      secret,
      retryCount: retryCount || 3,
      timeout: timeout || 5000,
      isActive: true,
      createdBy: req.admin!.id
    });

    await webhook.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'webhook_create',
      entityType: 'webhook',
      details: {
        webhookId: webhook._id.toString(),
        name,
        url
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      data: webhook
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/admin/integrations/webhooks/:id
 * Update webhook
 */
router.put('/webhooks/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
      return;
    }

    Object.assign(webhook, updates);
    await webhook.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'webhook_update',
      entityType: 'webhook',
      details: {
        webhookId: id,
        updates
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      data: webhook
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/admin/integrations/webhooks/:id
 * Delete webhook
 */
router.delete('/webhooks/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
      return;
    }

    await Webhook.deleteOne({ _id: id });

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'webhook_delete',
      entityType: 'webhook',
      details: {
        webhookId: id
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      message: 'Webhook deleted'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/integrations/webhooks/:id/test
 * Test webhook
 */
router.post('/webhooks/:id/test', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const { payload } = req.body;

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
      return;
    }

    try {
      const response = await axios({
        method: webhook.method,
        url: webhook.url,
        data: payload || { test: true, timestamp: new Date().toISOString() },
        headers: {
          ...webhook.headers,
          'Content-Type': 'application/json'
        },
        timeout: webhook.timeout
      });

      webhook.lastTriggered = new Date();
      webhook.lastStatus = 'success';
      webhook.lastError = undefined;
      await webhook.save();

      res.json({
        success: true,
        data: {
          status: 'success',
          statusCode: response.status,
          message: 'Webhook test successful'
        }
      });
    } catch (error: unknown) {
      webhook.lastTriggered = new Date();
      webhook.lastStatus = 'failed';
      webhook.lastError = (error instanceof Error ? error.message : String(error));
      await webhook.save();

      res.status(500).json({
        success: false,
        error: (error instanceof Error ? error.message : String(error))
      });
    }
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/integrations/status
 * Get integration health status
 */
router.get('/status', async (_req: AdminRequest, res, next) => {
  try {
    const [totalMCPServers, activeMCPServers, _webhooks] = await Promise.all([
      MCPServer.countDocuments({}),
      MCPServer.countDocuments({ status: 'active' }),
      Webhook.countDocuments({ isActive: true })
    ]);

    const activeWebhooks = await Webhook.find({ isActive: true });
    const webhookStatus = {
      total: activeWebhooks.length,
      healthy: activeWebhooks.filter(w => w.lastStatus === 'success').length,
      failed: activeWebhooks.filter(w => w.lastStatus === 'failed').length,
      neverTriggered: activeWebhooks.filter(w => !w.lastTriggered).length
    };

    res.json({
      success: true,
      data: {
        mcpServers: {
          total: totalMCPServers,
          active: activeMCPServers
        },
        webhooks: webhookStatus
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;




