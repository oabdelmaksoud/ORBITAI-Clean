/**
 * Brainstorming Room API Service
 * Handles API calls for brainstorming rooms
 */

import { apiRequest } from './api';

export interface BrainstormingRoom {
  id: string;
  name: string;
  description?: string;
  topic?: string;
  createdBy: string;
  ownerName?: string;
  participants: Array<{
    userId: string;
    userName: string;
    role: 'facilitator' | 'contributor' | 'observer';
    joinedAt: Date;
    lastSeen?: Date;
  }>;
  activeAttendees?: Array<{
    userId: string;
    userName: string;
    socketId?: string;
    cursorPosition?: { ideaId?: string; x?: number; y?: number };
    lastSeen: Date;
  }>;
  maxAttendees?: number;
  conversationId?: string;
  ideas?: Array<any>;
  hmwQuestions?: Array<any>;
  sessionTemplate?: 'brainstorm' | 'design-sprint' | 'mindmap' | 'custom';
  facilitatorTools?: any;
  versions?: Array<any>;
  currentVersion?: number;
  convertedToProject?: string;
  status: 'active' | 'archived' | 'converted';
  statistics?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoomData {
  name: string;
  description?: string;
  topic?: string;
  sessionTemplate?: 'brainstorm' | 'design-sprint' | 'mindmap' | 'custom';
  maxAttendees?: number;
}

export const brainstormingRoomApi = {
  /**
   * Get all rooms for the current user
   */
  async getRooms(status?: string, search?: string): Promise<BrainstormingRoom[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    
    const response = await apiRequest(`/api/brainstorming-rooms?${params.toString()}`);
    return response.rooms || [];
  },

  /**
   * Get a single room by ID
   */
  async getRoom(roomId: string): Promise<BrainstormingRoom> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}`);
    return response.room;
  },

  /**
   * Create a new room
   */
  async createRoom(data: CreateRoomData): Promise<BrainstormingRoom> {
    const response = await apiRequest('/api/brainstorming-rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.room;
  },

  /**
   * Auto-create a room (used when user starts chatting)
   */
  async autoCreateRoom(data: { name?: string; description?: string; topic?: string; conversationId?: string }): Promise<BrainstormingRoom> {
    const response = await apiRequest('/api/brainstorming-rooms/auto-create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.room;
  },

  /**
   * Update a room
   */
  async updateRoom(roomId: string, updates: Partial<BrainstormingRoom>): Promise<BrainstormingRoom> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.room;
  },

  /**
   * Join a room
   */
  async joinRoom(roomId: string, role?: 'facilitator' | 'contributor' | 'observer'): Promise<BrainstormingRoom> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    return response.room;
  },

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string): Promise<void> {
    await apiRequest(`/api/brainstorming-rooms/${roomId}/leave`, {
      method: 'POST',
    });
  },

  /**
   * Add an idea to a room
   */
  async addIdea(roomId: string, idea: any): Promise<{ idea: any; room: BrainstormingRoom }> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/ideas`, {
      method: 'POST',
      body: JSON.stringify(idea),
    });
    return response;
  },

  /**
   * Add an HMW question to a room
   */
  async addHMWQuestion(roomId: string, question: string, description?: string, linkedIdeas?: string[]): Promise<{ question: any; room: BrainstormingRoom }> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/hmw-questions`, {
      method: 'POST',
      body: JSON.stringify({ question, description, linkedIdeas }),
    });
    return response;
  },

  /**
   * Get version history for a room
   */
  async getVersions(roomId: string): Promise<any[]> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/versions`);
    return response.versions || [];
  },

  /**
   * Restore a version
   */
  async restoreVersion(roomId: string, versionNumber: number): Promise<BrainstormingRoom> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/versions/${versionNumber}/restore`, {
      method: 'POST',
    });
    return response.room;
  },

  /**
   * Convert room to project
   */
  async convertToProject(roomId: string): Promise<{ project: any; room: BrainstormingRoom }> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/convert-to-project`, {
      method: 'POST',
    });
    return response;
  },

  /**
   * Delete (archive) a room
   */
  async deleteRoom(roomId: string): Promise<void> {
    await apiRequest(`/api/brainstorming-rooms/${roomId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Detect sub-projects from ideas
   */
  async detectSubProjects(roomId: string): Promise<{ subProjects: Array<any> }> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/detect-sub-projects`, {
      method: 'POST',
    });
    return response;
  },

  /**
   * Convert sub-project to prototype (Phase 2 → 3)
   */
  async convertSubProjectToPrototype(roomId: string, subProjectId: string): Promise<{ subProject: any; room: BrainstormingRoom }> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/sub-projects/${subProjectId}/convert-to-prototype`, {
      method: 'POST',
    });
    return response;
  },

  /**
   * Launch sub-project to workspace (Phase 3 → 4)
   */
  async launchSubProjectToWorkspace(roomId: string, subProjectId: string): Promise<{ project: any; subProject: any; room: BrainstormingRoom }> {
    const response = await apiRequest(`/api/brainstorming-rooms/${roomId}/sub-projects/${subProjectId}/launch-to-workspace`, {
      method: 'POST',
    });
    return response;
  },
};
