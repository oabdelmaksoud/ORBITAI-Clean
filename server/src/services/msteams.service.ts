/**
 * Microsoft Teams Service
 * Encapsulates all MS Teams OAuth and messaging business logic.
 */

import { logger } from '../utils/logger.js';

export interface MsTeamsTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface MsTeamsNotificationResult {
  messageId?: string;
}

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export class MsTeamsService {
  private get clientId(): string | undefined {
    return process.env.MSTEAMS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  }

  private get clientSecret(): string | undefined {
    return process.env.MSTEAMS_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;
  }

  /**
   * Build the Microsoft OAuth2 authorization URL.
   */
  getAuthUrl(userId: string, redirectUri: string): string {
    const clientId = this.clientId;
    if (!clientId) {
      throw new Error(
        'Microsoft Teams integration not configured. ' +
        'Set MSTEAMS_CLIENT_ID (or AZURE_CLIENT_ID) environment variable.'
      );
    }

    const scopes = [
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
      'https://graph.microsoft.com/ChannelMessage.Send',
      'https://graph.microsoft.com/Chat.ReadWrite'
    ];

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    return (
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_mode=query&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${state}`
    );
  }

  /**
   * Exchange an authorization code for Microsoft OAuth tokens.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<MsTeamsTokenData> {
    const clientId = this.clientId;
    const clientSecret = this.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error(
        'Microsoft Teams integration not configured. ' +
        'MSTEAMS_CLIENT_ID and MSTEAMS_CLIENT_SECRET (or AZURE_* equivalents) are required.'
      );
    }

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const data: any = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error || 'Failed to exchange MS Teams code');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }

  /**
   * Share a brainstorming room link to a Teams channel.
   * Requires a valid Microsoft Graph access token for the user.
   */
  async shareRoom(
    accessToken: string,
    teamId: string,
    channelId: string,
    roomName: string,
    shareUrl: string,
    customMessage?: string
  ): Promise<MsTeamsNotificationResult> {
    const body = customMessage || `Join our brainstorming session: ${roomName}\n${shareUrl}`;

    const response = await fetch(
      `${GRAPH_BASE}/teams/${teamId}/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          body: { content: body }
        })
      }
    );

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      throw new Error(
        error?.error?.message ||
        `Microsoft Graph API error: ${response.status} ${response.statusText}`
      );
    }

    const data: any = await response.json();
    return { messageId: data.id };
  }

  /**
   * Send a notification message to a Teams channel or user chat.
   */
  async sendNotification(
    accessToken: string,
    recipientId: string,
    recipientType: 'channel' | 'user',
    teamId: string | undefined,
    text: string
  ): Promise<MsTeamsNotificationResult> {
    let endpoint: string;

    if (recipientType === 'channel' && teamId) {
      endpoint = `${GRAPH_BASE}/teams/${teamId}/channels/${recipientId}/messages`;
    } else {
      // User chat — use /me/chats (simplified: real implementation would lookup or create chat)
      endpoint = `${GRAPH_BASE}/chats/${recipientId}/messages`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: { content: text } })
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      throw new Error(
        error?.error?.message ||
        `Microsoft Graph API error: ${response.status} ${response.statusText}`
      );
    }

    const data: any = await response.json();
    return { messageId: data.id };
  }
}

export const msTeamsService = new MsTeamsService();
