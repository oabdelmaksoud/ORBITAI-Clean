/**
 * LangGraph Routes
 * API endpoints for stateful agent workflows
 */

import express from 'express';
import { langgraphService } from '../services/langgraph.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize LangGraph service
 * POST /api/langgraph/initialize
 */
router.post('/initialize', async (req, res, _next) => {
  try {
    await langgraphService.initialize();
    res.json({
      success: true,
      message: 'LangGraph service initialized',
    });
  } catch (error: any) {
    logger.error('LangGraph initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize LangGraph service',
      error: error.message,
    });
  }
});

/**
 * Create a workflow
 * POST /api/langgraph/workflows
 */
router.post('/workflows', async (req, res, _next) => {
  try {
    const { id, name, nodes, edges, initialState } = req.body;

    if (!id || !name || !nodes || !edges) {
      res.status(400).json({
        success: false,
        message: 'id, name, nodes, and edges are required',
      });
      return;
    }

    const workflow = langgraphService.createWorkflow({
      id,
      name,
      nodes,
      edges,
      initialState,
    });

    res.json({
      success: true,
      message: 'Workflow created',
      data: { workflowId: id },
    });
  } catch (error: any) {
    logger.error('Failed to create workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workflow',
      error: error.message,
    });
  }
});

/**
 * Execute a workflow
 * POST /api/langgraph/workflows/:id/execute
 */
router.post('/workflows/:id/execute', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const { input, stream } = req.body;

    if (!input) {
      res.status(400).json({
        success: false,
        message: 'input is required',
      });
      return;
    }

    if (stream) {
      // Stream execution
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await langgraphService.executeWorkflow(id, input, { stream: true });
      
      if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
        for await (const state of result as AsyncGenerator<any, void, unknown>) {
          res.write(`data: ${JSON.stringify({ state })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } else {
      // Regular execution
      const result = await langgraphService.executeWorkflow(id, input);
      res.json({
        success: (result as any).success,
        data: result,
      });
    }
  } catch (error: any) {
    logger.error('Workflow execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'Workflow execution failed',
      error: error.message,
    });
  }
});

/**
 * Create an agent workflow
 * POST /api/langgraph/workflows/agent
 */
router.post('/workflows/agent', async (req, res, _next) => {
  try {
    const { workflowId, workflowName, systemPrompt, model } = req.body;

    if (!workflowId || !workflowName || !systemPrompt) {
      res.status(400).json({
        success: false,
        message: 'workflowId, workflowName, and systemPrompt are required',
      });
      return;
    }

    const workflow = await langgraphService.createAgentWorkflow(workflowId, workflowName, systemPrompt, model);

    res.json({
      success: true,
      message: 'Agent workflow created',
      data: { workflowId },
    });
  } catch (error: any) {
    logger.error('Failed to create agent workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create agent workflow',
      error: error.message,
    });
  }
});

/**
 * Create a multi-agent workflow
 * POST /api/langgraph/workflows/multi-agent
 */
router.post('/workflows/multi-agent', async (req, res, _next) => {
  try {
    const { workflowId, workflowName, agents, routingLogic } = req.body;

    if (!workflowId || !workflowName || !agents) {
      res.status(400).json({
        success: false,
        message: 'workflowId, workflowName, and agents are required',
      });
      return;
    }

    const workflow = langgraphService.createMultiAgentWorkflow(
      workflowId,
      workflowName,
      agents,
      routingLogic
    );

    res.json({
      success: true,
      message: 'Multi-agent workflow created',
      data: { workflowId },
    });
  } catch (error: any) {
    logger.error('Failed to create multi-agent workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create multi-agent workflow',
      error: error.message,
    });
  }
});

/**
 * Create a RAG workflow
 * POST /api/langgraph/workflows/rag
 */
router.post('/workflows/rag', async (req, res, _next) => {
  try {
    const { workflowId, workflowName, retrievalHandler, model } = req.body;

    if (!workflowId || !workflowName) {
      res.status(400).json({
        success: false,
        message: 'workflowId and workflowName are required',
      });
      return;
    }

    // Note: retrievalHandler would need to be a function reference
    // In a real implementation, you'd store handlers and reference them
    res.json({
      success: true,
      message: 'RAG workflow creation - retrieval handler must be implemented',
    });
  } catch (error: any) {
    logger.error('Failed to create RAG workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create RAG workflow',
      error: error.message,
    });
  }
});

/**
 * Get workflow by ID
 * GET /api/langgraph/workflows/:id
 */
router.get('/workflows/:id', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const workflow = langgraphService.getWorkflow(id);

    if (!workflow) {
      res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Workflow found',
    });
  } catch (error: any) {
    logger.error('Failed to get workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workflow',
      error: error.message,
    });
  }
});

/**
 * List all workflows
 * GET /api/langgraph/workflows
 */
router.get('/workflows', async (req, res, _next) => {
  try {
    const workflows = langgraphService.listWorkflows();
    res.json({
      success: true,
      data: workflows,
    });
  } catch (error: any) {
    logger.error('Failed to list workflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list workflows',
      error: error.message,
    });
  }
});

export default router;













