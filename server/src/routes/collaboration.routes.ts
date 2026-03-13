/**
 * Collaboration Routes
 * Real-time collaboration features for projects
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { Project } from '../models/Project.model.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/collaboration/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Collaboration service is running' });
});

/**
 * GET /api/collaboration/project/:projectId/participants
 * Get project participants
 */
router.get('/project/:projectId/participants', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { userId },
        { 'collaborators.userId': userId }
      ]
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const participants = [
      {
        userId: project.userId,
        role: 'owner',
        joinedAt: project.created
      },
      ...(project.collaborators || []).map((collab: any) => ({
        userId: collab.userId,
        role: collab.role || 'collaborator',
        joinedAt: collab.joinedAt
      }))
    ];

    res.json({
      success: true,
      data: {
        participants
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/collaboration/project/:projectId/invite
 * Invite user to collaborate on project
 */
router.post('/project/:projectId/invite', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const { email, role } = req.body;
    const userId = req.user!.id;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const project = await Project.findOne({
      _id: projectId,
      userId // Only owner can invite
    });

    if (!project) {
      throw new AppError('Project not found or you do not have permission', 404);
    }

    // Check if user is already a collaborator
    const existingCollaborator = project.collaborators?.find(
      (collab: any) => collab.email === email
    );

    if (existingCollaborator) {
      return res.json({
        success: false,
        message: 'User is already a collaborator'
      });
    }

    // Add collaborator
    if (!project.collaborators) {
      project.collaborators = [];
    }

    project.collaborators.push({
      email,
      role: role || 'collaborator',
      invitedBy: userId,
      invitedAt: new Date(),
      status: 'pending'
    });

    project.lastModified = new Date();
    await project.save();

    // In production, send invitation email here

    res.json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        collaborator: {
          email,
          role: role || 'collaborator',
          status: 'pending'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/collaboration/project/:projectId/remove/:email
 * Remove collaborator from project
 */
router.delete('/project/:projectId/remove/:email', async (req: AuthRequest, res, next) => {
  try {
    const { projectId, email } = req.params;
    const userId = req.user!.id;

    const project = await Project.findOne({
      _id: projectId,
      userId // Only owner can remove
    });

    if (!project) {
      throw new AppError('Project not found or you do not have permission', 404);
    }

    if (!project.collaborators) {
      return res.json({
        success: true,
        message: 'No collaborators to remove'
      });
    }

    const initialLength = project.collaborators.length;
    project.collaborators = project.collaborators.filter(
      (collab: any) => collab.email !== email
    );

    if (project.collaborators.length === initialLength) {
      return res.json({
        success: false,
        message: 'Collaborator not found'
      });
    }

    project.lastModified = new Date();
    await project.save();

    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/collaboration/project/:projectId/activity
 * Get project activity log
 */
router.get('/project/:projectId/activity', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;
    const { limit = 50 } = req.query;

    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { userId },
        { 'collaborators.userId': userId }
      ]
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // In production, this would query a separate ActivityLog collection
    // For now, return basic activity based on project metadata
    const activity = [
      {
        id: '1',
        type: 'project_created',
        userId: project.userId,
        timestamp: project.created,
        description: 'Project created'
      },
      {
        id: '2',
        type: 'project_modified',
        userId: project.userId,
        timestamp: project.lastModified,
        description: 'Project last modified'
      }
    ];

    res.json({
      success: true,
      data: {
        activity: activity.slice(0, parseInt(limit as string))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/collaboration/project/:projectId/comment
 * Add comment to project
 */
router.post('/project/:projectId/comment', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const { comment, taskId } = req.body;
    const userId = req.user!.id;

    if (!comment) {
      throw new AppError('Comment is required', 400);
    }

    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { userId },
        { 'collaborators.userId': userId }
      ]
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // In production, store comments in a separate collection
    // For now, just log the comment
    logger.info(`Comment added to project ${projectId} by user ${userId}: ${comment}`);

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: {
          id: Math.random().toString(36).substring(7),
          userId,
          comment,
          taskId,
          timestamp: new Date()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
