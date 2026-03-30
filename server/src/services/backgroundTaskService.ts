/**
 * Background Task Service
 * Handles task execution in the background when browser is closed
 * Auto-stops after 15 minutes to save budget
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import { geminiService } from './gemini.service.js';
import { evaluationService } from './evaluation.service.js';
import { usageTracker } from './llm/UsageTracker.js';
import { llmRouter } from './llm/LLMRouter.js';

interface BackgroundTask {
  id: string;
  projectId: string;
  userId: string;
  taskId: string;
  agent: any;
  task: any;
  projectContext: string;
  artifacts: any[];
  useInternet: boolean;
  mcpServers: any[];
  standards: string[];
  startedAt: number;
  timeoutId?: NodeJS.Timeout;
}

class BackgroundTaskService {
  private activeTasks: Map<string, BackgroundTask> = new Map();
  private readonly MAX_BACKGROUND_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

  /**
   * Start a background task execution
   * Task will continue running even if browser closes
   * Auto-stops after 15 minutes
   */
  async startBackgroundTask(
    projectId: string,
    userId: string,
    taskId: string,
    agent: any,
    task: any,
    projectContext: string,
    artifacts: any[],
    useInternet: boolean,
    mcpServers: any[],
    standards: string[]
  ): Promise<string> {
    const backgroundTaskId = `bg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const backgroundTask: BackgroundTask = {
      id: backgroundTaskId,
      projectId,
      userId,
      taskId,
      agent,
      task,
      projectContext,
      artifacts,
      useInternet,
      mcpServers,
      standards,
      startedAt: Date.now()
    };

    // Set timeout to auto-stop after 15 minutes
    const timeoutId = setTimeout(async () => {
      logger.warn(`Background task ${backgroundTaskId} auto-stopped after 15 minutes to save budget`);
      await this.stopBackgroundTask(backgroundTaskId, 'timeout');
    }, this.MAX_BACKGROUND_DURATION);

    backgroundTask.timeoutId = timeoutId;
    this.activeTasks.set(backgroundTaskId, backgroundTask);

    // Start execution in background (don't await)
    this.executeBackgroundTask(backgroundTaskId).catch(error => {
      logger.error(`Background task ${backgroundTaskId} execution failed:`, error);
      this.activeTasks.delete(backgroundTaskId);
    });

    logger.info(`Started background task ${backgroundTaskId} for task ${taskId} (project: ${projectId})`);
    return backgroundTaskId;
  }

  /**
   * Execute a background task
   */
  private async executeBackgroundTask(backgroundTaskId: string): Promise<void> {
    const bgTask = this.activeTasks.get(backgroundTaskId);
    if (!bgTask) {
      logger.warn(`Background task ${backgroundTaskId} not found`);
      return;
    }

    try {
      // Load project from database
      const project = await Project.findOne({
        _id: bgTask.projectId,
        userId: bgTask.userId
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Update task status in database
      const taskIndex = project.tasks.findIndex((t: any) => t.id === bgTask.taskId);
      if (taskIndex === -1) {
        throw new Error('Task not found in project');
      }

      const task = project.tasks[taskIndex];
      
      // Update task status to IN_PROGRESS
      task.status = 'In Progress';
      task.startTime = Date.now();
      await project.save();

      logger.info(`[Background Task ${backgroundTaskId}] Executing task: ${task.title}`);

      // Build prompt (similar to frontend)
      const prompt = `You are ${bgTask.agent.name || bgTask.agent.role}. ${bgTask.agent.goal || ''}

TASK: ${task.title}
DESCRIPTION: ${task.description}

PROJECT CONTEXT:
${bgTask.projectContext}

${bgTask.artifacts.length > 0 ? `\nRELEVANT ARTIFACTS:\n${bgTask.artifacts.map((a: any) => `- ${a.title}: ${a.content.substring(0, 500)}...`).join('\n')}` : ''}

${bgTask.standards.length > 0 ? `\nQUALITY STANDARDS: ${bgTask.standards.join(', ')}` : ''}

Please complete this task and provide your output.`;

      // Execute task (simplified - without MCP tools for now)
      const startTime = Date.now();
      let result;
      let modelUsed = 'gemini-2.5-flash';
      let provider = 'gemini';

      try {
        result = await geminiService.generateContent(prompt, modelUsed, {
          systemInstruction: `You are ${bgTask.agent.name || bgTask.agent.role}. ${bgTask.agent.goal || ''}`
        });
      } catch (error: any) {
        logger.error(`[Background Task ${backgroundTaskId}] Task execution failed:`, error);
        throw error;
      }

      const latency = Date.now() - startTime;
      const output = result.text || '';

      // Track usage
      try {
        await usageTracker.trackUsage({
          userId: bgTask.userId,
          modelId: modelUsed,
          provider: provider as any,
          modelIdentifier: modelUsed,
          inputTokens: result.usage?.promptTokens || 0,
          outputTokens: result.usage?.candidatesTokens || 0,
          requestType: 'agent-task',
          context: 'background',
          success: true,
          latencyMs: latency,
          metadata: {
            agentRole: bgTask.agent.role,
            taskId: bgTask.taskId,
            backgroundTaskId: backgroundTaskId
          }
        });
      } catch (trackError) {
        logger.error(`[Background Task ${backgroundTaskId}] Failed to track usage:`, trackError);
      }

      // Perform evaluation
      let evaluation;
      try {
        evaluation = await evaluationService.evaluateTaskOutput({
          taskTitle: task.title,
          taskDescription: task.description,
          agentRole: bgTask.agent.role,
          output: output,
          standards: bgTask.standards || [],
          projectContext: bgTask.projectContext || ''
        });
      } catch (evalError: any) {
        logger.warn(`[Background Task ${backgroundTaskId}] Evaluation failed:`, evalError);
        evaluation = await evaluationService.quickEvaluate(output, task.description);
      }

      // Update task in database
      task.status = 'Completed';
      task.endTime = Date.now();
      task.progress = 100;
      if (task.logs) {
        task.logs.push(`[Background] Task completed at ${new Date().toISOString()}`);
        task.logs.push(`[Background] Evaluation score: ${evaluation.score}/100`);
      } else {
        task.logs = [
          `[Background] Task completed at ${new Date().toISOString()}`,
          `[Background] Evaluation score: ${evaluation.score}/100`
        ];
      }

      // Update budget (calculate cost)
      const cost = this.calculateCost(result.usage, modelUsed);
      if (project.budget) {
        project.budget.spent = (project.budget.spent || 0) + cost;
      }

      await project.save();

      logger.info(`[Background Task ${backgroundTaskId}] Task completed successfully. Score: ${evaluation.score}/100`);

      // Clean up
      this.activeTasks.delete(backgroundTaskId);
      if (bgTask.timeoutId) {
        clearTimeout(bgTask.timeoutId);
      }

    } catch (error: any) {
      logger.error(`[Background Task ${backgroundTaskId}] Execution error:`, error);

      // Update task status to failed
      try {
        const project = await Project.findOne({
          _id: bgTask.projectId,
          userId: bgTask.userId
        });

        if (project) {
          const taskIndex = project.tasks.findIndex((t: any) => t.id === bgTask.taskId);
          if (taskIndex !== -1) {
            project.tasks[taskIndex].status = 'Failed';
            if (project.tasks[taskIndex].logs) {
              project.tasks[taskIndex].logs.push(`[Background] Task failed: ${error.message}`);
            } else {
              project.tasks[taskIndex].logs = [`[Background] Task failed: ${error.message}`];
            }
            await project.save();
          }
        }
      } catch (updateError) {
        logger.error(`[Background Task ${backgroundTaskId}] Failed to update task status:`, updateError);
      }

      // Clean up
      this.activeTasks.delete(backgroundTaskId);
      if (bgTask.timeoutId) {
        clearTimeout(bgTask.timeoutId);
      }
    }
  }

  /**
   * Stop a background task
   */
  async stopBackgroundTask(backgroundTaskId: string, reason: 'user' | 'timeout' = 'user'): Promise<void> {
    const bgTask = this.activeTasks.get(backgroundTaskId);
    if (!bgTask) {
      logger.warn(`Background task ${backgroundTaskId} not found for stopping`);
      return;
    }

    // Clear timeout
    if (bgTask.timeoutId) {
      clearTimeout(bgTask.timeoutId);
    }

    // Update task status in database
    try {
      const project = await Project.findOne({
        _id: bgTask.projectId,
        userId: bgTask.userId
      });

      if (project) {
        const taskIndex = project.tasks.findIndex((t: any) => t.id === bgTask.taskId);
        if (taskIndex !== -1) {
          const task = project.tasks[taskIndex];
          if (task.status === 'In Progress') {
            task.status = reason === 'timeout' ? 'Paused' : 'Paused';
            if (task.logs) {
              task.logs.push(`[Background] Task ${reason === 'timeout' ? 'auto-stopped after 15 minutes to save budget' : 'stopped by user'}`);
            } else {
              task.logs = [`[Background] Task ${reason === 'timeout' ? 'auto-stopped after 15 minutes to save budget' : 'stopped by user'}`];
            }
            await project.save();
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to update task status when stopping background task:`, error);
    }

    this.activeTasks.delete(backgroundTaskId);
    logger.info(`Stopped background task ${backgroundTaskId} (reason: ${reason})`);
  }

  /**
   * Get active background tasks for a user/project
   */
  getActiveTasks(userId?: string, projectId?: string): BackgroundTask[] {
    const tasks = Array.from(this.activeTasks.values());
    
    if (userId) {
      return tasks.filter(t => t.userId === userId);
    }
    if (projectId) {
      return tasks.filter(t => t.projectId === projectId);
    }
    
    return tasks;
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(usage: any, model: string): number {
    if (!usage) return 0;

    // Simplified cost calculation (should match frontend pricing)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
      'gemini-3-pro-preview': { input: 1.25 / 1000000, output: 5.00 / 1000000 }
    };

    const modelPricing = pricing[model] || pricing['gemini-2.5-flash'];
    const inputCost = (usage.promptTokens || 0) * modelPricing.input;
    const outputCost = (usage.candidatesTokens || 0) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get remaining time for a background task
   */
  getRemainingTime(backgroundTaskId: string): number {
    const bgTask = this.activeTasks.get(backgroundTaskId);
    if (!bgTask) return 0;

    const elapsed = Date.now() - bgTask.startedAt;
    const remaining = this.MAX_BACKGROUND_DURATION - elapsed;
    return Math.max(0, remaining);
  }
}

export const backgroundTaskService = new BackgroundTaskService();
















