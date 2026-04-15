import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ChatConversation } from '../models/ChatConversation.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const createConversationSchema = z.object({
  projectId: z.string().optional(),
  folderId: z.string().optional(),
  type: z.enum(['setup', 'workspace', 'agent', 'neural-chat']),
  initialMessage: z.object({
    id: z.string(),
    sender: z.enum(['user', 'system', 'agent']),
    text: z.string(),
    timestamp: z.number()
  }).optional(),
  messages: z.array(z.object({
    id: z.string(),
    sender: z.enum(['user', 'system', 'agent']),
    text: z.string(),
    timestamp: z.number(),
    agentId: z.string().optional(),
    isLogEvent: z.boolean().optional(),
    mindmapText: z.string().optional(),
    attachments: z.array(z.object({
      name: z.string(),
      type: z.string(),
      content: z.string()
    })).optional()
  })).optional()
}).strict();

const addMessageSchema = z.object({
  message: z.object({
    id: z.string(),
    sender: z.enum(['user', 'system', 'agent']),
    text: z.string(),
    timestamp: z.number()
  }),
  answers: z.record(z.any()).optional(),
  summary: z.string().optional(),
  metadata: z.record(z.any()).optional()
}).strict();

const updateAnswersSchema = z.object({
  answers: z.record(z.any()),
  summary: z.string().optional(),
  metadata: z.record(z.any()).optional()
}).strict();

const updateNeuralChatSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    sender: z.enum(['user', 'system', 'agent']),
    text: z.string(),
    timestamp: z.number()
  })).optional(),
  topic: z.string().optional(),
  ideas: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    parentId: z.string().nullable().optional(),
    relevance: z.string().optional(),
    priority: z.number().min(1).max(5).optional(),
    category: z.enum(['feature', 'constraint', 'opportunity', 'risk', 'requirement', 'improvement', 'idea', 'other', 'ux', 'technology', 'data', 'architecture', 'component', 'business', 'community', 'platform']).optional(),
    notes: z.string().optional(),
    connections: z.array(z.string()).optional(),
    state: z.enum(['new', 'developing', 'refined', 'merged']).optional(),
    tags: z.array(z.string()).optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional()
  })).optional(),
  keyInsights: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  prototypingStage: z.enum(['ideation', 'prototyping']).optional(),
  currentStage: z.enum(['ideation', 'prototyping', 'launched']).optional(),
  projectPreview: z.object({
    summary: z.string().optional(),
    techStack: z.array(z.string()).optional(),
    wireframeCode: z.string().optional(),
    architectureDiagram: z.string().optional(),
    risks: z.array(z.string()).optional(),
    recommendedMethodology: z.enum(['V-Model', 'Agile', 'Waterfall', 'Spiral', 'DevOps', 'Iterative', 'Prototyping', 'RAD', 'Scrum', 'Lean', 'ASD']).optional(),
    recommendedStandards: z.array(z.string()).optional(),
    estimatedSprints: z.number().optional(),
    projectName: z.string().optional(),
    mobileCode: z.object({
      reactNative: z.string().optional(),
      flutter: z.string().optional(),
      iosSwift: z.string().optional(),
      androidKotlin: z.string().optional()
    }).optional()
  }).optional(),
  activeIdeaId: z.string().nullable().optional(),
  glassPanelActiveView: z.enum(['context', 'history', 'maturity']).optional(),
  projectId: z.string().optional() // Link conversation to project
}).strict();

/**
 * POST /api/chat/conversations
 * Create a new chat conversation
 */
router.post('/conversations', authenticateToken, validate(createConversationSchema), async (req: AuthRequest, res, next) => {
  try {
    const { projectId, folderId, type, initialMessage, messages } = req.body;
    const userId = req.user?.id;

    let finalFolderId = folderId;

    // Skip folder creation for guest users (guest userId is a string, not ObjectId)
    const isGuestUser = userId === 'guest';

    // If no folderId provided, ensure default folder exists and use it (skip for guests)
    if (!finalFolderId && userId && !isGuestUser) {
      const { ProjectFolderService } = await import('../services/projectFolder.service.js');
      const defaultFolder = await ProjectFolderService.getOrCreateDefaultFolder(userId);
      finalFolderId = defaultFolder?._id?.toString();
    }

    // Determine initial messages: use 'messages' array if provided, otherwise fallback to 'initialMessage'
    let conversationMessages: any[] = [];
    if (messages && messages.length > 0) {
      conversationMessages = messages;
    } else if (initialMessage) {
      conversationMessages = [initialMessage];
    }

    const conversation = new ChatConversation({
      userId,
      projectId,
      folderId: finalFolderId,
      type,
      messages: conversationMessages,
      answers: {},
      metadata: {}
    });

    await conversation.save();

    // Add conversation to folder's conversationIds if folderId is set (skip for guests)
    if (finalFolderId && userId && !isGuestUser) {
      try {
        const { ProjectFolderService } = await import('../services/projectFolder.service.js');
        await ProjectFolderService.addConversationToFolder(finalFolderId, conversation._id.toString(), userId);
      } catch (folderError) {
        // Log but don't fail conversation creation if folder update fails
        logger.warn('Failed to add conversation to folder:', folderError);
      }
    }

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations
 * Get conversations for user/project
 */
router.get('/conversations', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const { projectId, type } = req.query;

    // Ensure default folder exists for user (skip for guests)
    const isGuestUser = userId === 'guest';
    if (userId && !isGuestUser) {
      try {
        const { ProjectFolderService } = await import('../services/projectFolder.service.js');
        await ProjectFolderService.ensureDefaultFolder(userId);
      } catch (folderError) {
        // Log but don't fail if folder creation fails
        logger.warn('Failed to ensure default folder:', folderError);
      }
    }

    const query: any = {};
    if (userId) query.userId = userId;
    if (projectId) query.projectId = projectId;
    if (type) query.type = type;

    const conversations = await ChatConversation.find(query, {
      _id: 1,
      userId: 1,
      projectId: 1,
      folderId: 1,
      type: 1,
      // Keep only last 5 messages for preview generation
      messages: { $slice: -5 },
      answers: 1,
      summary: 1,
      // Include metadata but exclude heavy fields if possible (though we need topic/preview)
      metadata: 1,
      createdAt: 1,
      updatedAt: 1
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: { conversations }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations/:id
 * Get a specific conversation
 */
router.get('/conversations/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const conversation = await ChatConversation.findOne({
      _id: id,
      userId
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/chat/conversations/:id/messages
 * Add a message to a conversation
 */
router.post('/conversations/:id/messages', authenticateToken, validate(addMessageSchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { message, answers, summary, metadata } = req.body;
    const userId = req.user?.id;

    const conversation = await ChatConversation.findOne({
      _id: id,
      userId
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    conversation.messages.push(message);
    if (answers) conversation.answers = { ...conversation.answers, ...answers };
    if (summary) conversation.summary = summary;
    if (metadata) conversation.metadata = { ...conversation.metadata, ...metadata };

    await conversation.save();

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/chat/conversations/:id/answers
 * Update answers and summary (for guided chat wizard)
 */
router.put('/conversations/:id/answers', authenticateToken, validate(updateAnswersSchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { answers, summary, metadata } = req.body;
    const userId = req.user?.id;

    const conversation = await ChatConversation.findOne({
      _id: id,
      userId
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    conversation.answers = { ...conversation.answers, ...answers };
    if (summary) conversation.summary = summary;
    if (metadata) conversation.metadata = { ...conversation.metadata, ...metadata };

    await conversation.save();

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/chat/conversations/:id/neural-chat
 * Update full NeuralStreamChat conversation state
 */
router.put('/conversations/:id/neural-chat', authenticateToken, validate(updateNeuralChatSchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { messages, topic, ideas, keyInsights, nextSteps, prototypingStage, currentStage, projectPreview, activeIdeaId, glassPanelActiveView, projectId } = req.body;
    const userId = req.user?.id;

    const conversation = await ChatConversation.findOne({
      _id: id,
      userId
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Update messages if provided
    if (messages) {
      conversation.messages = messages;
    }

    // Update projectId if provided (links conversation to project)
    if (projectId !== undefined) {
      conversation.projectId = projectId;
    }

    conversation.metadata = {
      ...conversation.metadata,
      topic,
      ideas,
      keyInsights,
      nextSteps,
      prototypingStage,
      currentStage, // Save current stage
      projectPreview,
      activeIdeaId,
      glassPanelActiveView
    };

    await conversation.save();

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/chat/conversations/:id/folder
 * Move a conversation to a folder
 */
router.put('/conversations/:id/folder', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const conversation = await ChatConversation.findOne({
      _id: id,
      userId
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // If folderId is null/undefined, move to default folder
    let targetFolderId = folderId;
    if (!targetFolderId) {
      const { ProjectFolderService } = await import('../services/projectFolder.service.js');
      const defaultFolder = await ProjectFolderService.getOrCreateDefaultFolder(userId);
      targetFolderId = defaultFolder?._id?.toString();
    }

    // Remove from old folder if it exists
    if (conversation.folderId) {
      try {
        const { ProjectFolderService } = await import('../services/projectFolder.service.js');
        await ProjectFolderService.removeConversationFromFolder(
          conversation.folderId,
          id,
          userId
        );
      } catch (error: unknown) {
        // Log but continue
        logger.warn('Failed to remove conversation from old folder:', error);
      }
    }

    // Add to new folder
    const { ProjectFolderService } = await import('../services/projectFolder.service.js');
    await ProjectFolderService.addConversationToFolder(targetFolderId, id, userId);

    // Update conversation's folderId
    conversation.folderId = targetFolderId;
    await conversation.save();

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const conversation = await ChatConversation.findOne({
      _id: id,
      userId
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Remove from folder if it exists
    if (conversation.folderId) {
      try {
        const { ProjectFolderService } = await import('../services/projectFolder.service.js');
        await ProjectFolderService.removeConversationFromFolder(
          conversation.folderId,
          id,
          userId as string
        );
      } catch (error: unknown) {
        // Log but continue with deletion
        logger.warn('Failed to remove conversation from folder:', error);
      }
    }

    await ChatConversation.findOneAndDelete({
      _id: id,
      userId
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    res.json({
      success: true,
      message: 'Conversation deleted'
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;




