/**
 * Support Chat Service
 * Business logic for live chat session management and queue operations
 */

import { SupportChat, ISupportChat } from '../models/SupportChat.model.js';
import { User } from '../models/User.model.js';
import { webSocketService } from './websocket.service.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface ChatQueueItem {
  chatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  queuePosition: number;
  waitTime: number; // in seconds
  initialMessage?: string;
  queuedAt: Date;
}

export interface ChatStats {
  queueCount: number;
  activeCount: number;
  todayTotal: number;
  avgWaitTime: number;
  avgChatDuration: number;
  avgRating: number;
  agentStats: AgentChatStats[];
}

export interface AgentChatStats {
  agentId: string;
  agentName: string;
  activeChats: number;
  todayChats: number;
  avgRating: number;
  avgChatDuration: number;
}

class SupportChatService {
  /**
   * Get the current chat queue with wait times
   */
  async getChatQueue(): Promise<ChatQueueItem[]> {
    const queuedChats = await SupportChat.find({ status: 'queued' })
      .sort({ queuedAt: 1 })
      .lean();

    const now = Date.now();
    return queuedChats.map((chat, index) => ({
      chatId: chat.chatId,
      userId: chat.userId,
      userName: chat.userName,
      userEmail: chat.userEmail,
      userPlan: chat.userPlan,
      queuePosition: index + 1,
      waitTime: chat.queuedAt ? Math.floor((now - new Date(chat.queuedAt).getTime()) / 1000) : 0,
      initialMessage: chat.messages[0]?.content,
      queuedAt: chat.queuedAt || chat.createdAt
    }));
  }

  /**
   * Get comprehensive chat statistics
   */
  async getChatStats(): Promise<ChatStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      queueCount,
      activeCount,
      todayTotal,
      avgWaitTime,
      avgDuration,
      avgRating,
      agentStats
    ] = await Promise.all([
      SupportChat.countDocuments({ status: 'queued' }),
      SupportChat.countDocuments({ status: 'active' }),
      SupportChat.countDocuments({ createdAt: { $gte: today } }),
      this.getAverageWaitTime(),
      this.getAverageChatDuration(),
      this.getAverageRating(),
      this.getAgentChatStats()
    ]);

    return {
      queueCount,
      activeCount,
      todayTotal,
      avgWaitTime,
      avgChatDuration: avgDuration,
      avgRating,
      agentStats
    };
  }

  /**
   * Get average wait time for chats (in seconds)
   */
  async getAverageWaitTime(): Promise<number> {
    const result = await SupportChat.aggregate([
      {
        $match: {
          status: 'queued'
        }
      },
      {
        $project: {
          waitTime: {
            $divide: [
              { $subtract: [new Date(), '$queuedAt'] },
              1000
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgWaitTime: { $avg: '$waitTime' }
        }
      }
    ]);

    return Math.floor(result[0]?.avgWaitTime || 0);
  }

  /**
   * Get average chat duration (in minutes)
   */
  async getAverageChatDuration(): Promise<number> {
    const result = await SupportChat.aggregate([
      {
        $match: {
          status: 'ended',
          startedAt: { $exists: true },
          endedAt: { $exists: true }
        }
      },
      {
        $project: {
          duration: {
            $divide: [
              { $subtract: ['$endedAt', '$startedAt'] },
              1000 * 60
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    return Math.round(result[0]?.avgDuration || 0);
  }

  /**
   * Get average chat rating
   */
  async getAverageRating(): Promise<number> {
    const result = await SupportChat.aggregate([
      {
        $match: {
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    return Number((result[0]?.avgRating || 0).toFixed(1));
  }

  /**
   * Get per-agent chat statistics
   */
  async getAgentChatStats(): Promise<AgentChatStats[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await SupportChat.aggregate([
      {
        $match: {
          agentId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$agentId',
          agentName: { $first: '$agentName' },
          activeChats: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          todayChats: {
            $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] }
          },
          totalRating: {
            $sum: { $cond: [{ $gt: ['$rating', 0] }, '$rating', 0] }
          },
          ratedChats: {
            $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] }
          },
          totalDuration: {
            $sum: {
              $cond: {
                if: { $and: ['$startedAt', '$endedAt'] },
                then: { $subtract: ['$endedAt', '$startedAt'] },
                else: 0
              }
            }
          },
          completedChats: {
            $sum: {
              $cond: {
                if: { $and: ['$startedAt', '$endedAt'] },
                then: 1,
                else: 0
              }
            }
          }
        }
      },
      {
        $project: {
          agentId: '$_id',
          agentName: 1,
          activeChats: 1,
          todayChats: 1,
          avgRating: {
            $cond: {
              if: { $gt: ['$ratedChats', 0] },
              then: { $divide: ['$totalRating', '$ratedChats'] },
              else: 0
            }
          },
          avgChatDuration: {
            $cond: {
              if: { $gt: ['$completedChats', 0] },
              then: {
                $divide: [
                  '$totalDuration',
                  { $multiply: ['$completedChats', 1000 * 60] }
                ]
              },
              else: 0
            }
          }
        }
      }
    ]);

    return stats.map(s => ({
      agentId: s.agentId,
      agentName: s.agentName,
      activeChats: s.activeChats,
      todayChats: s.todayChats,
      avgRating: Number(s.avgRating.toFixed(1)),
      avgChatDuration: Math.round(s.avgChatDuration)
    }));
  }

  /**
   * Update queue positions when a chat is accepted
   */
  async updateQueuePositions(): Promise<void> {
    const queuedChats = await SupportChat.find({ status: 'queued' })
      .sort({ queuedAt: 1 })
      .select('_id');

    for (let i = 0; i < queuedChats.length; i++) {
      await SupportChat.findByIdAndUpdate(queuedChats[i]._id, {
        queuePosition: i + 1
      });
    }

    // Notify all queued users of position updates
    webSocketService.broadcastToRoom('support-queue', {
      type: 'queue_positions_updated',
      positions: queuedChats.map((chat, i) => ({
        chatId: chat._id?.toString(),
        position: i + 1
      }))
    });
  }

  /**
   * Get available agents sorted by workload
   */
  async getAvailableAgents(): Promise<{ id: string; name: string; activeChats: number }[]> {
    const agents = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      isActive: true
    }).select('_id name').lean();

    const activeChatCounts = await SupportChat.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$agentId', count: { $sum: 1 } } }
    ]);

    const countMap = activeChatCounts.reduce((acc: any, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    return agents
      .map(agent => ({
        id: agent._id?.toString() || '',
        name: agent.name,
        activeChats: countMap[agent._id?.toString() || ''] || 0
      }))
      .sort((a, b) => a.activeChats - b.activeChats);
  }

  /**
   * Auto-assign chat to least busy agent
   */
  async autoAssignChat(chatId: string): Promise<ISupportChat | null> {
    const chat = await SupportChat.findOne({ chatId, status: 'queued' });
    if (!chat) return null;

    const availableAgents = await this.getAvailableAgents();
    if (availableAgents.length === 0) {
      logger.warn('[Support Chat] No available agents for auto-assignment');
      return chat;
    }

    const selectedAgent = availableAgents[0]; // Already sorted by workload

    chat.status = 'active';
    chat.agentId = selectedAgent.id;
    chat.agentName = selectedAgent.name;
    chat.startedAt = new Date();
    chat.queuePosition = undefined;

    chat.messages.push({
      id: uuidv4(),
      sender: 'system',
      senderId: 'system',
      senderName: 'System',
      content: `${selectedAgent.name} has joined the chat.`,
      createdAt: new Date()
    });

    await chat.save();
    await this.updateQueuePositions();

    // Notify user
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'agent_joined',
      chatId,
      agentId: selectedAgent.id,
      agentName: selectedAgent.name
    });

    // Notify agent
    webSocketService.broadcastToRoom(`agent:${selectedAgent.id}`, {
      type: 'chat_assigned',
      chat
    });

    logger.info(`[Support Chat] Chat ${chatId} auto-assigned to ${selectedAgent.name}`);
    return chat;
  }

  /**
   * Get chat metrics for a date range
   */
  async getChatMetrics(startDate: Date, endDate: Date): Promise<any> {
    const metrics = await SupportChat.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $facet: {
          byDay: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                total: { $sum: 1 },
                completed: {
                  $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] }
                },
                avgRating: { $avg: '$rating' }
              }
            },
            { $sort: { _id: 1 } }
          ],
          byAgent: [
            {
              $match: { agentId: { $exists: true } }
            },
            {
              $group: {
                _id: '$agentId',
                agentName: { $first: '$agentName' },
                total: { $sum: 1 },
                avgRating: { $avg: '$rating' }
              }
            }
          ],
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                completed: {
                  $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] }
                },
                avgRating: { $avg: '$rating' },
                avgDuration: {
                  $avg: {
                    $cond: {
                      if: { $and: ['$startedAt', '$endedAt'] },
                      then: { $subtract: ['$endedAt', '$startedAt'] },
                      else: null
                    }
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    return metrics[0];
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(chatId: string, userId: string, userName: string, isTyping: boolean): void {
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'typing_indicator',
      chatId,
      userId,
      userName,
      isTyping
    });
  }

  /**
   * Get estimated wait time for a new chat
   */
  async getEstimatedWaitTime(): Promise<number> {
    const queueCount = await SupportChat.countDocuments({ status: 'queued' });
    const availableAgents = await this.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      return -1; // No agents available
    }

    // Estimate based on queue size and available agents
    const avgChatDuration = await this.getAverageChatDuration();
    const estimatedMinutes = Math.ceil((queueCount / availableAgents.length) * avgChatDuration);
    
    return estimatedMinutes * 60; // Return in seconds
  }

  /**
   * Clean up stale chats (queued for too long without agent)
   */
  async cleanupStaleChats(maxWaitMinutes: number = 60): Promise<number> {
    const threshold = new Date(Date.now() - maxWaitMinutes * 60 * 1000);

    const result = await SupportChat.updateMany(
      {
        status: 'queued',
        queuedAt: { $lt: threshold }
      },
      {
        $set: {
          status: 'ended',
          endedAt: new Date(),
          endedBy: 'system',
          endReason: 'Queue timeout - no agents available'
        },
        $push: {
          messages: {
            id: uuidv4(),
            sender: 'system',
            senderId: 'system',
            senderName: 'System',
            content: 'Chat ended due to queue timeout. Please try again later or submit a support ticket.',
            createdAt: new Date()
          }
        }
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[Support Chat] Cleaned up ${result.modifiedCount} stale chats`);
    }

    return result.modifiedCount;
  }
}

export const supportChatService = new SupportChatService();

