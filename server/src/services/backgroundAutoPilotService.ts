/**
 * Background AutoPilot Service
 * Handles HAND-OFF AI execution in the background when browser is closed
 * Auto-stops after 15 minutes to save budget
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import { geminiService } from './gemini.service.js';
import { evaluationService } from './evaluation.service.js';
import { usageTracker } from './llm/UsageTracker.js';

interface BackgroundAutoPilot {
  id: string;
  projectId: string;
  userId: string;
  projectContext: string;
  artifacts: any[];
  agents: any[];
  useInternet: boolean;
  mcpServers: any[];
  standards: string[];
  currentPhase: string;
  currentSprint: number;
  startedAt: number;
  timeoutId?: NodeJS.Timeout;
  isRunning: boolean;
  lastTaskExecutedAt?: number;
}

class BackgroundAutoPilotService {
  private activeAutoPilots: Map<string, BackgroundAutoPilot> = new Map();
  private readonly MAX_BACKGROUND_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly TASK_EXECUTION_DELAY = 2000; // 2 seconds between task checks

  /**
   * Start HAND-OFF AI in background
   * Will continue running even if browser closes
   * Auto-stops after 15 minutes
   */
  async startBackgroundAutoPilot(
    projectId: string,
    userId: string,
    projectContext: string,
    artifacts: any[],
    agents: any[],
    useInternet: boolean,
    mcpServers: any[],
    standards: string[],
    currentPhase: string,
    currentSprint: number
  ): Promise<string> {
    const autoPilotId = `ap-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const autoPilot: BackgroundAutoPilot = {
      id: autoPilotId,
      projectId,
      userId,
      projectContext,
      artifacts,
      agents,
      useInternet,
      mcpServers,
      standards,
      currentPhase,
      currentSprint,
      startedAt: Date.now(),
      isRunning: true
    };

    // Set timeout to auto-stop after 15 minutes
    const timeoutId = setTimeout(async () => {
      logger.warn(`Background AutoPilot ${autoPilotId} auto-stopped after 15 minutes to save budget`);
      await this.stopBackgroundAutoPilot(autoPilotId, 'timeout');
    }, this.MAX_BACKGROUND_DURATION);

    autoPilot.timeoutId = timeoutId;
    this.activeAutoPilots.set(autoPilotId, autoPilot);

    // Start execution in background (don't await)
    this.executeAutoPilot(autoPilotId).catch(error => {
      logger.error(`Background AutoPilot ${autoPilotId} execution failed:`, error);
      this.activeAutoPilots.delete(autoPilotId);
    });

    logger.info(`Started background AutoPilot ${autoPilotId} for project ${projectId}`);
    return autoPilotId;
  }

  /**
   * Execute HAND-OFF AI loop (similar to frontend runAutoPilot)
   */
  private async executeAutoPilot(autoPilotId: string): Promise<void> {
    const autoPilot = this.activeAutoPilots.get(autoPilotId);
    if (!autoPilot) {
      logger.warn(`Background AutoPilot ${autoPilotId} not found`);
      return;
    }

    try {
      logger.info(`[Background AutoPilot ${autoPilotId}] Starting execution loop`);

      while (autoPilot.isRunning) {
        // Check if timeout reached
        const elapsed = Date.now() - autoPilot.startedAt;
        if (elapsed >= this.MAX_BACKGROUND_DURATION) {
          logger.info(`[Background AutoPilot ${autoPilotId}] Time limit reached, stopping`);
          await this.stopBackgroundAutoPilot(autoPilotId, 'timeout');
          break;
        }

        // Load project from database to get latest state
        const project = await Project.findOne({
          _id: autoPilot.projectId,
          userId: autoPilot.userId
        });

        if (!project) {
          throw new Error('Project not found');
        }

        // Check budget
        if (project.budget && project.budget.spent >= ((project as any).budget.total)) {
          logger.info(`[Background AutoPilot ${autoPilotId}] Budget cap reached, stopping`);
          await this.stopBackgroundAutoPilot(autoPilotId, 'budget');
          break;
        }

        // Get pending tasks for current sprint
        const pendingTasks = (project.tasks || []).filter((t: any) => 
          (t.status === 'Pending' || t.status === 'Failed' || t.status === 'Paused') && 
          t.sprint === autoPilot.currentSprint
        );

        // Execute pending tasks
        if (pendingTasks.length > 0) {
          logger.info(`[Background AutoPilot ${autoPilotId}] Found ${pendingTasks.length} pending tasks, executing...`);
          
          // Execute tasks sequentially (respecting max parallel tasks)
          const maxParallel = 3; // Conservative limit for background execution
          const tasksToExecute = pendingTasks.slice(0, maxParallel);
          
          await Promise.allSettled(
            tasksToExecute.map(task => this.executeTask(autoPilot, project, task))
          );

          autoPilot.lastTaskExecutedAt = Date.now();
          
          // Wait before next iteration
          await new Promise(resolve => setTimeout(resolve, this.TASK_EXECUTION_DELAY));
          continue;
        }

        // Check for active tasks
        const activeTasks = (project.tasks || []).filter((t: any) => t.status === 'In Progress');
        const reviewTasks = (project.tasks || []).filter((t: any) => t.status === 'Review');

        // Wait if there are review tasks
        if (reviewTasks.length > 0) {
          logger.info(`[Background AutoPilot ${autoPilotId}] Waiting for ${reviewTasks.length} review task(s)...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        // If no active tasks and no pending tasks, try to advance phase/sprint
        if (!activeTasks.length && !pendingTasks.length) {
          logger.info(`[Background AutoPilot ${autoPilotId}] No pending tasks, attempting to advance phase/sprint...`);
          
          const advanced = await this.advancePhase(autoPilot, project);
          if (!advanced) {
            await this.startNextSprint(autoPilot, project);
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Wait for active tasks to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Reload project state
        const updatedProject = await Project.findOne({
          _id: autoPilot.projectId,
          userId: autoPilot.userId
        });
        if (updatedProject) {
          autoPilot.currentPhase = updatedProject.currentPhase || autoPilot.currentPhase;
          autoPilot.currentSprint = updatedProject.currentSprint || autoPilot.currentSprint;
        }
      }

      logger.info(`[Background AutoPilot ${autoPilotId}] Execution loop completed`);
    } catch (error: unknown) {
      logger.error(`[Background AutoPilot ${autoPilotId}] Execution error:`, error);
      await this.stopBackgroundAutoPilot(autoPilotId, 'error');
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    autoPilot: BackgroundAutoPilot,
    project: any,
    task: any
  ): Promise<void> {
    try {
      logger.info(`[Background AutoPilot ${autoPilot.id}] Executing task: ${task.title}`);

      // Find agent for task
      const agent = autoPilot.agents.find((a: any) => 
        a.role === task.assignedTo || a.name === task.assignedTo
      ) || autoPilot.agents[0];

      if (!agent) {
        throw new Error('No agent found for task');
      }

      // Update task status to In Progress
      const taskIndex = project.tasks.findIndex((t: any) => t.id === task.id);
      if (taskIndex === -1) {
        throw new Error('Task not found in project');
      }

      project.tasks[taskIndex].status = 'In Progress';
      project.tasks[taskIndex].startTime = Date.now();
      await project.save();

      // Build prompt
      const prompt = `You are ${agent.name || agent.role}. ${agent.goal || ''}

TASK: ${task.title}
DESCRIPTION: ${task.description}

PROJECT CONTEXT:
${autoPilot.projectContext}

${autoPilot.artifacts.length > 0 ? `\nRELEVANT ARTIFACTS:\n${autoPilot.artifacts.map((a: any) => `- ${a.title}: ${a.content?.substring(0, 500) || ''}...`).join('\n')}` : ''}

${autoPilot.standards.length > 0 ? `\nQUALITY STANDARDS: ${autoPilot.standards.join(', ')}` : ''}

Please complete this task and provide your output.`;

      // Execute task
      const startTime = Date.now();
      const result = await geminiService.generateContent(prompt, 'gemini-2.5-flash', {
        systemInstruction: `You are ${agent.name || agent.role}. ${agent.goal || ''}`
      });

      const latency = Date.now() - startTime;
      const output = result.text || '';

      // Track usage
      try {
        await usageTracker.trackUsage({
          userId: autoPilot.userId,
          modelId: 'gemini-2.5-flash',
          provider: 'gemini',
          modelIdentifier: 'gemini-2.5-flash',
          inputTokens: result.usage?.promptTokens || 0,
          outputTokens: result.usage?.candidatesTokens || 0,
          requestType: 'agent-task',
          context: 'background-autopilot' as any,
          success: true,
          latencyMs: latency,
          metadata: {
            agentRole: agent.role,
            taskId: task.id,
            autoPilotId: autoPilot.id
          }
        });
      } catch (trackError) {
        logger.error(`[Background AutoPilot ${autoPilot.id}] Failed to track usage:`, trackError);
      }

      // Perform evaluation
      let evaluation;
      try {
        evaluation = await evaluationService.evaluateTaskOutput({
          taskTitle: task.title,
          taskDescription: task.description,
          agentRole: agent.role,
          output: output,
          standards: autoPilot.standards || [],
          projectContext: autoPilot.projectContext || ''
        });
      } catch (evalError: any) {
        logger.warn(`[Background AutoPilot ${autoPilot.id}] Evaluation failed:`, evalError);
        evaluation = await evaluationService.quickEvaluate(output, task.description);
      }

      // Update task in database
      const updatedProject = await Project.findOne({
        _id: autoPilot.projectId,
        userId: autoPilot.userId
      });

      if (updatedProject) {
        const taskIndex = updatedProject.tasks.findIndex((t: any) => t.id === task.id);
        if (taskIndex !== -1) {
          updatedProject.tasks[taskIndex].status = 'Completed';
          updatedProject.tasks[taskIndex].endTime = Date.now();
          updatedProject.tasks[taskIndex].progress = 100;
          updatedProject.tasks[taskIndex].output = output;
          updatedProject.tasks[taskIndex].evaluation = {
            score: evaluation.score,
            criteria: evaluation.criteria,
            timestamp: Date.now()
          };

          if (!updatedProject.tasks[taskIndex].logs) {
            updatedProject.tasks[taskIndex].logs = [];
          }
          updatedProject.tasks[taskIndex].logs.push(
            `[Background AutoPilot] Task completed at ${new Date().toISOString()}`,
            `[Background AutoPilot] Evaluation score: ${evaluation.score}/100`
          );

          // Update budget
          const cost = this.calculateCost(result.usage, 'gemini-2.5-flash');
          if (updatedProject.budget) {
            updatedProject.budget.spent = (updatedProject.budget.spent || 0) + cost;
          }

          await updatedProject.save();
          logger.info(`[Background AutoPilot ${autoPilot.id}] Task ${task.id} completed. Score: ${evaluation.score}/100`);
        }
      }
    } catch (error: unknown) {
      logger.error(`[Background AutoPilot ${autoPilot.id}] Task execution failed:`, error);
      
      // Update task status to failed
      try {
        const project = await Project.findOne({
          _id: autoPilot.projectId,
          userId: autoPilot.userId
        });

        if (project) {
          const taskIndex = project.tasks.findIndex((t: any) => t.id === task.id);
          if (taskIndex !== -1) {
            project.tasks[taskIndex].status = 'Failed';
            if (!project.tasks[taskIndex].logs) {
              project.tasks[taskIndex].logs = [];
            }
            project.tasks[taskIndex].logs.push(`[Background AutoPilot] Task failed: ${(error instanceof Error ? error.message : String(error))}`);
            await project.save();
          }
        }
      } catch (updateError) {
        logger.error(`[Background AutoPilot ${autoPilot.id}] Failed to update task status:`, updateError);
      }
    }
  }

  /**
   * Advance to next phase
   */
  private async advancePhase(autoPilot: BackgroundAutoPilot, _project: any): Promise<boolean> {
    try {
      logger.info(`[Background AutoPilot ${autoPilot.id}] Attempting to advance phase from ${autoPilot.currentPhase}`);
      
      // Get phase order (simplified - would need to match frontend logic)
      const phaseOrder = ['Planning', 'Requirements', 'Design', 'Implementation', 'Testing', 'Deployment'];
      const currentIndex = phaseOrder.indexOf(autoPilot.currentPhase);
      
      if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
        logger.info(`[Background AutoPilot ${autoPilot.id}] Cannot advance phase - already at last phase or unknown phase`);
        return false;
      }
      
      const nextPhase = phaseOrder[currentIndex + 1];
      
      // Update project phase
      const updatedProject = await Project.findOne({
        _id: autoPilot.projectId,
        userId: autoPilot.userId
      });
      
      if (updatedProject) {
        updatedProject.currentPhase = nextPhase;
        autoPilot.currentPhase = nextPhase;
        await updatedProject.save();
        logger.info(`[Background AutoPilot ${autoPilot.id}] Advanced to phase: ${nextPhase}`);
        return true;
      }
      
      return false;
    } catch (error: unknown) {
      logger.error(`[Background AutoPilot ${autoPilot.id}] Failed to advance phase:`, error);
      return false;
    }
  }

  /**
   * Start next sprint
   */
  private async startNextSprint(autoPilot: BackgroundAutoPilot, _project: any): Promise<void> {
    logger.info(`[Background AutoPilot ${autoPilot.id}] Starting next sprint logic would go here`);
    // Increment sprint
    autoPilot.currentSprint = (autoPilot.currentSprint || 1) + 1;
    
    const updatedProject = await Project.findOne({
      _id: autoPilot.projectId,
      userId: autoPilot.userId
    });
    
    if (updatedProject) {
      updatedProject.currentSprint = autoPilot.currentSprint;
      await updatedProject.save();
    }
  }

  /**
   * Stop HAND-OFF AI background execution
   */
  async stopBackgroundAutoPilot(autoPilotId: string, reason: 'user' | 'timeout' | 'budget' | 'error' = 'user'): Promise<void> {
    const autoPilot = this.activeAutoPilots.get(autoPilotId);
    if (!autoPilot) {
      logger.warn(`Background AutoPilot ${autoPilotId} not found for stopping`);
      return;
    }

    // Stop execution loop
    autoPilot.isRunning = false;

    // Clear timeout
    if (autoPilot.timeoutId) {
      clearTimeout(autoPilot.timeoutId);
    }

    logger.info(`Stopped background AutoPilot ${autoPilotId} (reason: ${reason})`);
    
    // Don't delete immediately - let it clean up naturally
    setTimeout(() => {
      this.activeAutoPilots.delete(autoPilotId);
    }, 5000);
  }

  /**
   * Get active HAND-OFF AI jobs for a user/project
   */
  getActiveAutoPilots(userId?: string, projectId?: string): BackgroundAutoPilot[] {
    const autoPilots = Array.from(this.activeAutoPilots.values());
    
    if (userId) {
      return autoPilots.filter(ap => ap.userId === userId);
    }
    if (projectId) {
      return autoPilots.filter(ap => ap.projectId === projectId);
    }
    
    return autoPilots;
  }

  /**
   * Get remaining time for a background HAND-OFF AI job
   */
  getRemainingTime(autoPilotId: string): number {
    const autoPilot = this.activeAutoPilots.get(autoPilotId);
    if (!autoPilot) return 0;

    const elapsed = Date.now() - autoPilot.startedAt;
    const remaining = this.MAX_BACKGROUND_DURATION - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(usage: any, model: string): number {
    if (!usage) return 0;

    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
      'gemini-3-pro-preview': { input: 1.25 / 1000000, output: 5.00 / 1000000 }
    };

    const modelPricing = pricing[model] || pricing['gemini-2.5-flash'];
    const inputCost = (usage.promptTokens || 0) * modelPricing.input;
    const outputCost = (usage.candidatesTokens || 0) * modelPricing.output;

    return inputCost + outputCost;
  }
}

export const backgroundAutoPilotService = new BackgroundAutoPilotService();

