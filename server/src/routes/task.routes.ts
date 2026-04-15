import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { updateTaskSchema } from '../validators/task.validator.js';
import { autoCompletionService } from '../services/autoCompletion.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken);

// Update task status
router.patch('/:projectId/:taskId', validate(updateTaskSchema), async (req: AuthRequest, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const updates = req.body;

    const project = await Project.findOne({
      _id: projectId,
      userId: req.user!.id
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const taskIndex = project.tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex === -1) {
      throw new AppError('Task not found', 404);
    }

    project.tasks[taskIndex] = { ...project.tasks[taskIndex], ...updates };
    project.lastModified = new Date();
    await project.save();

    // Check if task was just completed and if all tasks are now done
    const taskWasCompleted = (updates.status === 'Completed' || updates.status === 'completed') &&
                            (project.tasks[taskIndex].status !== 'Completed' && project.tasks[taskIndex].status !== 'completed');

    if (taskWasCompleted) {
      // Check if all tasks are completed and auto-complete project
      try {
        await autoCompletionService.checkAndCompleteProject(projectId);
      } catch (completionError: any) {
        // Log but don't fail the task update
        logger.warn(`Auto-completion check failed after task completion: ${completionError.message}`);
      }
    }

    res.json({
      success: true,
      data: { task: project.tasks[taskIndex] }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;

