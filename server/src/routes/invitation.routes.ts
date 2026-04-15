import { Router } from 'express';
import { WorkspaceInvite } from '../models/WorkspaceInvite.model';
import { Workspace } from '../models/Workspace.model';
import { User } from '../models/User.model';
import { authenticateToken, authenticateTokenOptional } from '../middleware/auth';
import { logger } from '../utils/logger.js';
import { sendInvitationEmail } from '../services/email.service.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * POST /api/invitations
 * Create a new invitation (requires auth)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { workspaceId, email, role, message } = req.body;
    const userId = (req as any).user._id;

    // Check workspace exists and user has permission
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const userRole = (workspace as any).getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can invite members' });
      return;
    }

    // Check if email is already a member
    const existingUser = await User.findOne({ email });
    if (existingUser && (workspace as any).hasMember(existingUser._id)) {
      res.status(400).json({ error: 'User is already a member of this workspace' });
      return;
    }

    // Check for pending invitation
    const existingInvite = await WorkspaceInvite.findOne({
      workspace: workspaceId,
      email: email.toLowerCase(),
      status: 'pending',
    });

    if (existingInvite) {
      res.status(400).json({
        error: 'An invitation has already been sent to this email',
        invitation: existingInvite,
      });
      return;
    }

    // Create invitation
    const invitation = new WorkspaceInvite({
      workspace: workspaceId,
      email: email.toLowerCase(),
      role: role || 'member',
      inviter: userId,
      message,
      expiresAt: (WorkspaceInvite as any).generateExpirationDate(),
    });

    await invitation.save();

    // Send invitation email (non-blocking — failure does not fail the request)
    const inviterUser = await User.findById(userId).select('name email').lean();
    sendInvitationEmail({
      to: invitation.email,
      inviterName: (inviterUser as any)?.name || (inviterUser as any)?.email || 'A team member',
      workspaceName: (workspace as any).name || 'the workspace',
      invitationToken: (invitation as any).token,
      frontendUrl: config.frontendUrl,
      message,
    }).catch((err: Error) => logger.error('Invitation email failed', { error: err.message }));

    res.status(201).json(invitation);
  } catch (error: any) {
    logger.error('Create invitation error:', error);
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
    const userId = (req as any).user._id;

    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    // Check workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !(workspace as any).hasMember(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const invitations = await WorkspaceInvite.find({
      workspace: workspaceId,
      status: 'pending',
    })
      .populate('inviter', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json(invitations);
  } catch (error: any) {
    logger.error('List invitations error:', error);
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
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // Check if invitation is still valid
    if (!(invitation as any).isValid()) {
      res.status(410).json({
        error: 'This invitation has expired',
        status: invitation.status,
      });
      return;
    }

    res.json(invitation);
  } catch (error: any) {
    logger.error('Get invitation error:', error);
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
    const userId = (req as any).user._id;

    const invitation = await WorkspaceInvite.findOne({ token });

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    if (!(invitation as any).isValid()) {
      res.status(410).json({
        error: 'This invitation has expired',
        status: invitation.status,
      });
      return;
    }

    // Check if email matches
    if (invitation.email.toLowerCase() !== (req as any).user.email.toLowerCase()) {
      res.status(403).json({
        error: 'This invitation was sent to a different email address',
        invitedEmail: invitation.email,
      });
      return;
    }

    // Get workspace
    const workspace = await Workspace.findById(invitation.workspace);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if already a member
    if ((workspace as any).hasMember(userId)) {
      await (invitation as any).accept(userId);
      res.status(400).json({
        error: 'You are already a member of this workspace',
        workspace,
      });
      return;
    }

    // Add user to workspace
    await (workspace as any).addMember(userId, invitation.role, invitation.inviter);

    // Mark invitation as accepted
    await (invitation as any).accept(userId);

    res.json({
      message: 'Successfully joined workspace',
      workspace,
      role: invitation.role,
    });
  } catch (error: any) {
    logger.error('Accept invitation error:', error);
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
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    if (invitation.status !== 'pending') {
      res.status(400).json({
        error: 'This invitation has already been processed',
        status: invitation.status,
      });
      return;
    }

    await (invitation as any).decline();

    res.json({ message: 'Invitation declined' });
  } catch (error: any) {
    logger.error('Decline invitation error:', error);
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
    const userId = (req as any).user._id;

    const invitation = await WorkspaceInvite.findById(id);

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // Check if user can revoke
    const workspace = await Workspace.findById(invitation.workspace);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const userRole = (workspace as any).getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin' && !invitation.inviter.equals(userId)) {
      res.status(403).json({ error: 'Only owners, admins, or the inviter can revoke invitations' });
      return;
    }

    await (invitation as any).revoke();

    res.json({ message: 'Invitation revoked successfully' });
  } catch (error: any) {
    logger.error('Revoke invitation error:', error);
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
    const userId = (req as any).user._id;

    const invitation = await WorkspaceInvite.findById(id);

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // Check if user can resend
    const workspace = await Workspace.findById(invitation.workspace);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const userRole = (workspace as any).getMemberRole(userId);
    if (userRole !== 'owner' && userRole !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can resend invitations' });
      return;
    }

    if (invitation.status !== 'pending') {
      res.status(400).json({
        error: 'Can only resend pending invitations',
        status: invitation.status,
      });
      return;
    }

    // Reset expiration date
    invitation.expiresAt = (WorkspaceInvite as any).generateExpirationDate();
    await invitation.save();

    // Resend invitation email (non-blocking)
    const inviterUser2 = await User.findById(userId).select('name email').lean();
    sendInvitationEmail({
      to: invitation.email,
      inviterName: (inviterUser2 as any)?.name || (inviterUser2 as any)?.email || 'A team member',
      workspaceName: (workspace as any).name || 'the workspace',
      invitationToken: (invitation as any).token,
      frontendUrl: config.frontendUrl,
    }).catch((err: Error) =>
      logger.error('Resend invitation email failed', { error: err.message })
    );

    res.json({
      message: 'Invitation resent successfully',
      invitation,
    });
  } catch (error: any) {
    logger.error('Resend invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to resend invitation' });
  }
});

export default router;
