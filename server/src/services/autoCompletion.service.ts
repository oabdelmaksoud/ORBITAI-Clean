/**
 * Auto Completion Service
 * Automatically detects when all tasks are completed and triggers project completion
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import { projectCompletionService } from './projectCompletion.service.js';

class AutoCompletionService {
  /**
   * Check if project should be auto-completed
   * Called after task status updates
   */
  async checkAndCompleteProject(projectId: string): Promise<boolean> {
    try {
      const project = await Project.findById(projectId);
      if (!project) {
        return false;
      }

      // Skip if already completed or deployed
      if (project.status === 'completed' || project.status === 'deployed') {
        return false;
      }

      // Check if all tasks are completed
      const tasks = project.tasks || [];
      if (tasks.length === 0) {
        return false; // No tasks to complete
      }

      const allTasksCompleted = tasks.every((task: any) => 
        task.status === 'Completed' || task.status === 'completed'
      );

      if (!allTasksCompleted) {
        return false; // Not all tasks are done
      }

      // Update status to in-progress if still draft
      if (project.status === 'draft') {
        await Project.findByIdAndUpdate(projectId, {
          status: 'in-progress',
          lastModified: new Date()
        });
      }

      logger.info(`All tasks completed for project ${projectId}. Auto-completing project...`);

      // Trigger project completion
      const completionResult = await projectCompletionService.completeProject(projectId, {
        runQualityGates: true,
        generateDocumentation: true,
        generatePackage: true,
        refineCode: true,
        generateTests: true,
        qualityThreshold: 85
      });

      // Update project status based on completion result
      await Project.findByIdAndUpdate(projectId, {
        status: completionResult.deploymentReady ? 'completed' : 'in-progress',
        completedAt: completionResult.success ? new Date() : undefined,
        lastModified: new Date()
      });

      logger.info(`Project ${projectId} auto-completed. Deployment ready: ${completionResult.deploymentReady}`);

      return completionResult.success;
    } catch (error: unknown) {
      logger.error(`Auto-completion check failed for project ${projectId}:`, error);
      return false;
    }
  }

  /**
   * Check if project has all tasks completed (without triggering completion)
   */
  async isProjectReadyForCompletion(projectId: string): Promise<boolean> {
    try {
      const project = await Project.findById(projectId).lean();
      if (!project) {
        return false;
      }

      const tasks = project.tasks || [];
      if (tasks.length === 0) {
        return false;
      }

      return tasks.every((task: any) => 
        task.status === 'Completed' || task.status === 'completed'
      );
    } catch (error: unknown) {
      logger.error(`Failed to check completion readiness for project ${projectId}:`, error);
      return false;
    }
  }
}

export const autoCompletionService = new AutoCompletionService();




