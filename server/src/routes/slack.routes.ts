/**
 * Slack Integration Routes
 * OAuth and webhook integration with Slack
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { slackService } from '../services/slack.service.js';

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

    const authUrl = slackService.getAuthUrl(userId, redirectUri);

    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error: unknown) {
    logger.error('Failed to initiate Slack OAuth:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to initiate Slack OAuth'
    });
  }
});

/**
 * GET /api/integrations/slack/callback
 * Handle Slack OAuth callback
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

    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/slack/callback`;
    const tokenData = await slackService.exchangeCode(code as string, redirectUri);

    logger.info(`Slack OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Slack integration connected successfully',
      data: {
        teamId: tokenData.teamId,
        teamName: tokenData.teamName
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to handle Slack OAuth callback:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to complete Slack OAuth'
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

    // Verify webhook signature when signing secret is configured
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    if (signature && timestamp) {
      const rawBody = JSON.stringify(req.body);
      if (!slackService.verifyWebhookSignature(signature, timestamp, rawBody)) {
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    // Slack URL verification challenge
    if (type === 'url_verification') {
      return res.json({ challenge });
    }

    // Handle events
    if (event) {
      logger.info(`Slack webhook event received: ${event.type}`);
    }

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to handle Slack webhook:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to process webhook'
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
      return res.status(400).json({
        success: false,
        message: 'channel and message are required'
      });
    }

    const result = await slackService.sendMessage(channel, message);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error('Failed to send Slack message:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to send message'
    });
  }
});

export default router;

