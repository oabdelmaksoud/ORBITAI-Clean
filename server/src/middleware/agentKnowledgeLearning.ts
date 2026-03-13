/**
 * Middleware to automatically enhance agent knowledge from task executions
 */

import { agentKnowledgeLearning } from '../services/agentKnowledgeLearning.js';
import { logger } from '../utils/logger.js';

/**
 * Learn from task execution results
 */
export async function learnFromTaskExecution(
  agentRole: string,
  taskTitle: string,
  taskDescription: string,
  success: boolean,
  evaluation?: {
    score: number;
    criteria: string[];
  },
  modelUsed?: string,
  provider?: string,
  latency?: number
): Promise<void> {
  try {
    // Extract skills and domains from task
    const skillsUsed = agentKnowledgeLearning.extractSkillsFromTask(
      taskTitle,
      taskDescription,
      agentRole
    );
    
    const domainsUsed = agentKnowledgeLearning.extractDomainsFromTask(
      taskTitle,
      taskDescription
    );

    await agentKnowledgeLearning.learnFromTaskExecution({
      agentRole,
      taskTitle,
      taskDescription,
      success,
      evaluation,
      skillsUsed,
      domainsUsed,
      modelUsed,
      provider,
      latency
    });
  } catch (error: any) {
    logger.error(`Failed to learn from task execution for ${agentRole}:`, error);
    // Don't throw - learning failures shouldn't break task execution
  }
}

/**
 * Learn from LLM usage patterns
 */
export async function learnFromLLMUsage(
  agentRole: string | undefined,
  modelId: string,
  provider: string,
  success: boolean,
  latency?: number
): Promise<void> {
  if (!agentRole) return; // Skip if no agent role

  try {
    await agentKnowledgeLearning.learnFromTaskExecution({
      agentRole,
      taskTitle: 'LLM Usage',
      taskDescription: `Model usage: ${modelId}`,
      success,
      modelUsed: modelId,
      provider: provider as any,
      latency
    });
  } catch (error: any) {
    logger.error(`Failed to learn from LLM usage for ${agentRole}:`, error);
  }
}

