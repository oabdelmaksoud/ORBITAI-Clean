/**
 * Collaborative Wiki API Service
 */

import { apiRequest } from './adminApi';

export interface CollaborativeDocument {
  id?: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  status: 'draft' | 'published' | 'archived';
  version?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  statistics?: {
    views: number;
    edits: number;
    contributors: number;
  };
  collaborators?: Array<{
    userId: string;
    role: 'viewer' | 'editor' | 'admin';
    joinedAt: string;
  }>;
  comments?: Array<{
    id: string;
    userId: string;
    content: string;
    createdAt: string;
  }>;
}

/**
 * Get all documents
 */
export async function getDocuments(
  token: string,
  filters?: { status?: string; category?: string; search?: string }
): Promise<CollaborativeDocument[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  const endpoint = `/api/admin/collaborative-wiki${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{
    success: boolean;
    data: CollaborativeDocument[];
  }>(endpoint, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch documents');
  }

  return response.data;
}

/**
 * Get document by ID
 */
export async function getDocument(token: string, id: string): Promise<CollaborativeDocument> {
  const response = await apiRequest<{
    success: boolean;
    data: CollaborativeDocument;
  }>(`/api/admin/collaborative-wiki/${id}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch document');
  }

  return response.data;
}

/**
 * Create document
 */
export async function createDocument(
  token: string,
  document: Omit<CollaborativeDocument, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'statistics'>
): Promise<CollaborativeDocument> {
  const response = await apiRequest<{
    success: boolean;
    data: CollaborativeDocument;
  }>('/api/admin/collaborative-wiki', {
    method: 'POST',
    body: JSON.stringify(document),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create document');
  }

  return response.data;
}

/**
 * Update document
 */
export async function updateDocument(
  token: string,
  id: string,
  document: Partial<CollaborativeDocument>
): Promise<CollaborativeDocument> {
  const response = await apiRequest<{
    success: boolean;
    data: CollaborativeDocument;
  }>(`/api/admin/collaborative-wiki/${id}`, {
    method: 'PUT',
    body: JSON.stringify(document),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update document');
  }

  return response.data;
}

/**
 * Delete document
 */
export async function deleteDocument(token: string, id: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>(`/api/admin/collaborative-wiki/${id}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete document');
  }
}

/**
 * Add comment
 */
export async function addComment(
  token: string,
  documentId: string,
  content: string
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>(`/api/admin/collaborative-wiki/${documentId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to add comment');
  }
}
















