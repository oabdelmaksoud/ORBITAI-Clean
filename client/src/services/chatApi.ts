/**
 * Chat API Service
 * Handles chat conversation persistence
 */

import { apiRequest } from './api';
import { ChatMessage, Idea } from '@orbitai/shared';

// Re-export Idea for backwards compatibility with existing imports
export type { Idea } from '@orbitai/shared';

/**
 * Check if the current user is a guest (has guest token)
 */
function isGuestUser(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    // Guest tokens start with 'guest-token-' or are not valid JWTs
    return token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3;
  } catch (error) {
    return false;
  }
}

export interface ChatConversation {
  _id?: string;
  id?: string;
  userId?: string;
  projectId?: string;
  type: 'setup' | 'workspace' | 'agent' | 'neural-chat';
  messages: ChatMessage[];
  answers?: Record<string, any>;
  summary?: string;
  metadata?: {
    flowId?: string;
    currentQuestionId?: string;
    completed?: boolean;
    topic?: string;
    ideas?: Idea[];
    keyInsights?: string[];
    nextSteps?: string[];
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
  // For compatibility with NeuralStreamChat format
  title?: string;
  preview?: string;
  timestamp?: number;
  topic?: string;
  ideas?: Idea[];
  keyInsights?: string[];
  nextSteps?: string[];
  currentPhase?: number; // 0-3: Exploration, Definition, Prototyping, Launch
  projectPreview?: {
    summary?: string;
    techStack?: string[];
    wireframeCode?: string;
    architectureDiagram?: string;
    risks?: string[];
    recommendedMethodology?: 'V-Model' | 'Agile' | 'Waterfall' | 'LangGraph';
    recommendedStandards?: string[];
    estimatedSprints?: number;
    projectName?: string;
    mobileCode?: {
      reactNative?: string;
      flutter?: string;
      iosSwift?: string;
      androidKotlin?: string;
    };
  };
  activeIdeaId?: string | null;
  glassPanelActiveView?: 'context' | 'history' | 'maturity';
  prototypingStage?: 'ideation' | 'prototyping';
  folderId?: string;
}

export interface CreateConversationRequest {
  projectId?: string;
  folderId?: string;
  type: 'setup' | 'workspace' | 'agent' | 'neural-chat';
  initialMessage?: ChatMessage;
  messages?: ChatMessage[];
}

export interface AddMessageRequest {
  message: ChatMessage;
  answers?: Record<string, any>;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface UpdateAnswersRequest {
  answers: Record<string, any>;
  summary?: string;
  metadata?: Record<string, any>;
}

export const chatApi = {
  /**
   * Create a new conversation
   */
  async createConversation(data: CreateConversationRequest): Promise<ChatConversation> {
    // For guest users, return a local conversation object without API call
    if (isGuestUser()) {
      const guestError: any = new Error('Guest users cannot create conversations in database');
      // Set flags to suppress logging
      Object.defineProperty(guestError, 'isGuestError', { value: true, enumerable: true, writable: false });
      Object.defineProperty(guestError, 'suppressLogging', { value: true, enumerable: true, writable: false });
      throw guestError;
    }
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      '/api/chat/conversations',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Get conversations
   */
  async getConversations(params?: { projectId?: string; type?: string }): Promise<ChatConversation[]> {
    const queryParams = new URLSearchParams();
    if (params?.projectId) queryParams.append('projectId', params.projectId);
    if (params?.type) queryParams.append('type', params.type);

    const response = await apiRequest<{ success: boolean; data: { conversations: ChatConversation[] } }>(
      `/api/chat/conversations?${queryParams.toString()}`,
      {
        method: 'GET',
      }
    );
    return response.data.conversations;
  },

  /**
   * Get a specific conversation
   */
  async getConversation(id: string): Promise<ChatConversation> {
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${id}`,
      {
        method: 'GET',
      }
    );
    return response.data.conversation;
  },

  /**
   * Add a message to a conversation
   */
  async addMessage(conversationId: string, data: AddMessageRequest): Promise<ChatConversation> {
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Update answers and summary (for guided chat wizard)
   */
  async updateAnswers(conversationId: string, data: UpdateAnswersRequest): Promise<ChatConversation> {
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${conversationId}/answers`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Update full NeuralStreamChat conversation state
   */
  async updateNeuralChat(
    conversationId: string,
    data: {
      messages?: ChatMessage[];
      topic?: string;
      ideas?: Idea[];
      keyInsights?: string[];
      nextSteps?: string[];
      currentPhase?: number; // 0-3: Exploration, Definition, Prototyping, Launch
      projectPreview?: {
        summary?: string;
        techStack?: string[];
        wireframeCode?: string;
        architectureDiagram?: string;
        risks?: string[];
        recommendedMethodology?: 'V-Model' | 'Agile' | 'Waterfall' | 'LangGraph' | string;
        recommendedStandards?: string[];
        estimatedSprints?: number;
        projectName?: string;
        mobileCode?: {
          reactNative?: string;
          flutter?: string;
          iosSwift?: string;
          androidKotlin?: string;
        };
      };
      activeIdeaId?: string | null;
      glassPanelActiveView?: 'context' | 'history' | 'maturity';
      prototypingStage?: 'ideation' | 'prototyping';
      folderId?: string;
      projectId?: string; // Link conversation to project
    }
  ): Promise<ChatConversation> {
    const response = await apiRequest<{ success: boolean; data: { conversation: ChatConversation } }>(
      `/api/chat/conversations/${conversationId}/neural-chat`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data.conversation;
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    await apiRequest(`/api/chat/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get quick suggestions based on user input
   */
  async getQuickSuggestions(input: string, history?: any[]): Promise<Array<{ label: string; prompt: string }>> {
    try {
      const response = await apiRequest<{ success: boolean; data: Array<{ label: string; prompt: string }> }>(
        '/api/llm/quick-suggestions',
        {
          method: 'POST',
          body: JSON.stringify({ input, history }),
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  },
};




