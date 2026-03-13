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
    console.warn('Streaming chat failed, falling back to mock:', error);

    // --- MOCK FALLBACK ---
    console.log('[StreamingChat] EXECUTING WITH MOCK IMPLEMENTATION (Fallback)');

    // Simulate network delay to make it feel realistic
    await new Promise(resolve => setTimeout(resolve, 600));

    let mockResponse = "";
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('snake')) {
      mockResponse = "I can help you build a Snake game! 🐍\n\nHere's a plan to get started:\n\n1.  **Game Board**: A grid-based canvas.\n2.  **Snake Logic**: Movement vectors and tail growth.\n3.  **Food**: Random placement logic.\n4.  **Collision Detected**: Wall and self-collision checks.\n\nShall we start by setting up the project structure?";
    } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      mockResponse = "Hello! I am Raed, your OrbitAI Orchestrator. I'm running in MOCK mode to assist you without API keys.\n\nWhat would you like to build today?";
    } else if (lowerMsg.includes('error') || lowerMsg.includes('fail')) {
      mockResponse = "I noticed you mentioned an error. Since I'm in mock mode, I can simulate debugging steps or help you check your configuration.";
    } else {
      mockResponse = `I received your message: "${message}".\n\nAs I am currently operating in mock mode (because I couldn't connect to the backend AI), I can help you structure your project, generate standard boilerplates, or guide you through the SDLC phases manually.
      
<idea>
<title>Project Setup</title>
<description>Initialize repository and project structure</description>
<category>feature</category>
</idea>
<idea>
<title>Frontend Architecture</title>
<description>React with TypeScript and Vite</description>
<category>technology</category>
</idea>
<idea>
<title>Backend API</title>
<description>Node.js Express server</description>
<category>technology</category>
</idea>
<idea>
<title>User Authentication</title>
<description>Login/Signup flows</description>
<category>feature</category>
</idea>`;
    }

    // Stream the response in chunks
    const chunkSize = 5;
    for (let i = 0; i < mockResponse.length; i += chunkSize) {
      const chunk = mockResponse.slice(i, i + chunkSize);
      yield chunk;
      // Random delay between chunks for realistic typing effect
      await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 30));
    }
  }
}

/**
 * Convert ChatMessage array to history format for API
 */
export function messagesToHistory(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages
    .filter(msg => msg.sender === 'user' || msg.sender === 'agent')
    .map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'agent',
      content: msg.text
    }));
}

