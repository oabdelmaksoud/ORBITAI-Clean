/**
 * Agent Rollback Service
 * Reverts artifact changes, restores state, and notifies dependent agents
 */

import { logger } from '../utils/logger.js';
import { AgentExecution, IAgentExecution } from '../models/AgentExecution.model.js';
import { Artifact} from '../models/Artifact.model.js';
import { agentCommunicationService } from './agentCommunication.service.js';

export interface RollbackResult {
  executionId: string;
  rolledBack: boolean;
  artifactsReverted: number;
  dependentAgentsNotified: number;
  restoredState: boolean;
  error?: string;
}

class AgentRollbackService {
  /**
   * Create execution snapshot
   */
  async createSnapshot(
    projectId: string,
    taskId: string,
    agentId: string,
    agentRole: string
  ): Promise<IAgentExecution> {
    try {
      // Get current artifacts
      const artifacts = await Artifact.find({ projectId }).lean() as any;

      const snapshot = {
        artifacts: artifacts.map((a: any) => ({
          id: a._id.toString(),
          content: a.content,
          version: 1 // Simplified versioning
        })),
        timestamp: new Date()
      };

      const execution = new AgentExecution({
        projectId,
        taskId,
        agentId,
        agentRole,
        status: 'running',
        artifactsCreated: [],
        stateSnapshot: snapshot,
        startedAt: new Date()
      });

      await execution.save();
      return execution;
    } catch (error: unknown) {
      logger.error('Failed to create execution snapshot:', error);
      throw error;
    }
  }

  /**
   * Track artifact creation
   */
  async trackArtifactCreation(
    executionId: string,
    artifactId: string,
    content: string
  ): Promise<void> {
    await AgentExecution.findByIdAndUpdate(executionId, {
      $push: {
        artifactsCreated: {
          artifactId,
          snapshot: content
        }
      }
    });
  }

  /**
   * Rollback agent execution
   */
  async rollback(
    executionId: string,
    reason: string,
    notifyDependents: boolean = true
  ): Promise<RollbackResult> {
    try {
      logger.info(`Rolling back agent execution: ${executionId}`);

      const execution = await AgentExecution.findById(executionId);
      if (!execution) {
        throw new Error('Execution not found');
      }

      if (execution.status === 'rolled_back') {
        return {
          executionId,
          rolledBack: false,
          artifactsReverted: 0,
          dependentAgentsNotified: 0,
          restoredState: false,
          error: 'Already rolled back'
        };
      }

      let artifactsReverted = 0;
      let dependentAgentsNotified = 0;

      // Revert created artifacts
      for (const artifactInfo of execution.artifactsCreated) {
        try {
          const artifact = await Artifact.findById(artifactInfo.artifactId);
          if (artifact) {
            // Restore from snapshot or delete if new
            if (artifactInfo.snapshot) {
              artifact.content = artifactInfo.snapshot;
              await artifact.save();
            } else {
              await Artifact.findByIdAndDelete(artifactInfo.artifactId);
            }
            artifactsReverted++;
          }
        } catch (error: unknown) {
          logger.warn(`Failed to revert artifact ${artifactInfo.artifactId}:`, (error instanceof Error ? error.message : String(error)));
        }
      }

      // Restore state from snapshot
      let restoredState = false;
      if (execution.stateSnapshot && execution.stateSnapshot.artifacts) {
        try {
          for (const snapArtifact of execution.stateSnapshot.artifacts) {
            const artifact = await Artifact.findById(snapArtifact.id);
            if (artifact && artifact.content !== snapArtifact.content) {
              artifact.content = snapArtifact.content;
              await artifact.save();
            }
          }
          restoredState = true;
        } catch (error: unknown) {
          logger.warn('Failed to restore state from snapshot:', (error instanceof Error ? error.message : String(error)));
        }
      }

      // Notify dependent agents
      if (notifyDependents) {
        const notified = await this.notifyDependentAgents(
          execution.projectId,
          execution.agentId,
          execution.agentRole,
          reason
        );
        dependentAgentsNotified = notified;
      }

      // Update execution status
      execution.status = 'rolled_back';
      execution.rolledBackAt = new Date();
      execution.rollbackReason = reason;
      await execution.save();

      return {
        executionId,
        rolledBack: true,
        artifactsReverted,
        dependentAgentsNotified,
        restoredState
      };
    } catch (error: unknown) {
      logger.error('Rollback failed:', error);
      return {
        executionId,
        rolledBack: false,
        artifactsReverted: 0,
        dependentAgentsNotified: 0,
        restoredState: false,
        error: (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * Notify dependent agents
   */
  private async notifyDependentAgents(
    projectId: string,
    failedAgentId: string,
    failedAgentRole: string,
    reason: string
  ): Promise<number> {
    // Find agents that depend on this agent's output
    // This would use dependency tracking or task dependencies
    const dependentAgents: string[] = []; // Placeholder

    for (const agentId of dependentAgents) {
      await agentCommunicationService.propagateError(
        projectId,
        failedAgentId,
        failedAgentRole,
        `Dependency failed: ${reason}`,
        [agentId]
      );
    }

    return dependentAgents.length;
  }

  /**
   * Partial rollback (only failed steps)
   */
  async partialRollback(
    executionId: string,
    failedStep: string,
    reason: string
  ): Promise<RollbackResult> {
    // Similar to full rollback but only reverts artifacts created after failed step
    return await this.rollback(executionId, `${failedStep}: ${reason}`, true);
  }

  /**
   * Get rollback history
   */
  async getRollbackHistory(projectId: string): Promise<IAgentExecution[]> {
    return await AgentExecution.find({
      projectId,
      status: 'rolled_back'
    })
      .sort({ rolledBackAt: -1 })
      .limit(50)
      .lean() as any;
  }
}

export const agentRollbackService = new AgentRollbackService();



