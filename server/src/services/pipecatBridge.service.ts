/**
 * Pipecat Bridge Service
 * Manages WebSocket connections and sessions for voice conversations.
 * Sessions are persisted to MongoDB (VoiceSession.model.ts) to survive restarts.
 */

import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { config } from '../config/env.js';
import { ChatConversation } from '../models/ChatConversation.model.js';
import { VoiceSession, IVoiceSession } from '../models/VoiceSession.model.js';
import crypto from 'crypto';

export interface VoiceSessionData {
  sessionId: string;
  userId?: string;
  conversationId?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
  transcripts: Array<{ userText: string; aiText: string; timestamp: number }>;
}

class PipecatBridgeService {
  private readonly PIPECAT_HOST = process.env.PIPECAT_HOST || 'localhost';
  private readonly PIPECAT_PORT = parseInt(process.env.PIPECAT_PORT || '8000', 10);
  private readonly PIPECAT_ENABLED = process.env.PIPECAT_ENABLED !== 'false';

  isEnabled(): boolean { return this.PIPECAT_ENABLED; }

  getServiceUrl(): string {
    return `http://${this.PIPECAT_HOST}:${this.PIPECAT_PORT}`;
  }

  getWebSocketUrl(sessionId: string, params: { conversationId?: string; userId?: string; apiKey?: string }): string {
    const base = `ws://${this.PIPECAT_HOST}:${this.PIPECAT_PORT}/ws/${sessionId}`;
    const qs = new URLSearchParams();
    if (params.conversationId) qs.append('conversation_id', params.conversationId);
    if (params.userId) qs.append('user_id', params.userId);
    if (params.apiKey) qs.append('api_key', params.apiKey);
    qs.append('backend_url', `http://localhost:${config.port}`);
    return `${base}?${qs.toString()}`;
  }

  /**
   * Create a new voice session and persist it to MongoDB.
   */
  async createSession(params: {
    userId?: string;
    conversationId?: string;
    metadata?: Record<string, any>;
  }): Promise<VoiceSessionData> {
    if (!this.isEnabled()) throw new Error('Pipecat voice service is not enabled');

    const openaiKey = await apiKeyProvider.getApiKey('openai');
    if (!openaiKey) {
      throw new Error('OpenAI API key not found. Please add it via Admin Console → Settings → API Keys');
    }

    const sessionId = crypto.randomUUID();
    const doc = await VoiceSession.create({
      sessionId,
      userId: params.userId,
      conversationId: params.conversationId,
      status: 'active',
      metadata: params.metadata || {},
      transcripts: [],
    });

    logger.info(`[PipecatBridge] Created voice session: ${sessionId} for user: ${params.userId}`);
    return this._toData(doc);
  }

  /**
   * Retrieve a session from MongoDB (returns API key for Python service).
   */
  async getSession(sessionId: string): Promise<(VoiceSessionData & { apiKey?: string }) | null> {
    const doc = await VoiceSession.findOne({ sessionId, status: 'active' }).lean();
    if (!doc) return null;

    const openaiKey = await apiKeyProvider.getApiKey('openai');
    return { ...this._toData(doc), apiKey: openaiKey || undefined };
  }

  /**
   * Update session metadata/conversationId.
   */
  async updateSession(
    sessionId: string,
    updates: { conversationId?: string; metadata?: Record<string, any> }
  ): Promise<VoiceSessionData | null> {
    const $set: Record<string, any> = {};
    if (updates.conversationId) $set.conversationId = updates.conversationId;
    if (updates.metadata) {
      // Merge metadata at the top level
      const existing = await VoiceSession.findOne({ sessionId }).select('metadata').lean();
      $set.metadata = { ...(existing?.metadata ?? {}), ...updates.metadata };
    }

    const doc = await VoiceSession.findOneAndUpdate(
      { sessionId, status: 'active' },
      { $set },
      { new: true }
    );
    if (!doc) return null;

    logger.info(`[PipecatBridge] Updated session: ${sessionId}`);
    return this._toData(doc);
  }

  /**
   * Append a transcript entry to the session.
   */
  async addTranscript(sessionId: string, userText: string, aiText: string): Promise<void> {
    const result = await VoiceSession.updateOne(
      { sessionId, status: 'active' },
      { $push: { transcripts: { userText, aiText, timestamp: Date.now() } } }
    );
    if (result.matchedCount === 0) {
      logger.warn(`[PipecatBridge] Cannot add transcript — session not found or ended: ${sessionId}`);
    }
  }

  /**
   * End session: save transcripts to ChatConversation, mark session as ended.
   */
  async endSession(sessionId: string): Promise<void> {
    const doc = await VoiceSession.findOne({ sessionId });
    if (!doc) {
      logger.warn(`[PipecatBridge] Cannot end non-existent session: ${sessionId}`);
      return;
    }

    try {
      if (doc.conversationId && doc.transcripts.length > 0) {
        const conversation = await ChatConversation.findById(doc.conversationId);
        if (conversation) {
          for (const t of doc.transcripts) {
            conversation.messages.push(
              { id: crypto.randomUUID(), sender: 'user', text: t.userText, timestamp: t.timestamp },
              { id: crypto.randomUUID(), sender: 'agent', text: t.aiText, timestamp: t.timestamp + 100 }
            );
          }
          conversation.metadata = {
            ...conversation.metadata,
            voiceSessionId: sessionId,
            isVoiceConversation: true,
          };
          await conversation.save();
          logger.info(`[PipecatBridge] Saved ${doc.transcripts.length} voice transcripts for conversation ${doc.conversationId}`);
        }
      }
    } catch (err: any) {
      logger.error(`[PipecatBridge] Error saving voice conversation: ${err.message}`, err);
    }

    await VoiceSession.updateOne({ sessionId }, { $set: { status: 'ended', endedAt: new Date() } });
    logger.info(`[PipecatBridge] Ended session: ${sessionId}`);
  }

  /**
   * Get active sessions for a user.
   */
  async getSessionsForUser(userId: string): Promise<VoiceSessionData[]> {
    const docs = await VoiceSession.find({ userId, status: 'active' }).lean();
    return docs.map(d => this._toData(d));
  }

  /**
   * Mark sessions older than maxAge ms as expired.
   */
  async cleanupOldSessions(maxAge = 3_600_000): Promise<void> {
    const cutoff = new Date(Date.now() - maxAge);
    const result = await VoiceSession.updateMany(
      { status: 'active', createdAt: { $lt: cutoff } },
      { $set: { status: 'expired', endedAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`[PipecatBridge] Expired ${result.modifiedCount} old sessions`);
    }
  }

  private _toData(doc: any): VoiceSessionData {
    return {
      sessionId: doc.sessionId,
      userId: doc.userId,
      conversationId: doc.conversationId,
      createdAt: doc.createdAt,
      metadata: doc.metadata,
      transcripts: doc.transcripts,
    };
  }
}

export const pipecatBridgeService = new PipecatBridgeService();
