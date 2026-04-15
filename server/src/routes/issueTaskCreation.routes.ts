/**
 * Issue Task Creation Routes
 * API endpoints for creating tasks when agents detect issues
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { issueTaskCreationService, DetectedIssue } from '../services/issueTaskCreation.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticateToken);

/**
 * POST /api/issues/create-task
 * Create a task for a detected issue
 */
router.post('/create-task', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { projectId, issue } = req.body;

    if (!projectId) {
      throw new AppError('Project ID is required', 400);
    }

    if (!issue) {
      throw new AppError('Issue details are required', 400);
    }

    const result = await issueTaskCreationService.createTaskForIssue(
      projectId,
      issue as DetectedIssue,
      userId
    );

    res.json({
      success: result.created,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/issues/create-tasks
 * Create multiple tasks for detected issues
 */
router.post('/create-tasks', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { projectId, issues } = req.body;

    if (!projectId) {
      throw new AppError('Project ID is required', 400);
    }

    if (!issues || !Array.isArray(issues)) {
      throw new AppError('Issues array is required', 400);
    }

    const results = await issueTaskCreationService.createTasksForIssues(
      projectId,
      issues as DetectedIssue[],
      userId
    );

    res.json({
      success: true,
      data: {
        results,
        created: results.filter(r => r.created).length,
        total: results.length
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;



