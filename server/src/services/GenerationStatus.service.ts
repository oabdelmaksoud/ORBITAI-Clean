/**
 * Generation Status Service - Real-time status updates for Mission Control
 * Emits actual process info and AI thoughts via WebSocket
 */

import { logger } from '../utils/logger.js';

// Generation status event types
export interface GenerationStatusEvent {
    type: 'ai_thought' | 'process_stage' | 'model_selection' | 'progress' | 'debug' | 'error' | 'complete';
    message: string;
    timestamp: number;
    metadata?: {
        model?: string;
        provider?: string;
        stage?: string;
        progress?: number;
        agentName?: string;
        duration?: number;
        tokenCount?: number;
        cost?: number;
        details?: string;
    };
}

// Session tracking for multiple concurrent generations
interface GenerationSession {
    sessionId: string;
    userId?: string;
    startTime: number;
    events: GenerationStatusEvent[];
    progress: number;
    isComplete: boolean;
}

class GenerationStatusService {
    private sessions: Map<string, GenerationSession> = new Map();
    private socketEmitter: ((sessionId: string, event: GenerationStatusEvent) => void) | null = null;

    /**
     * Register the WebSocket emitter function
     * Called by websocket.service when it initializes
     */
    setSocketEmitter(emitter: (sessionId: string, event: GenerationStatusEvent) => void): void {
        this.socketEmitter = emitter;
        logger.info('[GenerationStatus] Socket emitter registered');
    }

    /**
     * Create a new generation session
     */
    createSession(userId?: string): string {
        const sessionId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session: GenerationSession = {
            sessionId,
            userId,
            startTime: Date.now(),
            events: [],
            progress: 0,
            isComplete: false
        };
        this.sessions.set(sessionId, session);

        logger.info(`[GenerationStatus] Session created: ${sessionId}`);
        return sessionId;
    }

    /**
     * Emit an AI thought - when the model is "thinking" or making decisions
     */
    emitAIThought(sessionId: string, message: string, metadata?: Partial<GenerationStatusEvent['metadata']>): void {
        this.emit(sessionId, {
            type: 'ai_thought',
            message: `🧠 ${message}`,
            timestamp: Date.now(),
            metadata
        });
    }

    /**
     * Emit a process stage update - actual work being done
     */
    emitProcessStage(sessionId: string, message: string, metadata?: Partial<GenerationStatusEvent['metadata']>): void {
        this.emit(sessionId, {
            type: 'process_stage',
            message: `🔄 ${message}`,
            timestamp: Date.now(),
            metadata
        });
    }

    /**
     * Emit model selection info - which AI model was chosen and why
     */
    emitModelSelection(sessionId: string, model: string, provider: string, reason?: string): void {
        this.emit(sessionId, {
            type: 'model_selection',
            message: `⚡ Model Selected: ${model} via ${provider}${reason ? ` (${reason})` : ''}`,
            timestamp: Date.now(),
            metadata: { model, provider, details: reason }
        });
    }

    /**
     * Emit progress update with actual percentage
     */
    emitProgress(sessionId: string, progress: number, stage?: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.progress = progress;
        }

        this.emit(sessionId, {
            type: 'progress',
            message: `📊 Progress: ${Math.round(progress)}%${stage ? ` - ${stage}` : ''}`,
            timestamp: Date.now(),
            metadata: { progress, stage }
        });
    }

    /**
     * Emit debug information (for detailed logging)
     */
    emitDebug(sessionId: string, message: string, metadata?: Partial<GenerationStatusEvent['metadata']>): void {
        this.emit(sessionId, {
            type: 'debug',
            message: `🔧 ${message}`,
            timestamp: Date.now(),
            metadata
        });
    }

    /**
     * Emit error information
     */
    emitError(sessionId: string, message: string, metadata?: Partial<GenerationStatusEvent['metadata']>): void {
        this.emit(sessionId, {
            type: 'error',
            message: `❌ ${message}`,
            timestamp: Date.now(),
            metadata
        });
    }

    /**
     * Emit completion event
     */
    emitComplete(sessionId: string, durationMs?: number): void {
        const session = this.sessions.get(sessionId);
        const duration = durationMs || (session ? Date.now() - session.startTime : 0);

        if (session) {
            session.isComplete = true;
            session.progress = 100;
        }

        this.emit(sessionId, {
            type: 'complete',
            message: `✅ Generation complete (${(duration / 1000).toFixed(1)}s)`,
            timestamp: Date.now(),
            metadata: { duration, progress: 100 }
        });
    }

    /**
     * Core emit function - broadcasts to WebSocket and stores in session
     */
    private emit(sessionId: string, event: GenerationStatusEvent): void {
        // Store event in session
        const session = this.sessions.get(sessionId);
        if (session) {
            session.events.push(event);
        }

        // Broadcast via WebSocket if registered
        if (this.socketEmitter) {
            try {
                this.socketEmitter(sessionId, event);
                logger.info(`[GenerationStatus] Emitted ${event.type}: ${event.message} (session: ${sessionId.substring(0, 20)}...)`);
            } catch (error) {
                logger.error('[GenerationStatus] Failed to emit via WebSocket:', error);
            }
        } else {
            logger.warn(`[GenerationStatus] No socket emitter registered - cannot broadcast event: ${event.message}`);
        }
    }

    /**
     * Get all events for a session
     */
    getSessionEvents(sessionId: string): GenerationStatusEvent[] {
        const session = this.sessions.get(sessionId);
        return session?.events || [];
    }

    /**
     * Get current progress for a session
     */
    getSessionProgress(sessionId: string): number {
        const session = this.sessions.get(sessionId);
        return session?.progress || 0;
    }

    /**
     * Clean up old sessions (called periodically)
     */
    cleanupSessions(maxAgeMs: number = 3600000): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.isComplete && now - session.startTime > maxAgeMs) {
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info(`[GenerationStatus] Cleaned up ${cleaned} old sessions`);
        }
    }

    /**
     * End a session
     */
    endSession(sessionId: string): void {
        this.sessions.delete(sessionId);
        logger.info(`[GenerationStatus] Session ended: ${sessionId}`);
    }
}

// Export singleton instance
export const generationStatusService = new GenerationStatusService();

// Cleanup old sessions every hour
setInterval(() => {
    generationStatusService.cleanupSessions();
}, 3600000);
