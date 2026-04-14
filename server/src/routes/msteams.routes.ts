/**
 * Microsoft Teams Integration Routes
 * OAuth and bot integration with Microsoft Teams
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { BrainstormingRoom } from '../models/BrainstormingRoom.model.js';
import { msTeamsService } from '../services/msteams.service.js';

const router = express.Router();

/**
 * GET /api/integrations/msteams/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Microsoft Teams integration service is running' });
});

/**
 * GET /api/integrations/msteams/auth
 * Initiate Microsoft Teams OAuth flow
 */
router.get('/auth', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/msteams/callback`;

    const authUrl = msTeamsService.getAuthUrl(userId, redirectUri);

    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error: unknown) {
    logger.error('Failed to initiate Microsoft Teams OAuth:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to initiate Microsoft Teams OAuth'
    });
  }
});

/**
 * GET /api/integrations/msteams/callback
 * Handle Microsoft Teams OAuth callback
 */
router.get('/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/msteams/callback`;
    const tokenData = await msTeamsService.exchangeCode(code as string, redirectUri);

    logger.info(`Microsoft Teams OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Microsoft Teams integration connected successfully',
      data: {
        accessToken: tokenData.accessToken ? '***' : undefined,
        refreshToken: tokenData.refreshToken ? '***' : undefined,
        expiresIn: tokenData.expiresIn
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to handle Microsoft Teams OAuth callback:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to complete Microsoft Teams OAuth'
    });
  }
});

/**
 * POST /api/integrations/msteams/share-room
 * Share brainstorming room via Microsoft Teams
 */
router.post('/share-room', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { roomId, teamId, channelId, message, accessToken } = req.body;
    const userId = req.user!.id;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
    }

    // Get room details
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user has access
    const hasAccess =
      room.createdBy === userId ||
      room.participants.some((p: any) => p.userId === userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const shareUrl = `${process.env.APP_URL || 'http://localhost:5173'}/brainstorming-rooms/${roomId}`;

    // If caller provides a Teams access token and channel info, post the message via Graph API
    if (accessToken && teamId && channelId) {
      const result = await msTeamsService.shareRoom(
        accessToken,
        teamId,
        channelId,
        room.name,
        shareUrl,
        message
      );

      return res.json({
        success: true,
        message: 'Room shared to Microsoft Teams channel',
        data: { shareUrl, roomName: room.name, messageId: result.messageId }
      });
    }

    // Fallback: return the share URL for the client to use
    res.json({
      success: true,
      message: 'Room share link generated',
      data: {
        shareUrl,
        roomName: room.name,
        message: message || `Join our brainstorming session: ${room.name}`
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to share room via Teams:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to share room'
    });
  }
});

/**
 * POST /api/integrations/msteams/send-notification
 * Send notification to Teams channel/user about brainstorming session
 */
router.post('/send-notification', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { roomId, recipientId, recipientType, teamId, accessToken } = req.body;
    const userId = req.user!.id;

    if (!roomId || !recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID and recipient ID are required'
      });
    }

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const shareUrl = `${process.env.APP_URL || 'http://localhost:5173'}/brainstorming-rooms/${roomId}`;
    const text = `You have been invited to a brainstorming session: "${room.name}"\n${shareUrl}`;

    if (accessToken) {
      const result = await msTeamsService.sendNotification(
        accessToken,
        recipientId,
        recipientType || 'channel',
        teamId,
        text
      );

      return res.json({
        success: true,
        message: 'Notification sent successfully',
        data: { messageId: result.messageId }
      });
    }

    res.json({
      success: true,
      message: 'Notification prepared (provide accessToken to send via Teams API)',
      data: { text }
    });
  } catch (error: unknown) {
    logger.error('Failed to send Teams notification:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to send notification'
    });
  }
});

export default router;


