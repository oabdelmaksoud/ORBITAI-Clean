/**
 * CrewAI Routes
 * API endpoints for multi-agent orchestration
 */

import express from 'express';
import { crewAIService } from '../services/crewai.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize CrewAI service
 * POST /api/crewai/initialize
 */
router.post('/initialize', async (req, res, _next) => {
  try {
    await crewAIService.initialize();
    res.json({
      success: true,
      message: 'CrewAI service initialized',
    });
  } catch (error: any) {
    logger.error('CrewAI initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize CrewAI service',
      error: error.message,
    });
  }
});

/**
 * Create an agent
 * POST /api/crewai/agents
 */
router.post('/agents', async (req, res, _next) => {
  try {
    const { id, role, goal, backstory, tools, model, temperature } = req.body;

    if (!id || !role || !goal) {
      res.status(400).json({
        success: false,
        message: 'id, role, and goal are required',
      });
      return;
    }

    const agent = crewAIService.createAgent({
      id,
      role,
      goal,
      backstory,
      tools,
      model,
      temperature,
    });

    res.json({
      success: true,
      data: agent,
    });
  } catch (error: any) {
    logger.error('Failed to create agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create agent',
      error: error.message,
    });
  }
});

/**
 * Get agent by ID
 * GET /api/crewai/agents/:id
 */
router.get('/agents/:id', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const agent = crewAIService.getAgent(id);

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
  } catch (error: any) {
    logger.error('Failed to get agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get agent',
      error: error.message,
    });
  }
});

/**
 * List all agents
 * GET /api/crewai/agents
 */
router.get('/agents', async (req, res, _next) => {
  try {
    const agents = crewAIService.listAgents();
    res.json({
      success: true,
      data: agents,
    });
  } catch (error: any) {
    logger.error('Failed to list agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list agents',
      error: error.message,
    });
  }
});

/**
 * Create a crew
 * POST /api/crewai/crews
 */
router.post('/crews', async (req, res, _next) => {
  try {
    const { id, name, agents, tasks, verbose } = req.body;

    if (!id || !name || !agents || !tasks) {
      res.status(400).json({
        success: false,
        message: 'id, name, agents, and tasks are required',
      });
      return;
    }

    const crew = crewAIService.createCrew({
      id,
      name,
      agents,
      tasks,
      verbose,
    });

    res.json({
      success: true,
      data: crew,
    });
  } catch (error: any) {
    logger.error('Failed to create crew:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create crew',
      error: error.message,
    });
  }
});

/**
 * Get crew by ID
 * GET /api/crewai/crews/:id
 */
router.get('/crews/:id', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const crew = crewAIService.getCrew(id);

    if (!crew) {
      res.status(404).json({
        success: false,
        message: 'Crew not found',
      });
      return;
    }

    res.json({
      success: true,
      data: crew,
    });
  } catch (error: any) {
    logger.error('Failed to get crew:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get crew',
      error: error.message,
    });
  }
});

/**
 * List all crews
 * GET /api/crewai/crews
 */
router.get('/crews', async (req, res, _next) => {
  try {
    const crews = crewAIService.listCrews();
    res.json({
      success: true,
      data: crews,
    });
  } catch (error: any) {
    logger.error('Failed to list crews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list crews',
      error: error.message,
    });
  }
});

/**
 * Execute a crew
 * POST /api/crewai/crews/:id/execute
 */
router.post('/crews/:id/execute', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const { inputs } = req.body;

    const result = await crewAIService.executeCrew(id, inputs || {});

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    logger.error('Crew execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'Crew execution failed',
      error: error.message,
    });
  }
});

/**
 * Create a simple crew
 * POST /api/crewai/crews/simple
 */
router.post('/crews/simple', async (req, res, _next) => {
  try {
    const { crewId, crewName, agents, taskDescriptions } = req.body;

    if (!crewId || !crewName || !agents || !taskDescriptions) {
      res.status(400).json({
        success: false,
        message: 'crewId, crewName, agents, and taskDescriptions are required',
      });
      return;
    }

    const crew = crewAIService.createSimpleCrew(crewId, crewName, agents, taskDescriptions);

    res.json({
      success: true,
      data: crew,
    });
  } catch (error: any) {
    logger.error('Failed to create simple crew:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create simple crew',
      error: error.message,
    });
  }
});

export default router;
















