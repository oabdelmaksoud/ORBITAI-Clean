/**
 * Pipecat Bridge Service
 * Manages WebSocket connections and sessions for voice conversations
 * Bridges between Node.js backend and Python Pipecat service
 */

import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { config } from '../config/env.js';
import { ChatConversation } from '../models/ChatConversation.model.js';
import crypto from 'crypto';

export interface VoiceSession {
  sessionId: string;
  userId?: string;
  conversationId?: string;
  createdAt: Date;
  metadata?: {
    topic?: string;
    ideas?: any[];
    keyInsights?: string[];
    nextSteps?: string[];
    [key: string]: any;
  };
  transcripts: Array<{
    userText: string;
    aiText: string;
    timestamp: number;
  }>;
}

class PipecatBridgeService {
  private sessions: Map<string, VoiceSession> = new Map();
  private readonly PIPECAT_HOST = process.env.PIPECAT_HOST || 'localhost';
  private readonly PIPECAT_PORT = parseInt(process.env.PIPECAT_PORT || '8000', 10);
  private readonly PIPECAT_ENABLED = process.env.PIPECAT_ENABLED !== 'false';

  /**
   * Check if Pipecat service is enabled
   */
  isEnabled(): boolean {
    return this.PIPECAT_ENABLED;
  }

  /**
   * Get Pipecat service URL
   */
  getServiceUrl(): string {
    return `http://${this.PIPECAT_HOST}:${this.PIPECAT_PORT}`;
  }

  /**
   * Get WebSocket URL for Pipecat service
   */
  getWebSocketUrl(sessionId: string, params: {
    conversationId?: string;
    userId?: string;
    apiKey?: string;
  }): string {
    const baseUrl = `ws://${this.PIPECAT_HOST}:${this.PIPECAT_PORT}/ws/${sessionId}`;
    const urlParams = new URLSearchParams();
    
    if (params.conversationId) {
      urlParams.append('conversation_id', params.conversationId);
    }
    if (params.userId) {
      urlParams.append('user_id', params.userId);
    }
    if (params.apiKey) {
      urlParams.append('api_key', params.apiKey);
    }
    urlParams.append('backend_url', `http://localhost:${config.port}`);

    return `${baseUrl}?${urlParams.toString()}`;
  }

  /**
   * Create a new voice session
   */
  async createSession(params: {
    userId?: string;
    conversationId?: string;
    metadata?: Record<string, any>;
  }): Promise<VoiceSession> {
    if (!this.isEnabled()) {
      throw new Error('Pipecat voice service is not enabled');
    }

    const sessionId = crypto.randomUUID();
    
    // Get OpenAI API key for STT/TTS (required for Pipecat)
    const openaiKey = await apiKeyProvider.getApiKey('openai');
    if (!openaiKey) {
      throw new Error('OpenAI API key not found. Please add it via Admin Console → Settings → API Keys');
    }

    const session: VoiceSession = {
      sessionId,
      userId: params.userId,
      conversationId: params.conversationId,
      createdAt: new Date(),
      metadata: params.metadata || {},
      transcripts: []
    };

    this.sessions.set(sessionId, session);
    logger.info(`[PipecatBridge] Created voice session: ${sessionId} for user: ${params.userId}`);

    return session;
  }

  /**
   * Get session information (for Python service to fetch API keys)
   */
  async getSession(sessionId: string): Promise<VoiceSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Get OpenAI API key for STT/TTS
    const openaiKey = await apiKeyProvider.getApiKey('openai');
    
    return {
      ...session,
      // Include API key in response (for Python service)
      apiKey: openaiKey || undefined
    } as any;
  }

  /**
   * Update session context (conversation metadata)
   */
  async updateSession(sessionId: string, updates: {
    conversationId?: string;
    metadata?: Record<string, any>;
  }): Promise<VoiceSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (updates.conversationId) {
      session.conversationId = updates.conversationId;
    }
    if (updates.metadata) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    this.sessions.set(sessionId, session);
    logger.info(`[PipecatBridge] Updated session: ${sessionId}`);

    return session;
  }

  /**
   * Add transcript to session
   */
  addTranscript(sessionId: string, userText: string, aiText: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`[PipecatBridge] Cannot add transcript to non-existent session: ${sessionId}`);
      return;
    }

    session.transcripts.push({
      userText,
      aiText,
      timestamp: Date.now()
    });
  }

  /**
   * End session and save conversation to database
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`[PipecatBridge] Cannot end non-existent session: ${sessionId}`);
      return;
    }

    try {
      // Save transcripts to ChatConversation if conversationId exists
      if (session.conversationId && session.transcripts.length > 0) {
        const conversation = await ChatConversation.findById(session.conversationId);
        if (conversation) {
          // Add voice transcripts as messages
          for (const transcript of session.transcripts) {
            // Add user message
            conversation.messages.push({
              id: crypto.randomUUID(),
              sender: 'user',
              text: transcript.userText,
              timestamp: transcript.timestamp
            });

            // Add AI response
            conversation.messages.push({
              id: crypto.randomUUID(),
              sender: 'agent',
              text: transcript.aiText,
              timestamp: transcript.timestamp + 100 // Slight offset
            });
          }

          // Update metadata to mark as voice conversation
          conversation.metadata = {
            ...conversation.metadata,
            voiceSessionId: sessionId,
            isVoiceConversation: true,
            voiceTranscripts: session.transcripts
          };

          await conversation.save();
          logger.info(`[PipecatBridge] Saved ${session.transcripts.length} voice transcripts to conversation: ${session.conversationId}`);
        }
      }
    } catch (error: any) {
      logger.error(`[PipecatBridge] Error saving voice conversation: ${error.message}`, error);
    }

    // Remove session from memory
    this.sessions.delete(sessionId);
    logger.info(`[PipecatBridge] Ended session: ${sessionId}`);
  }

  /**
   * Get all active sessions for a user
   */
  getSessionsForUser(userId: string): VoiceSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  /**
   * Cleanup old sessions (call periodically)
   */
  async cleanupOldSessions(maxAge: number = 3600000): Promise<void> {
    const now = Date.now();
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > maxAge) {
        sessionsToDelete.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDelete) {
      await this.endSession(sessionId);
    }

    if (sessionsToDelete.length > 0) {
      logger.info(`[PipecatBridge] Cleaned up ${sessionsToDelete.length} old sessions`);
    }
  }
}

export const pipecatBridgeService = new PipecatBridgeService();


