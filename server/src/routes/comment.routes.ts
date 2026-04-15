import { Router } from 'express';
import { Comment } from '../models/Comment.model';
import { Notification } from '../models/Notification.model';
import { authenticateToken } from '../middleware/auth';
import { Types } from 'mongoose';
import { logger } from '../utils/logger.js';

const router = Router();

// All comment routes require authentication
router.use(authenticateToken);

/**
 * POST /api/comments
 * Create a new comment
 */
router.post('/', async (req, res) => {
  try {
    const { workspace, project, resourceType, resourceId, content, parentComment } = req.body;
    const userId = (req as any).user._id;

    // Create comment
    const comment = new Comment({
      workspace,
      project,
      resourceType,
      resourceId,
      parentComment,
      author: userId,
      content,
      mentions: [], // TODO: Extract mentions from content
    });

    await comment.save();

    // Populate author
    await comment.populate('author', 'name avatar');

    // TODO: Create notifications for mentioned users

    res.status(201).json(comment);
  } catch (error: any) {
    logger.error('Create comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create comment' });
  }
});

/**
 * GET /api/comments
 * Get comments for a resource
 */
router.get('/', async (req, res) => {
  try {
    const { resourceType, resourceId, parentComment } = req.query;

    const query: any = {};

    if (resourceType) query.resourceType = resourceType;
    if (resourceId) query.resourceId = resourceId;
    if (parentComment !== undefined) {
      query.parentComment = parentComment === 'null' ? null : parentComment;
    }

    query.isDeleted = false;

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .populate('author', 'name avatar')
      .populate('reactions.user', 'name avatar');

    res.json(comments);
  } catch (error: any) {
    logger.error('Get comments error:', error);
    res.status(500).json({ error: error.message || 'Failed to get comments' });
  }
});

/**
 * GET /api/comments/:id
 * Get comment details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id)
      .populate('author', 'name avatar')
      .populate('reactions.user', 'name avatar');

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.isDeleted) {
      res.status(410).json({ error: 'Comment has been deleted' });
      return;
    }

    res.json(comment);
  } catch (error: any) {
    logger.error('Get comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to get comment' });
  }
});

/**
 * PUT /api/comments/:id
 * Update comment
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if user is author
    if (!comment.author.equals(userId)) {
      res.status(403).json({ error: 'Only the author can edit comment' });
      return;
    }

    if (comment.isDeleted) {
      res.status(400).json({ error: 'Cannot edit deleted comment' });
      return;
    }

    comment.content = content;
    comment.isEdited = true;
    await comment.save();

    res.json(comment);
  } catch (error: any) {
    logger.error('Update comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to update comment' });
  }
});

/**
 * DELETE /api/comments/:id
 * Delete comment (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if user is author or admin
    if (!comment.author.equals(userId)) {
      res.status(403).json({ error: 'Only the author can delete comment' });
      return;
    }

    await (comment as any).softDelete();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error: any) {
    logger.error('Delete comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete comment' });
  }
});

/**
 * POST /api/comments/:id/reply
 * Reply to comment
 */
router.post('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = (req as any).user._id;

    const parentComment = await Comment.findById(id);

    if (!parentComment) {
      res.status(404).json({ error: 'Parent comment not found' });
      return;
    }

    // Create reply
    const reply = new Comment({
      workspace: parentComment.workspace,
      project: parentComment.project,
      resourceType: parentComment.resourceType,
      resourceId: parentComment.resourceId,
      parentComment: parentComment._id,
      author: userId,
      content,
      mentions: [], // TODO: Extract mentions
    });

    await reply.save();
    await reply.populate('author', 'name avatar');

    // Create notification for parent comment author
    if (!parentComment.author.equals(userId)) {
      await (Notification as any).createNotification(
        parentComment.author,
        'reply',
        'New reply to your comment',
        `${(req as any).user.name} replied to your comment`,
        {
          resourceType: 'comment',
          resourceId: reply._id,
          actor: userId,
        }
      );
    }

    res.status(201).json(reply);
  } catch (error: any) {
    logger.error('Reply to comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to reply to comment' });
  }
});

/**
 * POST /api/comments/:id/reactions
 * Add reaction to comment
 */
router.post('/:id/reactions', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    await (comment as any).addReaction(userId, type);

    res.json(comment);
  } catch (error: any) {
    logger.error('Add reaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to add reaction' });
  }
});

/**
 * DELETE /api/comments/:id/reactions
 * Remove reaction from comment
 */
router.delete('/:id/reactions', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    await (comment as any).removeReaction(userId);

    res.json(comment);
  } catch (error: any) {
    logger.error('Remove reaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove reaction' });
  }
});

/**
 * PUT /api/comments/:id/resolve
 * Mark comment as resolved
 */
router.put('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.isResolved) {
      await (comment as any).unresolve();
    } else {
      await (comment as any).resolve(userId);
    }

    res.json(comment);
  } catch (error: any) {
    logger.error('Resolve comment error:', error);
    res.status(500).json({ error: error.message || 'Failed to resolve comment' });
  }
});

/**
 * GET /api/comments/:id/thread
 * Get comment thread (all replies)
 */
router.get('/:id/thread', async (req, res) => {
  try {
    const { id } = req.params;

    const replies = await (Comment as any).getThreadReplies(new Types.ObjectId(id));

    res.json(replies);
  } catch (error: any) {
    logger.error('Get thread error:', error);
    res.status(500).json({ error: error.message || 'Failed to get thread' });
  }
});

export default router;
