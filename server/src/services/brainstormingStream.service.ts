/**
 * Brainstorming Real-Time Streaming Service
 * Emits ideas as they are generated for real-time updates
 */

import { webSocketService } from './websocket.service.js';
import { BrainstormingRoom } from '../models/BrainstormingRoom.model.js';
import { logger } from '../utils/logger.js';

export interface StreamingIdea {
  id: string;
  label: string;
  description?: string;
  category?: string;
  priority?: number;
  evaluation?: {
    feasibility: number;
    impact: number;
    innovation: number;
    alignment: number;
    overall: number;
  };
  isPartial?: boolean; // True if more ideas coming
  totalCount?: number; // Total ideas being generated
}

export interface StreamingResult {
  roomId: string;
  framework: string;
  ideas: StreamingIdea[];
  complete: boolean;
  timestamp: Date;
}

/**
 * Emit idea as it's generated (for real-time streaming)
 */
export async function emitIdea(
  roomId: string,
  idea: StreamingIdea,
  totalCount: number,
  currentIndex: number
): Promise<void> {
  try {
    // Add to room in database
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (room) {
      const ideas = room.ideas || [];
      ideas.push({
        id: idea.id,
        label: idea.label,
        description: idea.description,
        category: idea.category,
        priority: idea.priority || 0,
        tags: [],
        createdAt: new Date(),
        createdBy: 'Brainstorming Agent',
        evaluation: idea.evaluation,
        isImported: false
      });
      
      await BrainstormingRoom.updateOne(
        { id: roomId },
        { $set: { ideas, lastModified: new Date() } }
      );
    }

    // Emit via WebSocket
    webSocketService.emitToRoom(`brainstorming-room:${roomId}`, 'idea-generated', {
      idea,
      progress: currentIndex + 1,
      total: totalCount,
      timestamp: new Date()
    });

    logger.debug(`[BrainstormingStream] Emitted idea ${currentIndex + 1}/${totalCount}: ${idea.label}`);
  } catch (error: unknown) {
    logger.warn(`[BrainstormingStream] Failed to emit idea:`, error);
  }
}

/**
 * Emit generation started event
 */
export function emitGenerationStarted(roomId: string, framework: string, count: number): void {
  webSocketService.emitToRoom(`brainstorming-room:${roomId}`, 'generation-started', {
    framework,
    count,
    timestamp: new Date()
  });
}

/**
 * Emit generation completed event
 */
export async function emitGenerationCompleted(
  roomId: string,
  framework: string,
  totalIdeas: number
): Promise<void> {
  // Update room
  await BrainstormingRoom.updateOne(
    { id: roomId },
    { $set: { 'agentActivity.lastGeneration': new Date(), lastModified: new Date() } }
  );

  // Emit completion
  webSocketService.emitToRoom(`brainstorming-room:${roomId}`, 'generation-completed', {
    framework,
    totalIdeas,
    timestamp: new Date()
  });
}

/**
 * Emit generation error
 */
export function emitGenerationError(roomId: string, error: string): void {
  webSocketService.emitToRoom(`brainstorming-room:${roomId}`, 'generation-error', {
    error,
    timestamp: new Date()
  });
}

export const brainstormingStreamService = {
  emitIdea,
  emitGenerationStarted,
  emitGenerationCompleted,
  emitGenerationError
};
