/**
 * Slack Service
 * Encapsulates all Slack OAuth and messaging business logic.
 */

import { logger } from '../utils/logger.js';

export interface SlackTokenData {
  teamId: string;
  teamName: string;
  accessToken: string;
  botUserId?: string;
}

export interface SlackMessageResult {
  ts: string;
  channel: string;
}

export class SlackService {
  /**
   * Build the Slack OAuth authorization URL for a given user.
   */
  getAuthUrl(userId: string, redirectUri: string): string {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        'Slack integration not configured. Please set SLACK_CLIENT_ID environment variable.'
      );
    }

    const scopes = ['chat:write', 'channels:read', 'users:read'];
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const authUrl =
      `https://slack.com/oauth/v2/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `scope=${encodeURIComponent(scopes.join(','))}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    return authUrl;
  }

  /**
   * Exchange an OAuth authorization code for an access token.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<SlackTokenData> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Slack integration not configured. SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are required.');
    }

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const data: any = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Failed to exchange Slack authorization code');
    }

    return {
      teamId: data.team?.id,
      teamName: data.team?.name,
      accessToken: data.access_token,
      botUserId: data.bot_user_id
    };
  }

  /**
   * Verify a Slack webhook signature.
   * See https://api.slack.com/authentication/verifying-requests-from-slack
   */
  verifyWebhookSignature(
    signature: string,
    timestamp: string,
    rawBody: string
  ): boolean {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      logger.warn('[SlackService] SLACK_SIGNING_SECRET not set — skipping signature verification');
      return true;
    }

    // Reject requests older than 5 minutes to prevent replay attacks
    const requestAge = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (requestAge > 300) {
      logger.warn('[SlackService] Rejecting stale webhook request');
      return false;
    }

    // Node.js crypto is a built-in — no additional dependency needed
    const crypto = require('crypto');
    const baseString = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', signingSecret);
    const computed = `v0=${hmac.update(baseString).digest('hex')}`;

    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }

  /**
   * Send a message to a Slack channel using the bot token.
   */
  async sendMessage(
    channelId: string,
    text: string,
    token?: string
  ): Promise<SlackMessageResult> {
    const botToken = token || process.env.SLACK_BOT_TOKEN;
    if (!botToken) {
      throw new Error(
        'Slack bot token not configured. Set SLACK_BOT_TOKEN or provide a per-user token.'
      );
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channel: channelId, text })
    });

    const data: any = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Failed to send Slack message');
    }

    return { ts: data.ts, channel: data.channel };
  }
}

export const slackService = new SlackService();
