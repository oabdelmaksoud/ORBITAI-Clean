import { Router } from 'express';
import { WorkspaceInvite } from '../models/WorkspaceInvite.model';
import { Workspace } from '../models/Workspace.model';
import { User } from '../models/User.model';
import { authenticateToken, authenticateTokenOptional } from '../middleware/auth';
import { Types } from 'mongoose';

const router = Router();

/**
 * POST /api/invitations
 * Create a new invitation (requires auth)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { workspaceId, email, role, message } = req.body;
    const userId = req.user._id;

    // Check workspace exists and user has permission
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const userRole = workspace.getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }

    // Check if email is already a member
    const existingUser = await User.findOne({ email });
    if (existingUser && workspace.hasMember(existingUser._id)) {
      return res.status(400).json({ error: 'User is already a member of this workspace' });
    }

    // Check for pending invitation
    const existingInvite = await WorkspaceInvite.findOne({
      workspace: workspaceId,
      email: email.toLowerCase(),
      status: 'pending'
    });

    if (existingInvite) {
      return res.status(400).json({ 
        error: 'An invitation has already been sent to this email',
        invitation: existingInvite
      });
    }

    // Create invitation
    const invitation = new WorkspaceInvite({
      workspace: workspaceId,
      email: email.toLowerCase(),
      role: role || 'member',
      inviter: userId,
      message,
      expiresAt: WorkspaceInvite.generateExpirationDate()
    });

    await invitation.save();

    // TODO: Send invitation email via email service

    res.status(201).json(invitation);
  } catch (error: any) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create invitation' });
  }
});

/**
 * GET /api/invitations
 * List pending invitations for workspace (requires auth)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const userId = req.user._id;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    // Check workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.hasMember(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const invitations = await WorkspaceInvite.find({
      workspace: workspaceId,
      status: 'pending'
    })
      .populate('inviter', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json(invitations);
  } catch (error: any) {
    console.error('List invitations error:', error);
    res.status(500).json({ error: error.message || 'Failed to list invitations' });
  }
});

/**
 * GET /api/invitations/:token
 * Get invitation details (public, no auth required)
 */
router.get('/:token', authenticateTokenOptional, async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await WorkspaceInvite.findOne({ token })
      .populate('workspace', 'name description')
      .populate('inviter', 'name email avatar');

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if invitation is still valid
    if (!invitation.isValid()) {
      return res.status(410).json({ 
        error: 'This invitation has expired',
        status: invitation.status
      });
    }

    res.json(invitation);
  } catch (error: any) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to get invitation' });
  }
});

/**
 * POST /api/invitations/:token/accept
 * Accept invitation (requires auth)
 */
router.post('/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user._id;

    const invitation = await WorkspaceInvite.findOne({ token });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (!invitation.isValid()) {
      return res.status(410).json({ 
        error: 'This invitation has expired',
        status: invitation.status
      });
    }

    // Check if email matches
    if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ 
        error: 'This invitation was sent to a different email address',
        invitedEmail: invitation.email
      });
    }

    // Get workspace
    const workspace = await Workspace.findById(invitation.workspace);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if already a member
    if (workspace.hasMember(userId)) {
      await invitation.accept(userId);
      return res.status(400).json({ 
        error: 'You are already a member of this workspace',
        workspace
      });
    }

    // Add user to workspace
    await workspace.addMember(userId, invitation.role, invitation.inviter);

    // Mark invitation as accepted
    await invitation.accept(userId);

    res.json({ 
      message: 'Successfully joined workspace',
      workspace,
      role: invitation.role
    });
  } catch (error: any) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to accept invitation' });
  }
});

/**
 * POST /api/invitations/:token/decline
 * Decline invitation (optional auth)
 */
router.post('/:token/decline', authenticateTokenOptional, async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await WorkspaceInvite.findOne({ token });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ 
        error: 'This invitation has already been processed',
        status: invitation.status
      });
    }

    await invitation.decline();

    res.json({ message: 'Invitation declined' });
  } catch (error: any) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to decline invitation' });
  }
});

/**
 * DELETE /api/invitations/:id
 * Revoke/cancel invitation (requires auth)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const invitation = await WorkspaceInvite.findById(id);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if user can revoke
    const workspace = await Workspace.findById(invitation.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const userRole = workspace.getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin' && !invitation.inviter.equals(userId)) {
      return res.status(403).json({ error: 'Only owners, admins, or the inviter can revoke invitations' });
    }

    await invitation.revoke();

    res.json({ message: 'Invitation revoked successfully' });
  } catch (error: any) {
    console.error('Revoke invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to revoke invitation' });
  }
});

/**
 * POST /api/invitations/:id/resend
 * Resend invitation email (requires auth)
 */
router.post('/:id/resend', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const invitation = await WorkspaceInvite.findById(id);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if user can resend
    const workspace = await Workspace.findById(invitation.workspace);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const userRole = workspace.getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can resend invitations' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Can only resend pending invitations',
        status: invitation.status
      });
    }

    // Reset expiration date
    invitation.expiresAt = WorkspaceInvite.generateExpirationDate();
    await invitation.save();

    // TODO: Resend invitation email

    res.json({ 
      message: 'Invitation resent successfully',
      invitation
    });
  } catch (error: any) {
    console.error('Resend invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to resend invitation' });
  }
});

export default router;
