import express, { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ProjectFolderService } from '../services/projectFolder.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/project-folders
 * Create a new project folder
 */
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { name, description, platforms, metadata } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Folder name is required', 400);
    }

    const folder = await ProjectFolderService.createFolder({
      userId,
      name: name.trim(),
      description: description?.trim(),
      platforms,
      metadata
    });

    res.status(201).json({
      success: true,
      data: { folder }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/project-folders
 * Get all folders for the authenticated user
 */
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const folders = await ProjectFolderService.getFoldersByUserId(userId);

    res.json({
      success: true,
      data: { folders }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/project-folders/:id
 * Get a specific folder with its conversations
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { id } = req.params;
    const folder = await ProjectFolderService.getFolderById(id, userId);

    if (!folder) {
      throw new AppError('Folder not found', 404);
    }

    res.json({
      success: true,
      data: { folder }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/project-folders/:id
 * Update a folder
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { id } = req.params;
    const { name, description, platforms, metadata } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (platforms !== undefined) updates.platforms = platforms;
    if (metadata !== undefined) updates.metadata = metadata;

    const folder = await ProjectFolderService.updateFolder(id, userId, updates);

    if (!folder) {
      throw new AppError('Folder not found', 404);
    }

    res.json({
      success: true,
      data: { folder }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/project-folders/:id
 * Delete a folder (moves conversations to Unorganized)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { id } = req.params;
    const hardDelete = req.query.hardDelete === 'true';

    await ProjectFolderService.deleteFolder(id, userId, hardDelete);

    res.json({
      success: true,
      message: hardDelete ? 'Folder and contents deleted successfully' : 'Folder deleted successfully'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/project-folders/:id/conversations/:conversationId
 * Add a conversation to a folder
 */
router.post('/:id/conversations/:conversationId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { id: folderId, conversationId } = req.params;
    await ProjectFolderService.addConversationToFolder(folderId, conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation added to folder'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/project-folders/:id/conversations/:conversationId
 * Remove a conversation from a folder (moves to Unorganized)
 */
router.delete('/:id/conversations/:conversationId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { id: folderId, conversationId } = req.params;
    await ProjectFolderService.removeConversationFromFolder(folderId, conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation removed from folder'
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

