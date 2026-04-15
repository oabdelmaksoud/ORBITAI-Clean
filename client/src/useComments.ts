/**
 * useComments Hook
 * Manages comment CRUD operations with optimistic updates
 */

import { useState, useCallback } from 'react';

export interface Comment {
  _id: string;
  content: string;
  author: { _id: string; name: string; email?: string };
  resourceType: string;
  resourceId: string;
  reactions: Array<{ emoji: string; users: string[] }>;
  replies: Comment[];
  resolved: boolean;
  createdAt: string;
  mentions?: string[];
  [key: string]: unknown;
}

interface CreateCommentInput {
  content: string;
  resourceType: 'project' | 'task' | 'document';
  resourceId: string;
  mentions?: string[];
}

interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  fetchComments: (resourceType: string, resourceId: string) => Promise<void>;
  createComment: (data: CreateCommentInput) => Promise<void>;
  updateComment: (id: string, data: Partial<Comment>) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  replyToComment: (commentId: string, data: { content: string }) => Promise<void>;
  addReaction: (commentId: string, emoji: string) => Promise<void>;
  resolveComment: (id: string) => Promise<void>;
}

export function useComments(): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async (resourceType: string, resourceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/comments?resourceType=${resourceType}&resourceId=${resourceId}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch comments');
      }
      const data = await response.json();
      setComments(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createComment = useCallback(async (data: CreateCommentInput) => {
    setError(null);
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      _id: tempId,
      content: data.content,
      author: { _id: 'current-user', name: 'You' },
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      reactions: [],
      replies: [],
      resolved: false,
      createdAt: new Date().toISOString(),
      mentions: data.mentions,
    };
    setComments(prev => [...prev, optimisticComment]);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        // Revert optimistic update
        setComments(prev => prev.filter(c => c._id !== tempId));
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to create comment');
      }
      const newComment = await response.json();
      // Replace optimistic comment with real one
      setComments(prev =>
        prev.map(c => (c._id === tempId ? newComment : c))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const updateComment = useCallback(async (id: string, data: Partial<Comment>) => {
    setError(null);
    try {
      const response = await fetch(`/api/comments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update comment');
      }
      const updated = await response.json();
      setComments(prev =>
        prev.map(c => (c._id === id ? { ...c, ...updated } : c))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const deleteComment = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to delete comment');
      }
      setComments(prev => prev.filter(c => c._id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const replyToComment = useCallback(async (commentId: string, data: { content: string }) => {
    setError(null);
    try {
      const response = await fetch(`/api/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to reply');
      }
      const reply = await response.json();
      setComments(prev =>
        prev.map(c =>
          c._id === commentId
            ? { ...c, replies: [...c.replies, reply] }
            : c
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const addReaction = useCallback(async (commentId: string, emoji: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to add reaction');
      }
      const updated = await response.json();
      setComments(prev =>
        prev.map(c => (c._id === commentId ? { ...c, ...updated } : c))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const resolveComment = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/comments/${id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to resolve comment');
      }
      const updated = await response.json();
      setComments(prev =>
        prev.map(c => (c._id === id ? { ...c, ...updated } : c))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  return {
    comments,
    loading,
    error,
    fetchComments,
    createComment,
    updateComment,
    deleteComment,
    replyToComment,
    addReaction,
    resolveComment,
  };
}
