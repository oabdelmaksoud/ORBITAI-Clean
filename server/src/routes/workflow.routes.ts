/**
 * Workflow Engine Routes
 * API endpoints for BPMN workflow management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { workflowEngineService } from '../services/workflowEngine.service.js';
import { Workflow } from '../models/Workflow.model.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/workflows
 * List all workflows
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const { status, category, search } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      filter.$text = { $search: search as string };
    }

    const workflows = await Workflow.find(filter)
      .sort({ 'statistics.timesExecuted': -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: workflows
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/workflows/:id
 * Get specific workflow
 */
router.get('/:id', async (req: AdminRequest, res, next) => {
  try {
    const workflow = await Workflow.findOne({ id: req.params.id });
    
    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    res.json({
      success: true,
      data: workflow
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/workflows
 * Create new workflow
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const { name, description, bpmnDefinition } = req.body;

    if (!name || !description || !bpmnDefinition) {
      throw new AppError('Name, description, and bpmnDefinition are required', 400);
    }

    const workflow = await workflowEngineService.createWorkflow(
      name,
      description,
      bpmnDefinition,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/admin/workflows/:id
 * Update workflow
 */
router.put('/:id', async (req: AdminRequest, res, next) => {
  try {
    const workflow = await Workflow.findOne({ id: req.params.id });
    
    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }

    Object.assign(workflow, req.body);
    workflow.updatedBy = req.user!.id;
    workflow.version += 1;

    await workflow.save();

    res.json({
      success: true,
      data: workflow
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/workflows/:id/execute
 * Execute workflow
 */
router.post('/:id/execute', async (req: AdminRequest, res, next) => {
  try {
    const { variables, context } = req.body;

    const execution = await workflowEngineService.executeWorkflow(
      req.params.id,
      variables || {},
      context
    );

    res.json({
      success: true,
      data: execution
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/workflows/:id/executions
 * Get workflow executions
 */
router.get('/:id/executions', async (req: AdminRequest, res, next) => {
  try {
    const allExecutions = workflowEngineService.getAllExecutions();
    const workflowExecutions = allExecutions.filter(e => e.workflowId === req.params.id);

    res.json({
      success: true,
      data: workflowExecutions
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/workflows/:id/export/bpmn
 * Export workflow as BPMN XML
 */
router.get('/:id/export/bpmn', async (req: AdminRequest, res, next) => {
  try {
    const bpmnXml = await workflowEngineService.exportToBPMN(req.params.id);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="workflow-${req.params.id}.bpmn"`);
    res.send(bpmnXml);
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















