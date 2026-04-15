/**
 * Agent Knowledge Aggregator Service
 * Periodically aggregates learning from all platform activities
 */

import { agentDiscovery } from './agentDiscovery.service.js';
import { agentKnowledgeLearning } from './agentKnowledgeLearning.js';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';

export class AgentKnowledgeAggregator {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start periodic aggregation (runs every hour)
   * @param intervalHours - Interval in hours between aggregations
   * @param skipInitialRun - If true, skip the initial aggregation run (useful for faster startup)
   */
  start(intervalHours: number = 1, skipInitialRun: boolean = false): void {
    if (this.intervalId) {
      logger.warn('Agent knowledge aggregator is already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    // Run immediately on start (unless skipped for faster startup)
    if (!skipInitialRun) {
      this.runAggregation();
    }

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.runAggregation();
    }, intervalMs);

    logger.info(`Agent knowledge aggregator started (interval: ${intervalHours}h${skipInitialRun ? ', initial run skipped' : ''})`);
  }

  /**
   * Stop periodic aggregation
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Agent knowledge aggregator stopped');
    }
  }

  /**
   * Run aggregation once
   */
  async runAggregation(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Agent knowledge aggregation already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      logger.info('Starting agent knowledge aggregation from platform activities...');

      // 0. Discover new agents from projects first
      try {
        await agentDiscovery.discoverAgentsFromProjects();
        logger.info('Agent discovery completed during aggregation');
      } catch (discoveryError: any) {
        logger.warn('Agent discovery failed during aggregation:', discoveryError.message);
      }

      // 1. Aggregate learning from LLM usage patterns
      await agentKnowledgeLearning.aggregatePlatformLearning();

      // 2. Learn from completed tasks across all projects
      await this.learnFromCompletedTasks();

      // 3. Update metadata
      const { AgentKnowledge } = await import('../models/AgentKnowledge.model.js');
      const agents = await AgentKnowledge.find({}).lean();
      
      for (const agent of agents) {
        await AgentKnowledge.updateOne(
          { _id: agent._id },
          {
            $set: {
              'metadata.lastTrained': new Date(),
              'metrics.lastActiveDate': new Date()
            }
          }
        );
      }

      logger.info('Agent knowledge aggregation completed successfully');
    } catch (error: unknown) {
      logger.error('Agent knowledge aggregation failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Learn from completed tasks across all projects
   */
  private async learnFromCompletedTasks(): Promise<void> {
    try {
      // Get all projects with completed tasks
      const projects = await Project.find({}).lean();
      
      let totalTasksProcessed = 0;

      for (const project of projects) {
        if (!project.tasks || !Array.isArray(project.tasks)) continue;

        for (const task of project.tasks) {
          // Only process completed tasks with evaluations
          if (task.status !== 'Completed' || !task.evaluation) continue;

          const agentRole = task.assignedTo;
          if (!agentRole) continue;

          try {
            const skillsUsed = agentKnowledgeLearning.extractSkillsFromTask(
              task.title || '',
              task.description || '',
              agentRole
            );

            const domainsUsed = agentKnowledgeLearning.extractDomainsFromTask(
              task.title || '',
              task.description || ''
            );

            await agentKnowledgeLearning.learnFromTaskExecution({
              agentRole,
              taskTitle: task.title || '',
              taskDescription: task.description || '',
              success: task.status === 'Completed',
              evaluation: task.evaluation ? {
                score: task.evaluation.score || 0,
                criteria: task.evaluation.criteria || []
              } : undefined,
              skillsUsed,
              domainsUsed,
              modelUsed: task.modelUsed,
              latency: task.endTime && task.startTime ? task.endTime - task.startTime : undefined,
              tokensUsed: task.tokenUsage?.totalTokens
            });

            totalTasksProcessed++;
          } catch (error: unknown) {
            logger.debug(`Failed to learn from task ${task.id}:`, error);
            // Continue with next task
          }
        }
      }

      logger.info(`Processed ${totalTasksProcessed} completed tasks for knowledge learning`);
    } catch (error: unknown) {
      logger.error('Failed to learn from completed tasks:', error);
    }
  }
}

export const agentKnowledgeAggregator = new AgentKnowledgeAggregator();

