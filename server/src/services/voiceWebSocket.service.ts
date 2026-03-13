/**
 * Voice WebSocket Service
 * Handles real-time voice conversation via WebSocket
 * Integrates with speechProviderService and LLMRouter
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { speechProviderService } from './speechProvider.service.js';
import { llmRouter } from './llm/LLMRouter.js';
import { pipecatBridgeService } from './pipecatBridge.service.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

interface VoiceSession {
  sessionId: string;
  userId?: string;
  conversationId?: string;
  ws: WebSocket;
  audioBuffer: Buffer[];
  isRecording: boolean;
  lastActivity: number;
  conversationHistory: Array<{ role: 'user' | 'agent'; content: string }>;
}

class VoiceWebSocketService {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, VoiceSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly AUDIO_BUFFER_SIZE = 5 * 1024 * 1024; // 5MB max buffer
  private readonly SILENCE_THRESHOLD = 2000; // 2 seconds of silence to process

  /**
   * Initialize WebSocket server for voice
   * Uses noServer mode to avoid conflicts with Socket.IO
   */
  initialize(httpServer: HTTPServer): void {
    // Use noServer mode to manually handle upgrades
    // This prevents conflicts with Socket.IO which also handles WebSocket upgrades
    this.wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false // Disable compression for binary audio
    });

    // Handle upgrade requests manually for /ws/voice path only
    httpServer.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
      
      // Only handle /ws/voice path, let Socket.IO handle other paths
      if (pathname === '/ws/voice') {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
      // Don't destroy socket for other paths - let Socket.IO handle them
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      // Extract session ID from query params
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('sessionId') || crypto.randomUUID();
      const userId = url.searchParams.get('userId') || undefined;
      const conversationId = url.searchParams.get('conversationId') || undefined;

      logger.info(`[VoiceWebSocket] New connection: ${sessionId} (user: ${userId})`);

      // Create session
      const session: VoiceSession = {
        sessionId,
        userId,
        conversationId,
        ws,
        audioBuffer: [],
        isRecording: false,
        lastActivity: Date.now(),
        conversationHistory: []
      };

      this.sessions.set(sessionId, session);

      // Send connection confirmation
      this.sendMessage(ws, {
        type: 'connected',
        sessionId,
        message: 'Voice session established'
      });

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          session.lastActivity = Date.now();
          
          // Check if it's JSON (control message) or binary (audio)
          if (data[0] === 0x7B) { // '{' - JSON starts with {
            const message = JSON.parse(data.toString());
            await this.handleControlMessage(session, message);
          } else {
            // Binary audio data
            await this.handleAudioChunk(session, data);
          }
        } catch (error: unknown) {
          logger.error(`[VoiceWebSocket] Error handling message: ${error.message}`);
          this.sendMessage(ws, {
            type: 'error',
            message: error.message
          });
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        logger.info(`[VoiceWebSocket] Connection closed: ${sessionId}`);
        this.cleanupSession(sessionId);
      });

      ws.on('error', (error) => {
        logger.error(`[VoiceWebSocket] WebSocket error: ${error.message}`);
        this.cleanupSession(sessionId);
      });
    });

    // Cleanup old sessions periodically
    setInterval(() => this.cleanupOldSessions(), 60000); // Every minute

    logger.info('[VoiceWebSocket] Voice WebSocket server initialized');
  }

  /**
   * Handle control messages (JSON)
   */
  private async handleControlMessage(session: VoiceSession, message: any): Promise<void> {
    switch (message.type) {
      case 'start_recording':
        session.isRecording = true;
        session.audioBuffer = [];
        this.sendMessage(session.ws, {
          type: 'recording_started',
          message: 'Recording started'
        });
        break;

      case 'end_speech':
        // User stopped speaking, process the audio
        if (session.audioBuffer.length > 0) {
          await this.processAudio(session);
        }
        break;

      case 'stop_recording':
        session.isRecording = false;
        if (session.audioBuffer.length > 0) {
          await this.processAudio(session);
        }
        this.sendMessage(session.ws, {
          type: 'recording_stopped',
          message: 'Recording stopped'
        });
        break;

      case 'ping':
        this.sendMessage(session.ws, { type: 'pong' });
        break;

      default:
        logger.warn(`[VoiceWebSocket] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle audio chunk (binary)
   */
  private async handleAudioChunk(session: VoiceSession, audioData: Buffer): Promise<void> {
    if (!session.isRecording) {
      return; // Ignore audio if not recording
    }

    // Check buffer size
    const currentSize = session.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
    if (currentSize + audioData.length > this.AUDIO_BUFFER_SIZE) {
      logger.warn(`[VoiceWebSocket] Audio buffer overflow for session ${session.sessionId}`);
      this.sendMessage(session.ws, {
        type: 'error',
        message: 'Audio buffer overflow'
      });
      return;
    }

    session.audioBuffer.push(audioData);
    session.lastActivity = Date.now();

    // Send acknowledgment
    this.sendMessage(session.ws, {
      type: 'audio_received',
      bufferSize: currentSize + audioData.length
    });
  }

  /**
   * Process accumulated audio: transcribe → LLM → synthesize
   */
  private async processAudio(session: VoiceSession): Promise<void> {
    if (session.audioBuffer.length === 0) {
      return;
    }

    try {
      // Combine audio chunks
      const audioBuffer = Buffer.concat(session.audioBuffer);
      session.audioBuffer = []; // Clear buffer

      // Save to temp file for transcription
      const tempFilePath = join(tmpdir(), `voice-${session.sessionId}-${Date.now()}.webm`);
      await writeFile(tempFilePath, audioBuffer);

      // Send processing status
      this.sendMessage(session.ws, {
        type: 'processing',
        message: 'Transcribing audio...'
      });

      // Step 1: Transcribe audio
      let transcription: string;
      try {
        const transcriptionResult = await speechProviderService.transcribeAudio(
          tempFilePath,
          'audio/webm'
        );
        transcription = transcriptionResult.text;

        // Send transcription (interim)
        this.sendMessage(session.ws, {
          type: 'transcription',
          text: transcription,
          interim: false
        });
      } catch (error: unknown) {
        logger.error(`[VoiceWebSocket] Transcription failed: ${error.message}`);
        this.sendMessage(session.ws, {
          type: 'error',
          message: `Transcription failed: ${error.message}`
        });
        await unlink(tempFilePath).catch(() => {});
        return;
      }

      // Clean up temp file
      await unlink(tempFilePath).catch(() => {});

      if (!transcription || transcription.trim().length === 0) {
        this.sendMessage(session.ws, {
          type: 'error',
          message: 'No speech detected in audio'
        });
        return;
      }

      // Add to conversation history
      session.conversationHistory.push({
        role: 'user',
        content: transcription
      });

      // Step 2: Get LLM response
      this.sendMessage(session.ws, {
        type: 'processing',
        message: 'Generating response...'
      });

      try {
        // Build prompt with conversation history
        const historyPrompt = session.conversationHistory.length > 0
          ? `${session.conversationHistory.map(h => `${h.role}: ${h.content}`).join('\n')}\nuser: ${transcription}`
          : transcription;

        // Use executeWithFallback with internal router type for voice conversations
        // This allows us to track with requestType: 'voice' while using internal router
        const llmResponse = await llmRouter.executeWithFallback({
          prompt: historyPrompt,
          context: {
            agentRole: 'Voice Assistant',
            taskType: 'chat',
            systemInstruction: `You are a helpful voice assistant. Keep responses concise and conversational (1-3 sentences) for natural voice interaction. Be friendly and engaging.`,
            maxTokens: 150 // Limit for faster, shorter responses
          },
          routingContext: {
            userId: session.userId
          },
          requestType: 'voice-conversation', // Track as voice conversation
          contextType: 'other',
          routerType: 'internal' // Use internal router for cost optimization
        });

        const aiText = llmResponse.text;

        // Add to conversation history
        session.conversationHistory.push({
          role: 'agent',
          content: aiText
        });

        // Send text response
        this.sendMessage(session.ws, {
          type: 'ai_text',
          text: aiText
        });

        // Step 3: Synthesize speech
        this.sendMessage(session.ws, {
          type: 'processing',
          message: 'Generating audio...'
        });

        try {
          const synthesisResult = await speechProviderService.synthesizeSpeech(
            aiText,
            'alloy', // Default voice
            'en'
          );

          // Send audio response
          this.sendMessage(session.ws, {
            type: 'ai_audio',
            audio: synthesisResult.audioBuffer.toString('base64'),
            mimeType: synthesisResult.mimeType
          });

          // Update session in pipecat bridge (for conversation persistence)
          if (session.conversationId) {
            pipecatBridgeService.addTranscript(
              session.sessionId,
              transcription,
              aiText
            );
          }

          // Send completion message
          this.sendMessage(session.ws, {
            type: 'response_complete'
          });

        } catch (error: unknown) {
          logger.error(`[VoiceWebSocket] Synthesis failed: ${error.message}`);
          this.sendMessage(session.ws, {
            type: 'error',
            message: `Audio generation failed: ${error.message}`
          });
          // Still send completion so client returns to active state
          this.sendMessage(session.ws, {
            type: 'response_complete'
          });
        }

      } catch (error: unknown) {
        logger.error(`[VoiceWebSocket] LLM request failed: ${error.message}`);
        this.sendMessage(session.ws, {
          type: 'error',
          message: `AI response failed: ${error.message}`
        });
      }

    } catch (error: unknown) {
      logger.error(`[VoiceWebSocket] Error processing audio: ${error.message}`);
      this.sendMessage(session.ws, {
        type: 'error',
        message: `Processing failed: ${error.message}`
      });
    }
  }

  /**
   * Send JSON message to client
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Cleanup session
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ws.close();
      this.sessions.delete(sessionId);
      logger.info(`[VoiceWebSocket] Session cleaned up: ${sessionId}`);
    }
  }

  /**
   * Cleanup old/inactive sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastActivity;
      if (age > this.SESSION_TIMEOUT) {
        sessionsToDelete.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDelete) {
      logger.info(`[VoiceWebSocket] Cleaning up inactive session: ${sessionId}`);
      this.cleanupSession(sessionId);
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }
}

export const voiceWebSocketService = new VoiceWebSocketService();

