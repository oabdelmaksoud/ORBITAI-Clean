/**
 * Slack Integration Routes
 * OAuth and webhook integration with Slack.
 * All API logic is delegated to SlackService.
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { slackService } from '../services/slack.service.js';

const router = express.Router();
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

/**
 * GET /api/integrations/slack/health
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
    const redirectUri = `${APP_URL}/integrations/slack/callback`;
    const authUrl = slackService.getAuthUrl(req.user!.id, redirectUri);
    const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64');
    res.json({ success: true, data: { authUrl, state } });
  } catch (error: any) {
    logger.error('Failed to initiate Slack OAuth:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/integrations/slack/callback
 * Handle Slack OAuth callback
 */
router.get('/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, message: 'Authorization code is required' });

    const redirectUri = `${APP_URL}/integrations/slack/callback`;
    const tokens = await slackService.exchangeCode(code as string, redirectUri);

    // TODO: persist encrypted tokens to UserSettings model (per-user)
    logger.info(`Slack OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Slack integration connected successfully',
      data: { teamId: tokens.teamId, teamName: tokens.teamName },
    });
  } catch (error: any) {
    logger.error('Failed to handle Slack OAuth callback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/integrations/slack/webhook
 * Handle Slack webhook events (URL verification + event processing)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify signature if signing secret is configured
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (signingSecret) {
      const signature = req.headers['x-slack-signature'] as string;
      const timestamp = req.headers['x-slack-request-timestamp'] as string;
      const rawBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);

      if (!signature || !timestamp) {
        return res.status(401).json({ success: false, message: 'Missing Slack signature headers' });
      }

      const valid = slackService.verifyWebhookSignature(signingSecret, signature, timestamp, rawBody);
      if (!valid) {
        logger.warn('[Slack] Webhook signature verification failed');
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const body = req.body instanceof Buffer ? JSON.parse(req.body.toString()) : req.body;
    const { type, challenge, event } = body;

    // Slack URL verification handshake
    if (type === 'url_verification') return res.json({ challenge });

    if (event) {
      logger.info(`[Slack] Webhook event: ${event.type}`);
      // TODO: route events to appropriate handlers (message, reaction, etc.)
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to handle Slack webhook:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/integrations/slack/send-message
 * Send a message to a Slack channel
 */
router.post('/send-message', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { channel, message } = req.body;
    if (!channel || !message) {
      return res.status(400).json({ success: false, message: 'channel and message are required' });
    }

    // Use bot token from env; in future retrieve per-user token from UserSettings
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Slack bot token not configured. Set SLACK_BOT_TOKEN.' });
    }

    const result = await slackService.sendMessage(channel, message, token);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Failed to send Slack message:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
