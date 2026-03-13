import { apiRequest } from './api';
import { ProjectFolder } from '@orbitai/shared';

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

export interface CreateFolderRequest {
  name: string;
  description?: string;
  platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
  metadata?: Record<string, any>;
}

export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
  metadata?: Record<string, any>;
}

export const projectFolderApi = {
  /**
   * Create a new project folder
   */
  async createFolder(data: CreateFolderRequest): Promise<ProjectFolder> {
    const response = await apiRequest<{ success: boolean; data: { folder: any } }>(
      '/api/project-folders',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    const folder = response.data.folder;
    // Transform Mongoose document to ProjectFolder format
    return {
      id: folder._id || folder.id || '',
      userId: folder.userId || '',
      name: folder.name || '',
      description: folder.description,
      platforms: folder.platforms || folder.platform ? (Array.isArray(folder.platforms) ? folder.platforms : [folder.platform]) : ['other'],
      metadata: folder.metadata || {},
      conversationIds: folder.conversationIds || [],
      createdAt: folder.createdAt ? (typeof folder.createdAt === 'string' ? new Date(folder.createdAt).getTime() : new Date(folder.createdAt).getTime()) : Date.now(),
      updatedAt: folder.updatedAt ? (typeof folder.updatedAt === 'string' ? new Date(folder.updatedAt).getTime() : new Date(folder.updatedAt).getTime()) : Date.now()
    };
  },

  /**
   * Get all folders for the current user
   */
  async getFolders(): Promise<ProjectFolder[]> {
    // Return empty array for guest users (no API call needed)
    if (isGuestUser()) {
      return [];
    }
    const response = await apiRequest<{ success: boolean; data: { folders: any[] } }>(
      '/api/project-folders',
      {
        method: 'GET',
      }
    );
    // Transform Mongoose documents to ProjectFolder format
    return response.data.folders.map((folder: any) => ({
      id: folder._id || folder.id || '',
      userId: folder.userId || '',
      name: folder.name || '',
      description: folder.description,
      platforms: folder.platforms || folder.platform ? (Array.isArray(folder.platforms) ? folder.platforms : [folder.platform]) : ['other'],
      metadata: folder.metadata || {},
      conversationIds: folder.conversationIds || [],
      createdAt: folder.createdAt ? (typeof folder.createdAt === 'string' ? new Date(folder.createdAt).getTime() : new Date(folder.createdAt).getTime()) : Date.now(),
      updatedAt: folder.updatedAt ? (typeof folder.updatedAt === 'string' ? new Date(folder.updatedAt).getTime() : new Date(folder.updatedAt).getTime()) : Date.now()
    }));
  },

  /**
   * Get a specific folder by ID
   */
  async getFolder(id: string): Promise<ProjectFolder> {
    const response = await apiRequest<{ success: boolean; data: { folder: any } }>(
      `/api/project-folders/${id}`,
      {
        method: 'GET',
      }
    );
    const folder = response.data.folder;
    // Transform Mongoose document to ProjectFolder format
    return {
      id: folder._id || folder.id || '',
      userId: folder.userId || '',
      name: folder.name || '',
      description: folder.description,
      platforms: folder.platforms || folder.platform ? (Array.isArray(folder.platforms) ? folder.platforms : [folder.platform]) : ['other'],
      metadata: folder.metadata || {},
      conversationIds: folder.conversationIds || [],
      createdAt: folder.createdAt ? (typeof folder.createdAt === 'string' ? new Date(folder.createdAt).getTime() : new Date(folder.createdAt).getTime()) : Date.now(),
      updatedAt: folder.updatedAt ? (typeof folder.updatedAt === 'string' ? new Date(folder.updatedAt).getTime() : new Date(folder.updatedAt).getTime()) : Date.now()
    };
  },

  /**
   * Update a folder
   */
  async updateFolder(id: string, data: UpdateFolderRequest): Promise<ProjectFolder> {
    const response = await apiRequest<{ success: boolean; data: { folder: any } }>(
      `/api/project-folders/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    const folder = response.data.folder;
    // Transform Mongoose document to ProjectFolder format
    return {
      id: folder._id || folder.id || '',
      userId: folder.userId || '',
      name: folder.name || '',
      description: folder.description,
      platforms: folder.platforms || folder.platform ? (Array.isArray(folder.platforms) ? folder.platforms : [folder.platform]) : ['other'],
      metadata: folder.metadata || {},
      conversationIds: folder.conversationIds || [],
      createdAt: folder.createdAt ? (typeof folder.createdAt === 'string' ? new Date(folder.createdAt).getTime() : new Date(folder.createdAt).getTime()) : Date.now(),
      updatedAt: folder.updatedAt ? (typeof folder.updatedAt === 'string' ? new Date(folder.updatedAt).getTime() : new Date(folder.updatedAt).getTime()) : Date.now()
    };
  },

  /**
   * Delete a folder
   * @param id Folder ID
   * @param hardDelete If true, deletes all conversations in the folder. If false, moves them to Unorganized.
   */
  async deleteFolder(id: string, hardDelete: boolean = false): Promise<void> {
    const query = hardDelete ? '?hardDelete=true' : '';
    await apiRequest<{ success: boolean; message: string }>(
      `/api/project-folders/${id}${query}`,
      {
        method: 'DELETE',
      }
    );
  },

  /**
   * Add a conversation to a folder
   */
  async addConversationToFolder(folderId: string, conversationId: string): Promise<void> {
    await apiRequest<{ success: boolean; message: string }>(
      `/api/project-folders/${folderId}/conversations/${conversationId}`,
      {
        method: 'POST',
      }
    );
  },

  /**
   * Remove a conversation from a folder (moves to Unorganized)
   */
  async removeConversationFromFolder(folderId: string, conversationId: string): Promise<void> {
    await apiRequest<{ success: boolean; message: string }>(
      `/api/project-folders/${folderId}/conversations/${conversationId}`,
      {
        method: 'DELETE',
      }
    );
  },

  /**
   * Move a conversation to a folder
   */
  async moveConversation(conversationId: string, folderId: string | null): Promise<void> {
    await apiRequest<{ success: boolean; data: { conversation: any } }>(
      `/api/chat/conversations/${conversationId}/folder`,
      {
        method: 'PUT',
        body: JSON.stringify({ folderId }),
      }
    );
  },
};

