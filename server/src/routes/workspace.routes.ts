import { Router } from 'express';
import { Workspace } from '../models/Workspace.model';
import { WorkspaceInvite } from '../models/WorkspaceInvite.model';
import { authenticateToken } from '../middleware/auth';
import { Types } from 'mongoose';
import { logger } from '../utils/logger.js';
import { sendInvitationEmail } from '../services/email.service.js';
import { config } from '../config/env.js';

const router = Router();

// All workspace routes require authentication
router.use(authenticateToken);

/**
 * POST /api/workspaces
 * Create a new workspace
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    const userId = ((req as any).user)._id;

    // Check if slug already exists
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Workspace.findOne({ slug });
    
    if (existing) {
      res.status(400).json({ error: 'Workspace with this name already exists' });
      return;
    }

    // Create workspace
    const workspace = new Workspace({
      name,
      slug,
      description,
      owner: userId,
      members: [{
        user: userId,
        role: 'owner',
        joinedAt: new Date(),
        invitedBy: userId,
        permissions: []
      }],
      settings: settings || {}
    });

    await workspace.save();

    res.status(201).json(workspace);
  } catch (error: any) {
    logger.error('Create workspace error:', error);
    res.status(500).json({ error: error.message || 'Failed to create workspace' });
  }
});

/**
 * GET /api/workspaces
 * List user's workspaces
 */
router.get('/', async (req, res) => {
  try {
    const userId = ((req as any).user)._id;

    const workspaces = await Workspace.find({
      $or: [
        { owner: userId },
        { 'members.user': userId }
      ],
      isActive: true
    })
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .sort({ updatedAt: -1 });

    res.json(workspaces);
  } catch (error: any) {
    logger.error('List workspaces error:', error);
    res.status(500).json({ error: error.message || 'Failed to list workspaces' });
  }
});

/**
 * GET /api/workspaces/:id
 * Get workspace details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = ((req as any).user)._id;

    const workspace = await Workspace.findById(id)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .populate('projects');

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user has access
    if (!((workspace as any).hasMember)(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(workspace);
  } catch (error: any) {
    logger.error('Get workspace error:', error);
    res.status(500).json({ error: error.message || 'Failed to get workspace' });
  }
});

/**
 * PUT /api/workspaces/:id
 * Update workspace
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, settings } = req.body;
    const userId = ((req as any).user)._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user is owner or admin
    const role = ((workspace as any).getMemberRole)(userId);
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can update workspace' });
      return;
    }

    // Update fields
    if (name) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (settings) workspace.settings = { ...workspace.settings, ...settings };

    await workspace.save();

    res.json(workspace);
  } catch (error: any) {
    logger.error('Update workspace error:', error);
    res.status(500).json({ error: error.message || 'Failed to update workspace' });
  }
});

/**
 * DELETE /api/workspaces/:id
 * Delete workspace
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = ((req as any).user)._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user is owner
    if (!workspace.owner.equals(userId)) {
      res.status(403).json({ error: 'Only the owner can delete workspace' });
      return;
    }

    // Soft delete
    workspace.isActive = false;
    await workspace.save();

    res.json({ message: 'Workspace deleted successfully' });
  } catch (error: any) {
    logger.error('Delete workspace error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete workspace' });
  }
});

/**
 * POST /api/workspaces/:id/members
 * Add member to workspace (invite)
 */
router.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, message } = req.body;
    const userId = ((req as any).user)._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user can invite
    const userRole = ((workspace as any).getMemberRole)(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can invite members' });
      return;
    }

    // Create invitation
    const invitation = new WorkspaceInvite({
      workspace: workspace._id,
      email,
      role: role || 'member',
      inviter: userId,
      message,
      expiresAt: ((WorkspaceInvite as any).generateExpirationDate)()
    });

    await invitation.save();

    // Send invitation email (fire-and-forget — don't fail the invite if email fails)
    const inviterUser = (req as any).user;
    const inviterName = inviterUser?.name || inviterUser?.username || inviterUser?.email || 'A teammate';
    sendInvitationEmail({
      to: email,
      inviterName,
      workspaceName: (workspace as any).name || 'the workspace',
      invitationToken: (invitation as any).token,
      frontendUrl: config.frontendUrl,
      message,
    }).catch((emailErr: Error) => {
      logger.warn('Failed to send workspace invitation email', { error: emailErr.message, to: email });
    });

    res.status(201).json(invitation);
  } catch (error: any) {
    logger.error('Invite member error:', error);
    res.status(500).json({ error: error.message || 'Failed to invite member' });
  }
});

/**
 * DELETE /api/workspaces/:id/members/:memberId
 * Remove member from workspace
 */
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = ((req as any).user)._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user can remove members
    const userRole = ((workspace as any).getMemberRole)(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can remove members' });
      return;
    }

    // Can't remove owner
    if (workspace.owner.equals(new Types.ObjectId(memberId))) {
      res.status(400).json({ error: 'Cannot remove workspace owner' });
      return;
    }

    await ((workspace as any).removeMember)(new Types.ObjectId(memberId));

    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    logger.error('Remove member error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove member' });
  }
});

/**
 * PUT /api/workspaces/:id/members/:memberId
 * Update member role
 */
router.put('/:id/members/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;
    const userId = ((req as any).user)._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user is owner
    if (!workspace.owner.equals(userId)) {
      res.status(403).json({ error: 'Only the owner can change member roles' });
      return;
    }

    // Can't change owner role
    if (workspace.owner.equals(new Types.ObjectId(memberId))) {
      res.status(400).json({ error: 'Cannot change owner role' });
      return;
    }

    await ((workspace as any).updateMemberRole)(new Types.ObjectId(memberId), role);

    res.json({ message: 'Member role updated successfully' });
  } catch (error: any) {
    logger.error('Update member role error:', error);
    res.status(500).json({ error: error.message || 'Failed to update member role' });
  }
});

export default router;
