import { useState, useCallback } from 'react';

interface Comment {
  _id: string;
  workspace: string;
  project: string;
  resourceType: string;
  resourceId: string;
  parentComment?: string;
  author: {
    _id: string;
    name: string;
    avatar: string;
  };
  content: string;
  mentions: string[];
  reactions: Array<{
    user: {
      _id: string;
      name: string;
      avatar: string;
    };
    type: 'thumbs_up' | 'thumbs_down' | 'heart' | 'fire' | 'rocket' | 'eyes';
    createdAt: string;
  }>;
  isResolved: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateCommentData {
  workspace: string;
  project: string;
  resourceType: string;
  resourceId: string;
  content: string;
  parentComment?: string;
}

interface UpdateCommentData {
  content: string;
}

export const useComments = (resourceType?: string, resourceId?: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!resourceType || !resourceId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        resourceType,
        resourceId
      });

      const response = await fetch(`/api/comments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  const createComment = async (data: CreateCommentData): Promise<Comment> => {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create comment');
    }

    const newComment = await response.json();
    setComments(prev => [...prev, newComment]);
    return newComment;
  };

  const updateComment = async (id: string, data: UpdateCommentData): Promise<Comment> => {
    const response = await fetch(`/api/comments/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update comment');
    }

    const updatedComment = await response.json();
    setComments(prev =>
      prev.map(c => c._id === id ? updatedComment : c)
    );
    return updatedComment;
  };

  const deleteComment = async (id: string): Promise<void> => {
    const response = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete comment');
    }

    setComments(prev => prev.filter(c => c._id !== id));
  };

  const replyToComment = async (commentId: string, content: string): Promise<Comment> => {
    const response = await fetch(`/api/comments/${commentId}/reply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reply to comment');
    }

    const reply = await response.json();
    setComments(prev => [...prev, reply]);
    return reply;
  };

  const addReaction = async (commentId: string, type: Comment['reactions'][0]['type']): Promise<Comment> => {
    const response = await fetch(`/api/comments/${commentId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add reaction');
    }

    const updatedComment = await response.json();
    setComments(prev =>
      prev.map(c => c._id === commentId ? updatedComment : c)
    );
    return updatedComment;
  };

  const removeReaction = async (commentId: string): Promise<Comment> => {
    const response = await fetch(`/api/comments/${commentId}/reactions`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove reaction');
    }

    const updatedComment = await response.json();
    setComments(prev =>
      prev.map(c => c._id === commentId ? updatedComment : c)
    );
    return updatedComment;
  };

  const resolveComment = async (commentId: string): Promise<Comment> => {
    const response = await fetch(`/api/comments/${commentId}/resolve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resolve comment');
    }

    const updatedComment = await response.json();
    setComments(prev =>
      prev.map(c => c._id === commentId ? updatedComment : c)
    );
    return updatedComment;
  };

  const getThreadReplies = async (commentId: string): Promise<Comment[]> => {
    const response = await fetch(`/api/comments/${commentId}/thread`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get thread replies');
    }

    return response.json();
  };

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
    removeReaction,
    resolveComment,
    getThreadReplies
  };
};
