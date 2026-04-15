import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { SupportChat } from '../models/SupportChat.model.js';
import { SupportTicket } from '../models/SupportTicket.model.js';
import { User } from '../models/User.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { webSocketService } from '../services/websocket.service.js';
import aiSupportAgent from '../services/aiSupportAgent.service.js';

const router = express.Router();

// Validation schemas
const startChatSchema = z.object({
  initialMessage: z.string().min(1).max(2000).optional()
}).strict();

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  attachments: z.array(z.string()).optional()
}).strict();

const transferChatSchema = z.object({
  toAgentId: z.string().min(1),
  reason: z.string().optional()
}).strict();

const endChatSchema = z.object({
  reason: z.string().optional()
}).strict();

const rateChatSchema = z.object({
  rating: z.number().min(1).max(5),
  feedback: z.string().optional()
}).strict();

// ==================== USER ENDPOINTS ====================

/**
 * POST /api/support/chat/start
 * Start a new chat session with AI agent (user)
 */
router.post('/chat/start', authenticateToken, validate(startChatSchema), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { initialMessage } = req.body;
    const user = req.user;

    if (!user) {
      throw new AppError('User not authenticated', 401);
    }

    // Check if user already has an active chat
    const existingChat = await SupportChat.findOne({
      userId: user.id,
      status: { $in: ['queued', 'active', 'ai_active'] }
    });

    if (existingChat) {
      res.json({
        success: true,
        data: { chat: existingChat, existing: true }
      });
      return;
    }

    // Get user details
    const userDetails = await User.findById(user.id).select('plan').lean();

    // Generate chatId before creating the chat
    const chatId = uuidv4();

    // Start with AI agent (not queued for human)
    const chat = new SupportChat({
      chatId, // Ensure chatId is set
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPlan: userDetails?.plan || 'Free',
      status: 'ai_active', // New status: AI is handling
      agentId: 'ai-agent',
      agentName: 'AI Support Agent',
      startedAt: new Date(),
      messages: [{
        id: uuidv4(),
        sender: 'ai',
        senderId: 'ai-agent',
        senderName: 'AI Support Agent',
        content: `Hello ${user.name}! 👋 I'm your AI Support Agent. I'm here to help you with any questions or issues you might have. How can I assist you today?`,
        createdAt: new Date()
      }],
      metadata: {
        aiHandled: true,
        aiStartedAt: new Date()
      }
    });

    // If user provided initial message, add it and get AI response
    if (initialMessage) {
      chat.messages.push({
        id: uuidv4(),
        sender: 'user',
        senderId: user.id,
        senderName: user.name,
        content: initialMessage,
        createdAt: new Date()
      });
    }

    await chat.save();

    // If there's an initial message, generate AI response
    if (initialMessage) {
      // Process asynchronously to not block response
      setImmediate(async () => {
        try {
          const aiResponse = await aiSupportAgent.generateAIResponse(chat.chatId, initialMessage, user.id);
          await aiSupportAgent.processAIResponse(chat.chatId, user.id, aiResponse);
        } catch (err: unknown) {
          logger.error('[Support Chat] Error generating initial AI response:', err);
        }
      });
    }

    logger.info(`[Support Chat] New AI chat ${chat.chatId} started by user ${user.email}`);

    res.status(201).json({
      success: true,
      data: { chat, aiPowered: true }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/chat/active
 * Get user's active chat session
 */
router.get('/chat/active', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;

    const chat = await SupportChat.findOne({
      userId,
      status: { $in: ['queued', 'active'] }
    }).lean();

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/chat/:chatId/message
 * Send a message in chat (user) - Routes to AI or human agent
 */
router.post('/chat/:chatId/message', authenticateToken, validate(sendMessageSchema), async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const { content, attachments } = req.body;
    const user = req.user;

    if (!user) {
      throw new AppError('User not authenticated', 401);
    }

    const chat = await SupportChat.findOne({
      chatId,
      userId: user.id,
      status: { $in: ['queued', 'active', 'ai_active'] }
    });

    if (!chat) {
      throw new AppError('Chat not found or already ended', 404);
    }

    const message = {
      id: uuidv4(),
      sender: 'user' as const,
      senderId: user.id,
      senderName: user.name,
      content,
      attachments,
      createdAt: new Date()
    };

    chat.messages.push(message);
    await chat.save();

    // Broadcast user message via WebSocket
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'new_message',
      message,
      chatId
    });

    // If chat is AI-handled, generate AI response
    if (chat.status === 'ai_active') {
      // Check if user wants to talk to human
      if (!aiSupportAgent.shouldAIHandle(content)) {
        // Escalate to human
        const aiResponse = {
          message: "I understand you'd like to speak with a human agent. Let me connect you right away.",
          action: 'escalate' as const,
          escalationReason: 'User requested human agent',
          sentiment: 'neutral' as const,
          confidence: 1
        };
        await aiSupportAgent.processAIResponse(chatId, user.id, aiResponse);
      } else {
        // Generate AI response asynchronously
        setImmediate(async () => {
          try {
            const aiResponse = await aiSupportAgent.generateAIResponse(chatId, content, user.id);
            await aiSupportAgent.processAIResponse(chatId, user.id, aiResponse);
          } catch (err: unknown) {
            logger.error('[Support Chat] Error generating AI response:', err);
            // Fallback: escalate to human on AI error
            const fallbackResponse = {
              message: "I apologize, but I'm having some difficulty. Let me connect you with a human agent.",
              action: 'escalate' as const,
              escalationReason: 'AI processing error',
              sentiment: 'neutral' as const,
              confidence: 0
            };
            await aiSupportAgent.processAIResponse(chatId, user.id, fallbackResponse);
          }
        });
      }
    } else if (chat.agentId && chat.agentId !== 'ai-agent') {
      // Human agent is handling - just notify them
      webSocketService.broadcastToRoom(`agent:${chat.agentId}`, {
        type: 'new_message',
        message,
        chatId
      });
    }

    res.json({
      success: true,
      data: { message, aiHandled: chat.status === 'ai_active' }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/chat/:chatId/end
 * End chat session (user)
 */
router.post('/chat/:chatId/end', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const user = req.user;

    if (!user) {
      throw new AppError('User not authenticated', 401);
    }

    const chat = await SupportChat.findOne({
      chatId,
      userId: user.id,
      status: { $in: ['queued', 'active'] }
    });

    if (!chat) {
      throw new AppError('Chat not found or already ended', 404);
    }

    chat.status = 'ended';
    chat.endedAt = new Date();
    chat.endedBy = 'user';
    chat.messages.push({
      id: uuidv4(),
      sender: 'system',
      senderId: 'system',
      senderName: 'System',
      content: 'Chat ended by user.',
      createdAt: new Date()
    });

    await chat.save();

    // Notify agent via WebSocket
    if (chat.agentId) {
      webSocketService.broadcastToRoom(`chat:${chatId}`, {
        type: 'chat_ended',
        chatId,
        endedBy: 'user'
      });
    }

    // Notify agents queue updated
    webSocketService.broadcastToRoom('support-agents', {
      type: 'queue_updated'
    });

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/chat/:chatId/rate
 * Rate a chat session (user)
 */
router.post('/chat/:chatId/rate', authenticateToken, validate(rateChatSchema), async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user?.id;

    const chat = await SupportChat.findOne({
      chatId,
      userId,
      status: 'ended'
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    chat.rating = rating;
    chat.feedback = feedback;
    await chat.save();

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/chat/history
 * Get user's chat history
 */
router.get('/chat/history', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [chats, total] = await Promise.all([
      SupportChat.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      SupportChat.countDocuments({ userId })
    ]);

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/support/admin/chat/queue
 * Get chat queue (admin)
 */
router.get('/admin/chat/queue', authenticateToken, requireAdmin, async (_req: AuthRequest, res, next) => {
  try {
    const queue = await SupportChat.find({ status: 'queued' })
      .sort({ queuedAt: 1 })
      .lean();

    // Calculate wait times
    const queueWithWaitTime = queue.map((chat, index) => ({
      ...chat,
      queuePosition: index + 1,
      waitTime: chat.queuedAt ? Math.floor((Date.now() - new Date(chat.queuedAt).getTime()) / 1000) : 0
    }));

    res.json({
      success: true,
      data: { queue: queueWithWaitTime }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/admin/chat/active
 * Get all active chats (admin)
 */
router.get('/admin/chat/active', authenticateToken, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { agentId } = req.query;

    const query: any = { status: 'active' };
    if (agentId === 'me') {
      query.agentId = req.user?.id;
    } else if (agentId) {
      query.agentId = agentId;
    }

    const chats = await SupportChat.find(query)
      .sort({ startedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { chats }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/admin/chat/stats
 * Get chat statistics (admin)
 */
router.get('/admin/chat/stats', authenticateToken, requireAdmin, async (_req: AuthRequest, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      queueCount,
      activeCount,
      todayChats,
      avgRating,
      agentStats
    ] = await Promise.all([
      SupportChat.countDocuments({ status: 'queued' }),
      SupportChat.countDocuments({ status: 'active' }),
      SupportChat.countDocuments({ createdAt: { $gte: today } }),
      SupportChat.aggregate([
        { $match: { rating: { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]),
      SupportChat.aggregate([
        { $match: { agentId: { $exists: true } } },
        { 
          $group: { 
            _id: '$agentId', 
            agentName: { $first: '$agentName' },
            totalChats: { $sum: 1 },
            activeChats: { 
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } 
            }
          } 
        }
      ])
    ]);

    // Calculate average wait time for queued chats
    const queuedChats = await SupportChat.find({ status: 'queued' }).select('queuedAt').lean();
    const avgWaitTime = queuedChats.length > 0
      ? queuedChats.reduce((sum, chat) => {
          return sum + (chat.queuedAt ? (Date.now() - new Date(chat.queuedAt).getTime()) / 1000 : 0);
        }, 0) / queuedChats.length
      : 0;

    res.json({
      success: true,
      data: {
        queueCount,
        activeCount,
        todayChats,
        avgRating: avgRating[0]?.avgRating || 0,
        avgWaitTime: Math.floor(avgWaitTime),
        agentStats
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/admin/chat/:chatId/accept
 * Accept a chat from queue (admin)
 */
router.post('/admin/chat/:chatId/accept', authenticateToken, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const admin = req.user;

    if (!admin) {
      throw new AppError('Admin not authenticated', 401);
    }

    const chat = await SupportChat.findOne({
      chatId,
      status: 'queued'
    });

    if (!chat) {
      throw new AppError('Chat not found or already accepted', 404);
    }

    chat.status = 'active';
    chat.agentId = admin.id;
    chat.agentName = admin.name;
    chat.startedAt = new Date();
    chat.queuePosition = undefined;

    chat.messages.push({
      id: uuidv4(),
      sender: 'system',
      senderId: 'system',
      senderName: 'System',
      content: `${admin.name} has joined the chat.`,
      createdAt: new Date()
    });

    await chat.save();

    // Update queue positions for remaining chats
    await SupportChat.updateMany(
      { status: 'queued', queuedAt: { $gt: chat.queuedAt } },
      { $inc: { queuePosition: -1 } }
    );

    // Notify user via WebSocket
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'agent_joined',
      chatId,
      agentId: admin.id,
      agentName: admin.name
    });

    // Notify agents queue updated
    webSocketService.broadcastToRoom('support-agents', {
      type: 'queue_updated'
    });

    logger.info(`[Support Chat] Chat ${chatId} accepted by agent ${admin.email}`);

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/admin/chat/:chatId
 * Get chat details with user context (admin)
 */
router.get('/admin/chat/:chatId', authenticateToken, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;

    const chat = await SupportChat.findOne({ chatId }).lean();

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    // Get user info and recent tickets
    const [user, recentTickets, recentChats] = await Promise.all([
      User.findById(chat.userId).select('name email plan role createdAt lastLogin').lean(),
      SupportTicket.find({ userId: chat.userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('ticketNumber subject status createdAt')
        .lean(),
      SupportChat.find({ userId: chat.userId, chatId: { $ne: chatId } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('chatId status createdAt rating')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        chat,
        userContext: {
          user,
          recentTickets,
          recentChats
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/admin/chat/:chatId/message
 * Send a message in chat (admin)
 */
router.post('/admin/chat/:chatId/message', authenticateToken, requireAdmin, validate(sendMessageSchema), async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const { content, attachments } = req.body;
    const admin = req.user;

    if (!admin) {
      throw new AppError('Admin not authenticated', 401);
    }

    const chat = await SupportChat.findOne({
      chatId,
      status: 'active',
      agentId: admin.id
    });

    if (!chat) {
      throw new AppError('Chat not found or not assigned to you', 404);
    }

    const message = {
      id: uuidv4(),
      sender: 'agent' as const,
      senderId: admin.id,
      senderName: admin.name,
      content,
      attachments,
      createdAt: new Date()
    };

    chat.messages.push(message);
    await chat.save();

    // Broadcast message via WebSocket
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'new_message',
      message,
      chatId
    });

    res.json({
      success: true,
      data: { message }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/admin/chat/:chatId/transfer
 * Transfer chat to another agent (admin)
 */
router.post('/admin/chat/:chatId/transfer', authenticateToken, requireAdmin, validate(transferChatSchema), async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const { toAgentId, reason } = req.body;
    const admin = req.user;

    if (!admin) {
      throw new AppError('Admin not authenticated', 401);
    }

    const chat = await SupportChat.findOne({
      chatId,
      status: 'active',
      agentId: admin.id
    });

    if (!chat) {
      throw new AppError('Chat not found or not assigned to you', 404);
    }

    const newAgent = await User.findById(toAgentId).select('name email').lean();
    if (!newAgent) {
      throw new AppError('Target agent not found', 404);
    }

    // Add transfer record
    chat.transfers.push({
      id: uuidv4(),
      fromAgentId: admin.id,
      fromAgentName: admin.name,
      toAgentId,
      toAgentName: newAgent.name,
      reason,
      transferredAt: new Date()
    });

    chat.agentId = toAgentId;
    chat.agentName = newAgent.name;
    chat.status = 'transferred';

    chat.messages.push({
      id: uuidv4(),
      sender: 'system',
      senderId: 'system',
      senderName: 'System',
      content: `Chat transferred from ${admin.name} to ${newAgent.name}.${reason ? ` Reason: ${reason}` : ''}`,
      createdAt: new Date()
    });

    // Immediately set back to active for the new agent
    chat.status = 'active';

    await chat.save();

    // Notify via WebSocket
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'chat_transferred',
      chatId,
      fromAgent: { id: admin.id, name: admin.name },
      toAgent: { id: toAgentId, name: newAgent.name },
      reason
    });

    // Notify new agent
    webSocketService.broadcastToRoom(`agent:${toAgentId}`, {
      type: 'chat_assigned',
      chat
    });

    logger.info(`[Support Chat] Chat ${chatId} transferred from ${admin.email} to ${newAgent.email}`);

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/admin/chat/:chatId/end
 * End chat session (admin)
 */
router.post('/admin/chat/:chatId/end', authenticateToken, requireAdmin, validate(endChatSchema), async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const { reason } = req.body;
    const admin = req.user;

    if (!admin) {
      throw new AppError('Admin not authenticated', 401);
    }

    const chat = await SupportChat.findOne({
      chatId,
      status: { $in: ['queued', 'active'] }
    });

    if (!chat) {
      throw new AppError('Chat not found or already ended', 404);
    }

    chat.status = 'ended';
    chat.endedAt = new Date();
    chat.endedBy = 'agent';
    chat.endReason = reason;

    chat.messages.push({
      id: uuidv4(),
      sender: 'system',
      senderId: 'system',
      senderName: 'System',
      content: `Chat ended by ${admin.name}.${reason ? ` Reason: ${reason}` : ''}`,
      createdAt: new Date()
    });

    await chat.save();

    // Notify user via WebSocket
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'chat_ended',
      chatId,
      endedBy: 'agent',
      reason
    });

    // Notify agents queue updated
    webSocketService.broadcastToRoom('support-agents', {
      type: 'queue_updated'
    });

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/admin/chat/:chatId/create-ticket
 * Create a ticket from chat (admin)
 */
router.post('/admin/chat/:chatId/create-ticket', authenticateToken, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const { subject, category, priority } = req.body;
    const admin = req.user;

    if (!admin) {
      throw new AppError('Admin not authenticated', 401);
    }

    const chat = await SupportChat.findOne({ chatId });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    // Create ticket from chat
    const ticket = new SupportTicket({
      userId: chat.userId,
      userName: chat.userName,
      userEmail: chat.userEmail,
      subject: subject || `Follow-up from chat ${chat.chatId}`,
      description: `Ticket created from live chat session.\n\nChat transcript:\n${chat.messages.map(m => `[${m.senderName}]: ${m.content}`).join('\n')}`,
      category: category || 'general',
      priority: priority || 'medium',
      assignedTo: admin.id,
      assignedToName: admin.name,
      messages: [{
        id: uuidv4(),
        sender: 'system',
        senderId: 'system',
        senderName: 'System',
        content: `This ticket was created from live chat session ${chat.chatId}`,
        createdAt: new Date()
      }],
      history: [{
        id: uuidv4(),
        action: 'created_from_chat',
        performedBy: admin.id,
        performedByName: admin.name,
        details: `Ticket created from chat ${chat.chatId}`,
        createdAt: new Date()
      }],
      metadata: {
        createdFromChat: true,
        originalChatId: chat.chatId
      }
    });

    await ticket.save();

    // Link ticket to chat
    chat.relatedTicketId = ticket._id?.toString();
    await chat.save();

    logger.info(`[Support] Ticket ${ticket.ticketNumber} created from chat ${chatId} by admin ${admin.email}`);

    res.status(201).json({
      success: true,
      data: { ticket }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/admin/chat/history
 * Get chat history (admin)
 */
router.get('/admin/chat/history', authenticateToken, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { 
      agentId, 
      userId, 
      status,
      startDate,
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;

    const query: any = {};
    if (agentId) query.agentId = agentId === 'me' ? req.user?.id : agentId;
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [chats, total] = await Promise.all([
      SupportChat.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      SupportChat.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/admin/agents
 * Get available support agents (admin)
 */
router.get('/admin/agents', authenticateToken, requireAdmin, async (_req: AuthRequest, res, next) => {
  try {
    // Get all admins/superadmins as potential support agents
    const agents = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      isActive: true
    }).select('name email role lastLogin').lean();

    // Get active chat counts per agent
    const activeChatCounts = await SupportChat.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$agentId', count: { $sum: 1 } } }
    ]);

    const chatCountMap = activeChatCounts.reduce((acc: any, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    const agentsWithStats = agents.map(agent => ({
      ...agent,
      activeChats: chatCountMap[agent._id?.toString()] || 0
    }));

    res.json({
      success: true,
      data: { agents: agentsWithStats }
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ==================== BACKGROUND TASKS ENDPOINTS ====================

/**
 * GET /api/support/admin/tasks
 * Get all background tasks (admin)
 */
router.get('/admin/tasks', authenticateToken, requireAdmin, async (_req: AuthRequest, res, next) => {
  try {
    const tasks = aiSupportAgent.getPendingTasks();
    
    res.json({
      success: true,
      data: { tasks }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/support/admin/tasks/:taskId
 * Update a background task (admin)
 */
router.put('/admin/tasks/:taskId', authenticateToken, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { taskId } = req.params;
    const { status, result, assignedTo, assignedToName } = req.body;
    const admin = req.user;

    if (!admin) {
      throw new AppError('Admin not authenticated', 401);
    }

    const task = await aiSupportAgent.updateBackgroundTask(taskId, {
      status,
      result,
      assignedTo: assignedTo || admin.id,
      assignedToName: assignedToName || admin.name,
      completedAt: status === 'completed' ? new Date() : undefined
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    logger.info(`[Support] Task ${taskId} updated by admin ${admin.email}: ${status}`);

    res.json({
      success: true,
      data: { task }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/admin/chat/:chatId/escalate
 * Manually escalate AI chat to human (admin can also trigger this)
 */
router.post('/admin/chat/:chatId/escalate', authenticateToken, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { chatId } = req.params;
    const { reason } = req.body;
    const admin = req.user;

    if (!admin) {
      throw new AppError('Admin not authenticated', 401);
    }

    const chat = await SupportChat.findOne({
      chatId,
      status: 'ai_active'
    });

    if (!chat) {
      throw new AppError('AI chat not found or already escalated', 404);
    }

    // Escalate to human queue
    chat.status = 'queued';
    chat.queuedAt = new Date();
    chat.agentId = undefined;
    chat.agentName = undefined;
    if (!chat.metadata) chat.metadata = {};
    chat.metadata.escalationReason = reason || 'Manual escalation by admin';
    chat.metadata.escalatedByAdmin = admin.id;

    const queueCount = await SupportChat.countDocuments({ status: 'queued' });
    chat.queuePosition = queueCount + 1;

    chat.messages.push({
      id: uuidv4(),
      sender: 'system',
      senderId: 'system',
      senderName: 'System',
      content: 'This chat has been escalated to a human support agent.',
      createdAt: new Date()
    });

    await chat.save();

    // Notify user
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'escalated_to_human',
      chatId,
      queuePosition: chat.queuePosition
    });

    // Notify agents
    webSocketService.broadcastToRoom('support-agents', {
      type: 'escalated_chat',
      chat: {
        chatId: chat.chatId,
        userName: chat.userName,
        userEmail: chat.userEmail,
        queuePosition: chat.queuePosition,
        escalationReason: chat.metadata.escalationReason
      }
    });

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/admin/chat/ai-stats
 * Get AI support statistics (admin)
 */
router.get('/admin/chat/ai-stats', authenticateToken, requireAdmin, async (_req: AuthRequest, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      aiActiveCount,
      aiResolvedToday,
      escalatedToday,
      avgAIConfidence,
      taskStats
    ] = await Promise.all([
      SupportChat.countDocuments({ status: 'ai_active' }),
      SupportChat.countDocuments({ 
        'metadata.resolvedByAI': true,
        updatedAt: { $gte: today }
      }),
      SupportChat.countDocuments({ 
        'metadata.escalatedFromAI': true,
        'metadata.escalatedAt': { $gte: today }
      }),
      SupportChat.aggregate([
        { $match: { 'metadata.aiConfidence': { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$metadata.aiConfidence' } } }
      ]),
      Promise.resolve(aiSupportAgent.getPendingTasks())
    ]);

    const pendingTasks = taskStats.filter(t => t.status === 'pending').length;
    const inProgressTasks = taskStats.filter(t => t.status === 'in_progress').length;

    res.json({
      success: true,
      data: {
        aiActiveChats: aiActiveCount,
        aiResolvedToday,
        escalatedToday,
        avgAIConfidence: avgAIConfidence[0]?.avg || 0,
        pendingTasks,
        inProgressTasks,
        totalBackgroundTasks: taskStats.length
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;

