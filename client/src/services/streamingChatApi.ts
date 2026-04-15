/**
 * Streaming Chat API Service
 * Handles streaming chat conversations with Server-Sent Events
 */

import { apiRequest } from './api';
import { ChatMessage } from '@orbitai/shared';

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '';

export interface StreamChatOptions {
  message: string;
  history?: Array<{ role: string; content: string }>;
  projectState?: {
    id?: string;
    [key: string]: any;
  };
  contextType?: 'wizard' | 'workspace' | 'other';
  preferFastModel?: boolean;
  maxTokens?: number;
  systemContext?: string; // Optional custom system prompt overrides
  generationSessionId?: string; // For real-time Mission Control updates
  useInternet?: boolean; // Enable internet research/Google Search grounding
}

/**
 * Stream chat message - yields chunks as they arrive
 */
export async function* streamChatMessage(
  options: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const { message, history, projectState, contextType, preferFastModel, maxTokens, systemContext, generationSessionId, useInternet } = options;

  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  // Try backend API first
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true', // Allow requests through localtunnel
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Create AbortController with 3-minute timeout for long streaming responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

    const response = await fetch(`${API_BASE_URL}/api/llm/chat/stream`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        message,
        history,
        projectState,
        contextType,
        preferFastModel,
        maxTokens,
        systemContext,
        generationSessionId,
        useInternet
      }),
    });

    // Clear timeout once we get a response
    clearTimeout(timeoutId);

    if (!response.ok) {
      // If 404/500, throw to trigger fallback
      throw new Error(`Backend API error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep the incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.chunk) {
              yield parsed.chunk;
            }
            if (parsed.done) {
              return;
            }
            if (parsed.error) {
              console.error('Stream error from backend:', parsed.error);
              // Don't throw here to allow partial response, or handle as needed
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Chat service unavailable';
    yield errMessage;
    return;
  }
}

/**
 * Convert ChatMessage array to history format for API
 */
export function messagesToHistory(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages
    .filter(msg => msg.sender === 'user' || msg.sender === 'agent')
    .map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
}

