/**
 * Microsoft Teams Service
 * Encapsulates all Microsoft Graph API interactions for the Teams integration.
 * Extracted from inline route logic to enable unit testing and reuse.
 */

import { logger } from '../utils/logger.js';

export interface MsTeamsTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}

export interface MsTeamsMessageResult {
  messageId: string;
  channelId?: string;
  chatId?: string;
  createdAt: string;
}

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

const OAUTH_SCOPES = [
  'https://graph.microsoft.com/User.Read',
  'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
  'https://graph.microsoft.com/ChannelMessage.Send',
  'https://graph.microsoft.com/Chat.ReadWrite',
];

export class MsTeamsService {
  /**
   * Build the OAuth authorization URL for a user.
   */
  getAuthUrl(userId: string, redirectUri: string): string {
    const clientId = process.env.MSTEAMS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        'Microsoft Teams integration not configured. Set MSTEAMS_CLIENT_ID or AZURE_CLIENT_ID.'
      );
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: OAUTH_SCOPES.join(' '),
      state,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for an access token.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<MsTeamsTokenResponse> {
    const clientId = process.env.MSTEAMS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.MSTEAMS_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft Teams integration not configured.');
    }

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json() as any;
    if (data.error) {
      throw new Error(data.error_description || 'Failed to exchange authorization code');
    }

    logger.info('[MsTeams] OAuth token exchange successful');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  }

  /**
   * Send a message to a Teams channel.
   */
  async sendChannelMessage(
    accessToken: string,
    teamId: string,
    channelId: string,
    content: string
  ): Promise<MsTeamsMessageResult> {
    const response = await fetch(
      `${GRAPH_API}/teams/${teamId}/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: { content, contentType: 'text' },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json() as any;
      throw new Error(err?.error?.message || `Graph API error: ${response.status}`);
    }

    const msg = await response.json() as any;
    logger.info(`[MsTeams] Message sent to channel ${channelId}`);
    return {
      messageId: msg.id,
      channelId: msg.channelIdentity?.channelId,
      createdAt: msg.createdDateTime,
    };
  }

  /**
   * Send a direct chat message to a Teams user.
   */
  async sendDirectMessage(
    accessToken: string,
    recipientUserId: string,
    content: string
  ): Promise<MsTeamsMessageResult> {
    // Create or get chat
    const chatResponse = await fetch(`${GRAPH_API}/chats`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatType: 'oneOnOne',
        members: [
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${recipientUserId}')`,
          },
        ],
      }),
    });

    if (!chatResponse.ok) {
      const err = await chatResponse.json() as any;
      throw new Error(err?.error?.message || `Failed to create chat: ${chatResponse.status}`);
    }

    const chat = await chatResponse.json() as any;
    const chatId = chat.id;

    // Send message
    const msgResponse = await fetch(`${GRAPH_API}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: { content, contentType: 'text' } }),
    });

    if (!msgResponse.ok) {
      const err = await msgResponse.json() as any;
      throw new Error(err?.error?.message || `Failed to send direct message: ${msgResponse.status}`);
    }

    const msg = await msgResponse.json() as any;
    logger.info(`[MsTeams] Direct message sent to user ${recipientUserId}`);
    return { messageId: msg.id, chatId, createdAt: msg.createdDateTime };
  }
}

export const msTeamsService = new MsTeamsService();
