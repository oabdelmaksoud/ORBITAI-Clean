/**
 * Slack Service
 * Encapsulates all Slack Web API and OAuth interactions.
 * Extracted from inline route logic to enable unit testing and reuse.
 */

import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface SlackTokenResponse {
  accessToken: string;
  teamId: string;
  teamName: string;
  scope: string;
  botUserId?: string;
}

export interface SlackMessageResult {
  ts: string;
  channel: string;
}

const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

export class SlackService {
  /**
   * Build the Slack OAuth authorization URL for a user.
   */
  getAuthUrl(userId: string, redirectUri: string): string {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        'Slack integration not configured. Set SLACK_CLIENT_ID environment variable.'
      );
    }

    const scopes = ['chat:write', 'channels:read', 'users:read'];
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange an OAuth authorization code for an access token.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<SlackTokenResponse> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Slack integration not configured.');
    }

    const response = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json() as any;
    if (!data.ok) {
      throw new Error(data.error || 'Failed to exchange Slack authorization code');
    }

    logger.info('[Slack] OAuth token exchange successful');
    return {
      accessToken: data.access_token,
      teamId: data.team?.id,
      teamName: data.team?.name,
      scope: data.scope,
      botUserId: data.bot_user_id,
    };
  }

  /**
   * Verify Slack webhook signature to prevent spoofed events.
   */
  verifyWebhookSignature(
    signingSecret: string,
    signature: string,
    timestamp: string,
    rawBody: string
  ): boolean {
    const fiveMinutes = 5 * 60;
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > fiveMinutes) {
      return false; // Replay attack protection
    }

    const baseString = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto
      .createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex');
    const expectedSignature = `v0=${hmac}`;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  }

  /**
   * Send a message to a Slack channel.
   */
  async sendMessage(channel: string, text: string, token: string): Promise<SlackMessageResult> {
    const response = await fetch(SLACK_POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });

    const data = await response.json() as any;
    if (!data.ok) {
      throw new Error(data.error || 'Slack API error: failed to send message');
    }

    logger.info(`[Slack] Message sent to channel ${channel}`);
    return { ts: data.ts, channel: data.channel };
  }
}

export const slackService = new SlackService();
