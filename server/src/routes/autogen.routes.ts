/**
 * Autogen Routes
 * API endpoints for multi-agent conversations
 */

import express from 'express';
import { autogenService } from '../services/autogen.service.js';
import { logger } from '../utils/logger.js';
import { routeTimeout } from '../middleware/timeout.js';

const router = express.Router();

/**
 * Initialize Autogen service
 * POST /api/autogen/initialize
 */
router.post('/initialize', async (req, res, _next) => {
  try {
    await autogenService.initialize();
    res.json({
      success: true,
      message: 'Autogen service initialized',
    });
  } catch (error: unknown) {
    logger.error('Autogen initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize Autogen service',
      error: error.message,
    });
  }
});

/**
 * Register an agent
 * POST /api/autogen/agents
 */
router.post('/agents', async (req, res, _next) => {
  try {
    const { id, name, systemMessage, model, temperature, maxConsecutiveAutoReply, humanInputMode, codeExecution } = req.body;

    if (!id || !name || !systemMessage) {
      res.status(400).json({
        success: false,
        message: 'id, name, and systemMessage are required',
      });
      return;
    }

    const agent = autogenService.registerAgent({
      id,
      name,
      systemMessage,
      model,
      temperature,
      maxConsecutiveAutoReply,
      humanInputMode,
      codeExecution,
    });

    res.json({
      success: true,
      data: agent,
    });
  } catch (error: unknown) {
    logger.error('Failed to register agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register agent',
      error: error.message,
    });
  }
});

/**
 * Get agent by ID
 * GET /api/autogen/agents/:id
 */
router.get('/agents/:id', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const agent = autogenService.getAgent(id);

    if (!agent) {
      res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
      return;
    }

    res.json({
      success: true,
      data: agent,
    });
  } catch (error: unknown) {
    logger.error('Failed to get agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get agent',
      error: error.message,
    });
  }
});

/**
 * Initiate a conversation
 * POST /api/autogen/conversations
 * Note: Longer timeout (5 minutes) needed for multi-agent conversations
 */
router.post('/conversations', routeTimeout(300000), async (req: any, res, _next) => {
  try {
    const { conversationId, agents, initialMessage, config } = req.body;

    if (!conversationId || !agents || !initialMessage) {
      res.status(400).json({
        success: false,
        message: 'conversationId, agents, and initialMessage are required',
      });
      return;
    }

    // Get user context for LLM routing
    const userId = req.user?.id;
    const projectId = req.body.projectId;

    const result = await autogenService.initiateConversation(
      conversationId,
      agents,
      initialMessage,
      config || {},
      {
        userId,
        projectId
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Conversation initiation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Conversation initiation failed',
      error: error.message,
    });
  }
});

/**
 * Continue a conversation
 * POST /api/autogen/conversations/:id/continue
 * Note: Longer timeout (3 minutes) needed for agent conversations
 */
router.post('/conversations/:id/continue', routeTimeout(180000), async (req: any, res, _next) => {
  try {
    const { id } = req.params;
    const { message, config } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        message: 'message is required',
      });
      return;
    }

    // Get user context for LLM routing
    const userId = req.user?.id;
    const projectId = req.body.projectId;

    const result = await autogenService.continueConversation(
      id, 
      message, 
      config || {},
      {
        userId,
        projectId
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Conversation continuation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Conversation continuation failed',
      error: error.message,
    });
  }
});

/**
 * Get conversation history
 * GET /api/autogen/conversations/:id
 */
router.get('/conversations/:id', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const messages = autogenService.getConversation(id);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: unknown) {
    logger.error('Failed to get conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversation',
      error: error.message,
    });
  }
});

/**
 * List all conversations
 * GET /api/autogen/conversations
 */
router.get('/conversations', async (req, res, _next) => {
  try {
    const conversations = autogenService.listConversations();
    res.json({
      success: true,
      data: conversations,
    });
  } catch (error: unknown) {
    logger.error('Failed to list conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list conversations',
      error: error.message,
    });
  }
});

/**
 * Clear a conversation
 * DELETE /api/autogen/conversations/:id
 */
router.delete('/conversations/:id', async (req, res, _next) => {
  try {
    const { id } = req.params;
    autogenService.clearConversation(id);

    res.json({
      success: true,
      message: 'Conversation cleared',
    });
  } catch (error: unknown) {
    logger.error('Failed to clear conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear conversation',
      error: error.message,
    });
  }
});

/**
 * Create a two-agent conversation
 * POST /api/autogen/conversations/two-agent
 */
router.post('/conversations/two-agent', async (req, res, _next) => {
  try {
    const { userProxyId, assistantId, assistantSystemMessage, userProxyConfig } = req.body;

    if (!userProxyId || !assistantId || !assistantSystemMessage) {
      res.status(400).json({
        success: false,
        message: 'userProxyId, assistantId, and assistantSystemMessage are required',
      });
      return;
    }

    const { userProxy, assistant } = autogenService.createTwoAgentConversation(
      userProxyId,
      assistantId,
      assistantSystemMessage,
      userProxyConfig
    );

    res.json({
      success: true,
      data: { userProxy, assistant },
    });
  } catch (error: unknown) {
    logger.error('Failed to create two-agent conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create two-agent conversation',
      error: error.message,
    });
  }
});

export default router;
















