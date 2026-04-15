/**
 * Slack Integration Routes
 * OAuth and webhook integration with Slack
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/integrations/slack/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Slack integration service is running' });
});

/**
 * GET /api/integrations/slack/auth
 * Initiate Slack OAuth flow
 */
router.get('/auth', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/slack/callback`;
    
    // Slack OAuth URL
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      res.status(400).json({
        success: false,
        message: 'Slack integration not configured. Please set SLACK_CLIENT_ID environment variable.'
      });
      return;
    }

    const scopes = ['chat:write', 'channels:read', 'users:read'];
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    const authUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${clientId}&` +
      `scope=${scopes.join(',')}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    res.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to initiate Slack OAuth:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to initiate Slack OAuth'
    });
  }
});

/**
 * GET /api/integrations/slack/callback
 * Handle Slack OAuth callback
 */
router.get('/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // @ts-ignore TS6133
    const { code, _state } = req.query;

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
      return;
    }

    // Exchange code for access token
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/slack/callback`;

    if (!clientId || !clientSecret) {
      res.status(400).json({
        success: false,
        message: 'Slack integration not configured'
      });
      return;
    }

    // Exchange code for token (simplified - in production, store tokens securely)
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!(tokenData as any).ok) {
      throw new Error((tokenData as any).error || 'Failed to exchange code for token');
    }

    // Store token (in production, save to database)
    logger.info(`Slack OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Slack integration connected successfully',
      data: {
        teamId: (tokenData as any).team?.id,
        teamName: (tokenData as any).team?.name
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to handle Slack OAuth callback:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to complete Slack OAuth'
    });
  }
});

/**
 * POST /api/integrations/slack/webhook
 * Handle Slack webhook events
 */
router.post('/webhook', async (req, res) => {
  try {
    const { type, challenge, event } = req.body;

    // Slack URL verification
    if (type === 'url_verification') {
      res.json({ challenge });
      return;
    }

    // Handle events
    if (event) {
      logger.info(`Slack webhook event received: ${event.type}`);
      // Process event (e.g., message received, user joined, etc.)
    }

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to handle Slack webhook:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to process webhook'
    });
  }
});

/**
 * POST /api/integrations/slack/send-message
 * Send message to Slack channel
 */
router.post('/send-message', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { channel, message } = req.body;

    if (!channel || !message) {
      res.status(400).json({
        success: false,
        message: 'channel and message are required'
      });
      return;
    }

    // In production, retrieve stored token from database
    const token = process.env.SLACK_BOT_TOKEN;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Slack bot token not configured'
      });
      return;
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        text: message
      })
    });

    const data = await response.json();

    if (!(data as any).ok) {
      throw new Error((data as any).error || 'Failed to send message');
    }

    res.json({
      success: true,
      data: {
        ts: (data as any).ts,
        channel: (data as any).channel
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to send Slack message:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to send message'
    });
  }
});

export default router;
