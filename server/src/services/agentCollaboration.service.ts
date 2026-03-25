/**
 * Agent Collaboration Service
 * Tracks inter-agent communication and collaboration success rate
 */

import { logger } from '../utils/logger.js';
import { AgentMessage } from '../models/AgentMessage.model.js';
import { AgentExecution } from '../models/AgentExecution.model.js';

export interface CollaborationMetrics {
  agentId: string;
  agentRole: string;
  communicationFrequency: number; // Messages sent/received per day
  collaborationSuccessRate: number; // 0-100
  dependencyResolutionTime: number; // Average milliseconds
  conflictFrequency: number; // Conflicts per 100 tasks
  collaborationScore: number; // 0-100
}

export interface CollaborationReport {
  projectId: string;
  agents: CollaborationMetrics[];
  network: Array<{
    fromAgent: string;
    toAgent: string;
    messageCount: number;
    successRate: number;
  }>;
  overallCollaboration: number; // 0-100
  generatedAt: Date;
}

class AgentCollaborationService {
  /**
   * Calculate collaboration metrics
   */
  async calculateCollaborationMetrics(
    projectId: string,
    agentId: string,
    agentRole: string
  ): Promise<CollaborationMetrics> {
    try {
      // Get messages for this agent
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const messages = await AgentMessage.find({
        projectId,
        $or: [
          { fromAgentId: agentId },
          { toAgentId: agentId }
        ],
        timestamp: { $gte: thirtyDaysAgo }
      }).lean();

      // Calculate communication frequency
      const days = 30;
      const communicationFrequency = messages.length / days;

      // Calculate collaboration success rate
      const resultSharing = messages.filter(m => m.messageType === 'result_sharing');
      const successfulCollaborations = resultSharing.filter(m => m.read).length;
      const collaborationSuccessRate = resultSharing.length > 0
        ? (successfulCollaborations / resultSharing.length) * 100
        : 0;

      // Calculate dependency resolution time (simplified)
      const dependencyMessages = messages.filter(m => m.messageType === 'dependency_notification');
      const dependencyResolutionTime = dependencyMessages.length > 0
        ? 5000 // Placeholder: would calculate from actual resolution times
        : 0;

      // Calculate conflict frequency
      const conflicts = messages.filter(m => 
        m.content.toLowerCase().includes('conflict') ||
        m.content.toLowerCase().includes('contradict')
      ).length;
      const totalTasks = await AgentExecution.countDocuments({ projectId, agentId });
      const conflictFrequency = totalTasks > 0 ? (conflicts / totalTasks) * 100 : 0;

      // Calculate collaboration score
      const collaborationScore = this.calculateCollaborationScore(
        communicationFrequency,
        collaborationSuccessRate,
        dependencyResolutionTime,
        conflictFrequency
      );

      return {
        agentId,
        agentRole,
        communicationFrequency: Math.round(communicationFrequency * 100) / 100,
        collaborationSuccessRate: Math.round(collaborationSuccessRate * 100) / 100,
        dependencyResolutionTime: Math.round(dependencyResolutionTime),
        conflictFrequency: Math.round(conflictFrequency * 100) / 100,
        collaborationScore: Math.round(collaborationScore)
      };
    } catch (error: any) {
      logger.error('Failed to calculate collaboration metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate collaboration score
   */
  private calculateCollaborationScore(
    communicationFrequency: number,
    collaborationSuccessRate: number,
    dependencyResolutionTime: number,
    conflictFrequency: number
  ): number {
    let score = 50; // Base score

    // Communication frequency (normalized)
    score += Math.min(20, communicationFrequency * 2);

    // Collaboration success rate
    score += (collaborationSuccessRate / 100) * 20;

    // Dependency resolution time (faster = better)
    if (dependencyResolutionTime < 5000) score += 10;
    else if (dependencyResolutionTime < 10000) score += 5;

    // Conflict frequency (lower = better)
    score -= conflictFrequency * 0.5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate collaboration report
   */
  async generateReport(projectId: string): Promise<CollaborationReport> {
    try {
      // Get all agents in project
      const executions = await AgentExecution.find({ projectId }).lean();
      const agentIds = Array.from(new Set(executions.map(e => e.agentId)));
      const agentRoles = new Map<string, string>();
      
      for (const exec of executions) {
        agentRoles.set(exec.agentId, exec.agentRole);
      }

      const agents: CollaborationMetrics[] = [];

      for (const agentId of agentIds) {
        const role = agentRoles.get(agentId) || 'Unknown';
        const metrics = await this.calculateCollaborationMetrics(projectId, agentId, role);
        agents.push(metrics);
      }

      // Build collaboration network
      const network = await this.buildCollaborationNetwork(projectId, agentIds);

      // Calculate overall collaboration
      const overallCollaboration = agents.length > 0
        ? agents.reduce((sum, a) => sum + a.collaborationScore, 0) / agents.length
        : 0;

      return {
        projectId,
        agents,
        network,
        overallCollaboration: Math.round(overallCollaboration),
        generatedAt: new Date()
      };
    } catch (error: any) {
      logger.error('Failed to generate collaboration report:', error);
      throw error;
    }
  }

  /**
   * Build collaboration network
   */
  private async buildCollaborationNetwork(
    projectId: string,
    agentIds: string[]
  ): Promise<CollaborationReport['network']> {
    const network: CollaborationReport['network'] = [];
    const networkMap = new Map<string, { count: number; success: number }>();

    // Get all messages
    const messages = await AgentMessage.find({
      projectId,
      fromAgentId: { $in: agentIds },
      toAgentId: { $in: agentIds }
    }).lean();

    // Build network edges
    for (const message of messages) {
      if (!message.toAgentId) continue;

      const key = `${message.fromAgentId}:${message.toAgentId}`;
      if (!networkMap.has(key)) {
        networkMap.set(key, { count: 0, success: 0 });
      }

      const edge = networkMap.get(key)!;
      edge.count++;
      if (message.read) {
        edge.success++;
      }
    }

    // Convert to network format
    for (const [key, data] of networkMap.entries()) {
      const [fromAgent, toAgent] = key.split(':');
      const successRate = data.count > 0 ? (data.success / data.count) * 100 : 0;

      network.push({
        fromAgent,
        toAgent,
        messageCount: data.count,
        successRate: Math.round(successRate * 100) / 100
      });
    }

    return network;
  }
}

export const agentCollaborationService = new AgentCollaborationService();



