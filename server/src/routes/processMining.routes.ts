/**
 * Process Mining Routes
 * API endpoints for process discovery and workflow analysis
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { processMiningService } from '../services/processMining.service.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/process-mining/discover
 * Discover workflows from project tasks
 */
router.post('/discover', async (req: AdminRequest, res, next) => {
  try {
    const { agentRole, projectId } = req.body;

    if (!agentRole) {
      throw new AppError('Agent role is required', 400);
    }

    let tasks: any[] = [];

    if (projectId) {
      // Get tasks from specific project
      const project = await Project.findById(projectId);
      if (!project) {
        throw new AppError('Project not found', 404);
      }
      tasks = project.tasks || [];
    } else {
      // Get tasks from all projects
      const projects = await Project.find({});
      tasks = projects.flatMap(p => p.tasks || []);
    }

    const result = await processMiningService.discoverWorkflows(agentRole, tasks, projectId);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/process-mining/suggest-improvements
 * Suggest process improvements from patterns
 */
router.post('/suggest-improvements', async (req: AdminRequest, res, next) => {
  try {
    const { patterns, bottlenecks } = req.body;

    if (!patterns || !Array.isArray(patterns)) {
      throw new AppError('Patterns array is required', 400);
    }
    if (!bottlenecks || !Array.isArray(bottlenecks)) {
      throw new AppError('Bottlenecks array is required', 400);
    }

    const suggestions = await processMiningService.suggestImprovements(patterns, bottlenecks);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















