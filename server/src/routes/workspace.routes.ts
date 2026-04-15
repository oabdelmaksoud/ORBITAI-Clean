import { Router } from 'express';
import { Workspace } from '../models/Workspace.model';
import { WorkspaceInvite } from '../models/WorkspaceInvite.model';
import { authenticateToken } from '../middleware/auth';
import { Types } from 'mongoose';

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
    const userId = req.user._id;

    // Check if slug already exists
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Workspace.findOne({ slug });
    
    if (existing) {
      return res.status(400).json({ error: 'Workspace with this name already exists' });
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
    console.error('Create workspace error:', error);
    res.status(500).json({ error: error.message || 'Failed to create workspace' });
  }
});

/**
 * GET /api/workspaces
 * List user's workspaces
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;

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
    console.error('List workspaces error:', error);
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
    const userId = req.user._id;

    const workspace = await Workspace.findById(id)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .populate('projects');

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user has access
    if (!workspace.hasMember(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(workspace);
  } catch (error: any) {
    console.error('Get workspace error:', error);
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
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is owner or admin
    const role = workspace.getMemberRole(userId);
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can update workspace' });
    }

    // Update fields
    if (name) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (settings) workspace.settings = { ...workspace.settings, ...settings };

    await workspace.save();

    res.json(workspace);
  } catch (error: any) {
    console.error('Update workspace error:', error);
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
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is owner
    if (!workspace.owner.equals(userId)) {
      return res.status(403).json({ error: 'Only the owner can delete workspace' });
    }

    // Soft delete
    workspace.isActive = false;
    await workspace.save();

    res.json({ message: 'Workspace deleted successfully' });
  } catch (error: any) {
    console.error('Delete workspace error:', error);
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
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user can invite
    const userRole = workspace.getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }

    // Create invitation
    const invitation = new WorkspaceInvite({
      workspace: workspace._id,
      email,
      role: role || 'member',
      inviter: userId,
      message,
      expiresAt: WorkspaceInvite.generateExpirationDate()
    });

    await invitation.save();

    // TODO: Send invitation email

    res.status(201).json(invitation);
  } catch (error: any) {
    console.error('Invite member error:', error);
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
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user can remove members
    const userRole = workspace.getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can remove members' });
    }

    // Can't remove owner
    if (workspace.owner.equals(new Types.ObjectId(memberId))) {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    await workspace.removeMember(new Types.ObjectId(memberId));

    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    console.error('Remove member error:', error);
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
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is owner
    if (!workspace.owner.equals(userId)) {
      return res.status(403).json({ error: 'Only the owner can change member roles' });
    }

    // Can't change owner role
    if (workspace.owner.equals(new Types.ObjectId(memberId))) {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    await workspace.updateMemberRole(new Types.ObjectId(memberId), role);

    res.json({ message: 'Member role updated successfully' });
  } catch (error: any) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: error.message || 'Failed to update member role' });
  }
});

export default router;
