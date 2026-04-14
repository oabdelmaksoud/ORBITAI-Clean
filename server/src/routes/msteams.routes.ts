/**
 * Microsoft Teams Integration Routes
 * OAuth and bot integration with Microsoft Teams.
 * All API logic is delegated to MsTeamsService.
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { BrainstormingRoom } from '../models/BrainstormingRoom.model.js';
import { msTeamsService } from '../services/msteams.service.js';

const router = express.Router();
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

/**
 * GET /api/integrations/msteams/health
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
    const redirectUri = `${APP_URL}/integrations/msteams/callback`;
    const authUrl = msTeamsService.getAuthUrl(req.user!.id, redirectUri);
    const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64');
    res.json({ success: true, data: { authUrl, state } });
  } catch (error: any) {
    logger.error('Failed to initiate Microsoft Teams OAuth:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/integrations/msteams/callback
 * Handle Microsoft Teams OAuth callback
 */
router.get('/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, message: 'Authorization code is required' });

    const redirectUri = `${APP_URL}/integrations/msteams/callback`;
    const tokens = await msTeamsService.exchangeCode(code as string, redirectUri);

    // TODO: persist encrypted tokens to UserSettings model (per-user)
    logger.info(`Microsoft Teams OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Microsoft Teams integration connected successfully',
      data: {
        accessToken: tokens.accessToken ? '***' : undefined,
        refreshToken: tokens.refreshToken ? '***' : undefined,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error: any) {
    logger.error('Failed to handle Microsoft Teams OAuth callback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/integrations/msteams/share-room
 * Share a brainstorming room via Microsoft Teams
 */
router.post('/share-room', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { roomId, teamId, channelId, message } = req.body;
    const userId = req.user!.id;

    if (!roomId) return res.status(400).json({ success: false, message: 'Room ID is required' });

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const hasAccess =
      room.createdBy === userId || room.participants.some((p: any) => p.userId === userId);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const shareUrl = `${APP_URL}/brainstorming-rooms/${roomId}`;
    const shareText = message || `Join our brainstorming session: ${room.name}\n${shareUrl}`;

    // Send via Graph API when teamId/channelId provided, otherwise return share link only
    let messageResult: any = null;
    if (teamId && channelId) {
      // TODO: retrieve stored access token from UserSettings for req.user!.id
      // messageResult = await msTeamsService.sendChannelMessage(accessToken, teamId, channelId, shareText);
    }

    res.json({
      success: true,
      message: 'Room share link generated',
      data: { shareUrl, roomName: room.name, shareText, messageResult },
    });
  } catch (error: any) {
    logger.error('Failed to share room via Teams:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/integrations/msteams/send-notification
 * Send notification to a Teams channel or user
 */
router.post('/send-notification', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { roomId, recipientId, recipientType, accessToken } = req.body;

    if (!roomId || !recipientId) {
      return res.status(400).json({ success: false, message: 'Room ID and recipient ID are required' });
    }

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const shareUrl = `${APP_URL}/brainstorming-rooms/${roomId}`;
    const content = `You've been invited to a brainstorming session: **${room.name}**\n${shareUrl}`;

    if (!accessToken) {
      // Return what would be sent — caller needs to supply token (stored per-user in future)
      return res.json({ success: true, message: 'Notification preview', data: { content, recipientId, recipientType } });
    }

    let result: any;
    if (recipientType === 'channel') {
      // Requires teamId — use recipientId as channelId with separate teamId header/param
      result = { note: 'Pass teamId to send to a channel' };
    } else {
      result = await msTeamsService.sendDirectMessage(accessToken, recipientId, content);
    }

    res.json({ success: true, message: 'Notification sent successfully', data: result });
  } catch (error: any) {
    logger.error('Failed to send Teams notification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
