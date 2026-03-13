import { Task, TaskStatus, ProjectState, AgentRole } from '@orbitai/shared';
import { executeAgentTask } from './geminiService';
import { executeTaskWithQualityImprovement } from './qualityImprovement.service';

/**
 * Task Service - Handles task execution and management
 * Extracted from App.tsx to centralize task operations
 */
export const taskService = {
  /**
   * Execute a single task
   */
  async executeTask(
    task: Task,
    projectState: ProjectState,
    settings: any,
    onProgress: (taskId: string, progress: number) => void,
    onStatusUpdate: (taskId: string, status: TaskStatus) => void,
    onLog: (taskId: string, message: string) => void,
    onCostUpdate: (taskId: string, cost: number, tokenUsage: any, modelUsed: string) => void,
    abortController?: AbortController
  ): Promise<void> {
    if (task.status === TaskStatus.COMPLETED) {
      return;
    }

    onStatusUpdate(task.id, TaskStatus.IN_PROGRESS);
    onProgress(task.id, 0);

    try {
      const agent = projectState.agents.find(a => a.role === task.assignedTo || a.name === task.assignedTo);
      if (!agent) {
        throw new Error(`Agent not found for task: ${task.assignedTo}`);
      }

      onLog(task.id, `Starting execution: ${task.title}`);

      // Execute task with quality improvement if enabled
      const result = await executeTaskWithQualityImprovement(
        task,
        agent,
        projectState,
        {
          useInternet: projectState.useInternet,
          mcpServers: projectState.mcpServers,
          standards: projectState.selectedStandards,
          settings
        },
        abortController
      );

      if (result.success) {
        onStatusUpdate(task.id, TaskStatus.COMPLETED);
        onProgress(task.id, 100);
        onLog(task.id, `Task completed: ${result.summary || task.title}`);
        
        if (result.cost && result.tokenUsage) {
          onCostUpdate(task.id, result.cost, result.tokenUsage, result.modelUsed || 'unknown');
        }
      } else {
        onStatusUpdate(task.id, TaskStatus.FAILED);
        onLog(task.id, `Task failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        onStatusUpdate(task.id, TaskStatus.PAUSED);
        onLog(task.id, 'Task execution aborted');
      } else {
        onStatusUpdate(task.id, TaskStatus.FAILED);
        onLog(task.id, `Task execution failed: ${error.message || 'Unknown error'}`);
      }
    }
  },

  /**
   * Execute all pending tasks
   */
  async executeAllTasks(
    tasks: Task[],
    projectState: ProjectState,
    settings: any,
    callbacks: {
      onProgress: (taskId: string, progress: number) => void;
      onStatusUpdate: (taskId: string, status: TaskStatus) => void;
      onLog: (taskId: string, message: string) => void;
      onCostUpdate: (taskId: string, cost: number, tokenUsage: any, modelUsed: string) => void;
    },
    maxParallel: number = 5
  ): Promise<void> {
    const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING);
    
    // Execute tasks in batches
    for (let i = 0; i < pendingTasks.length; i += maxParallel) {
      const batch = pendingTasks.slice(i, i + maxParallel);
      await Promise.all(
        batch.map(task => 
          this.executeTask(task, projectState, settings, callbacks.onProgress, callbacks.onStatusUpdate, callbacks.onLog, callbacks.onCostUpdate)
        )
      );
    }
  }
};






