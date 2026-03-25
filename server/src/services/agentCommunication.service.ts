/**
 * Agent Communication Service
 * Implements agent-to-agent messaging protocol
 */

import { logger } from '../utils/logger.js';
import { AgentMessage, IAgentMessage } from '../models/AgentMessage.model.js';
// Bull queue (optional - only if Redis available)
let messageQueue: any = null;
try {
  const Bull = require('bull');
  messageQueue = new Bull('agent-messages', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10)
    }
  });
} catch (error: any) {
  logger.debug('Bull queue not available (Redis may not be configured)');
}

export interface AgentMessagePayload {
  projectId: string;
  fromAgentId: string;
  fromAgentRole: string;
  toAgentId?: string;
  toAgentRole?: string;
  messageType: IAgentMessage['messageType'];
  content: string;
  metadata?: IAgentMessage['metadata'];
}

class AgentCommunicationService {
  /**
   * Send message between agents
   */
  async sendMessage(payload: AgentMessagePayload): Promise<IAgentMessage> {
    try {
      logger.debug(`Agent message: ${payload.fromAgentRole} -> ${payload.toAgentRole || 'all'}: ${payload.messageType}`);

      // Create message
      const message = new AgentMessage({
        ...payload,
        timestamp: new Date(),
        read: false
      });

      await message.save();

      // Add to queue for processing (if available)
      if (messageQueue) {
        await messageQueue.add('process-message', {
          messageId: message._id.toString(),
          projectId: payload.projectId,
          toAgentId: payload.toAgentId,
          toAgentRole: payload.toAgentRole
        });
      }

      // Broadcast via WebSocket if target agent is online (if websocket service available)
      try {
        const { webSocketService } = await import('./websocket.service.js');
        if (payload.toAgentId) {
          webSocketService.broadcast(payload.toAgentId, {
            type: 'agent_message',
            message: {
              id: message._id.toString(),
              fromAgentRole: payload.fromAgentRole,
              messageType: payload.messageType,
              content: payload.content,
              metadata: payload.metadata
            }
          });
        }
      } catch (error: any) {
        logger.debug('WebSocket service not available for agent messaging');
      }

      return message;
    } catch (error: any) {
      logger.error('Failed to send agent message:', error);
      throw error;
    }
  }

  /**
   * Send status update
   */
  async sendStatusUpdate(
    projectId: string,
    agentId: string,
    agentRole: string,
    status: 'started' | 'in_progress' | 'completed' | 'failed',
    taskId?: string
  ): Promise<void> {
    await this.sendMessage({
      projectId,
      fromAgentId: agentId,
      fromAgentRole: agentRole,
      messageType: 'status_update',
      content: `Task status: ${status}`,
      metadata: {
        taskId,
        status
      }
    });
  }

  /**
   * Send dependency notification
   */
  async sendDependencyNotification(
    projectId: string,
    fromAgentId: string,
    fromAgentRole: string,
    toAgentId: string,
    toAgentRole: string,
    dependencyType: string,
    artifactId?: string
  ): Promise<void> {
    await this.sendMessage({
      projectId,
      fromAgentId,
      fromAgentRole,
      toAgentId,
      toAgentRole,
      messageType: 'dependency_notification',
      content: `Dependency: ${dependencyType} - waiting for your output`,
      metadata: {
        artifactId
      }
    });
  }

  /**
   * Share result with other agents
   */
  async shareResult(
    projectId: string,
    fromAgentId: string,
    fromAgentRole: string,
    toAgentIds: string[],
    artifactId: string,
    description: string
  ): Promise<void> {
    for (const toAgentId of toAgentIds) {
      await this.sendMessage({
        projectId,
        fromAgentId,
        fromAgentRole,
        toAgentId: toAgentId,
        messageType: 'result_sharing',
        content: description,
        metadata: {
          artifactId
        }
      });
    }
  }

  /**
   * Propagate error
   */
  async propagateError(
    projectId: string,
    fromAgentId: string,
    fromAgentRole: string,
    error: string,
    affectedAgents?: string[]
  ): Promise<void> {
    const targets = affectedAgents || []; // Broadcast if no specific targets

    for (const toAgentId of targets) {
      await this.sendMessage({
        projectId,
        fromAgentId,
        fromAgentRole,
        toAgentId,
        messageType: 'error_propagation',
        content: `Error occurred: ${error}`,
        metadata: {
          error
        }
      });
    }
  }

  /**
   * Get messages for agent
   */
  async getMessages(
    projectId: string,
    agentId: string,
    unreadOnly: boolean = false
  ): Promise<IAgentMessage[]> {
    const query: any = {
      projectId,
      $or: [
        { toAgentId: agentId },
        { toAgentId: { $exists: false } } // Broadcast messages
      ]
    };

    if (unreadOnly) {
      query.read = false;
    }

    const messages = await AgentMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return messages;
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string, agentId: string): Promise<void> {
    await AgentMessage.findByIdAndUpdate(messageId, {
      read: true,
      readAt: new Date()
    });
  }

  /**
   * Get message history
   */
  async getMessageHistory(
    projectId: string,
    limit: number = 50
  ): Promise<IAgentMessage[]> {
    return await AgentMessage.find({ projectId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }
}

// Process message queue (if available)
if (messageQueue) {
  messageQueue.process('process-message', async (job: any) => {
    const { messageId } = job.data;
    logger.debug(`Processing agent message: ${messageId}`);
    // Message processing logic (e.g., trigger agent actions)
  });
}

export const agentCommunicationService = new AgentCommunicationService();



