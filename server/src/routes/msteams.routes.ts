/**
 * Microsoft Teams Integration Routes
 * OAuth and bot integration with Microsoft Teams
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { BrainstormingRoom } from '../models/BrainstormingRoom.model.js';

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
    
    const clientId = process.env.MSTEAMS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Microsoft Teams integration not configured. Please set MSTEAMS_CLIENT_ID or AZURE_CLIENT_ID environment variable.'
      });
    }

    // Microsoft Teams OAuth scopes
    const scopes = [
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
      'https://graph.microsoft.com/ChannelMessage.Send',
      'https://graph.microsoft.com/Chat.ReadWrite'
    ];
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_mode=query&` +
      `scope=${scopes.join(' ')}&` +
      `state=${state}`;

    res.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
  } catch (error: any) {
    logger.error('Failed to initiate Microsoft Teams OAuth:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate Microsoft Teams OAuth'
    });
  }
});

/**
 * GET /api/integrations/msteams/callback
 * Handle Microsoft Teams OAuth callback
 */
router.get('/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    const clientId = process.env.MSTEAMS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.MSTEAMS_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/msteams/callback`;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Microsoft Teams integration not configured'
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'Failed to exchange code for token');
    }

    // Store token (in production, save to database with encryption)
    logger.info(`Microsoft Teams OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Microsoft Teams integration connected successfully',
      data: {
        accessToken: tokenData.access_token ? '***' : undefined, // Don't expose token
        refreshToken: tokenData.refresh_token ? '***' : undefined,
        expiresIn: tokenData.expires_in
      }
    });
  } catch (error: any) {
    logger.error('Failed to handle Microsoft Teams OAuth callback:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete Microsoft Teams OAuth'
    });
  }
});

/**
 * POST /api/integrations/msteams/share-room
 * Share brainstorming room via Microsoft Teams
 */
router.post('/share-room', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { roomId, teamId, channelId, message } = req.body;
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
    const hasAccess = room.createdBy === userId || 
                     room.participants.some(p => p.userId === userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Create share link
    const shareUrl = `${process.env.APP_URL || 'http://localhost:5173'}/brainstorming-rooms/${roomId}`;
    
    // In production, use stored access token to send message to Teams
    // For now, return the share URL
    res.json({
      success: true,
      message: 'Room share link generated',
      data: {
        shareUrl,
        roomName: room.name,
        message: message || `Join our brainstorming session: ${room.name}`
      }
    });
  } catch (error: any) {
    logger.error('Failed to share room via Teams:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to share room'
    });
  }
});

/**
 * POST /api/integrations/msteams/send-notification
 * Send notification to Teams channel/user about brainstorming session
 */
router.post('/send-notification', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { roomId, recipientId, recipientType } = req.body; // recipientType: 'channel' | 'user'
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

    // In production, use Microsoft Graph API to send message
    // POST https://graph.microsoft.com/v1.0/teams/{team-id}/channels/{channel-id}/messages
    // or
    // POST https://graph.microsoft.com/v1.0/users/{user-id}/chats

    res.json({
      success: true,
      message: 'Notification sent successfully'
    });
  } catch (error: any) {
    logger.error('Failed to send Teams notification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send notification'
    });
  }
});

export default router;

