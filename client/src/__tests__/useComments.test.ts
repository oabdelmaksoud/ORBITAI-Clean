import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useComments } from '../useComments';

// Mock fetch
global.fetch = vi.fn() as unknown as typeof fetch;

describe('useComments', () => {
  const mockComments = [
    {
      _id: '1',
      content: 'Test comment',
      author: {
        _id: 'user1',
        name: 'John Doe',
        email: 'john@example.com'
      },
      resourceType: 'project',
      resourceId: 'project1',
      reactions: [
        { emoji: '👍', users: ['user2', 'user3'] }
      ],
      replies: [],
      resolved: false,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: '2',
      content: 'Another comment',
      author: {
        _id: 'user2',
        name: 'Jane Doe',
        email: 'jane@example.com'
      },
      resourceType: 'project',
      resourceId: 'project1',
      reactions: [],
      replies: [],
      resolved: false,
      createdAt: '2026-01-02T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  describe('fetchComments', () => {
    it('should fetch comments for resource', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockComments
      });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      expect(result.current.comments).toEqual(mockComments);
      expect(result.current.loading).toBe(false);
    });

    it('should handle fetch error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Failed to fetch'));

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      expect(result.current.error).toBe('Failed to fetch');
    });
  });

  describe('createComment', () => {
    it('should create comment successfully', async () => {
      const newComment = {
        content: 'New comment',
        resourceType: 'project' as const,
        resourceId: 'project1'
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...newComment,
          _id: '3',
          author: { _id: 'user1', name: 'Test User' },
          reactions: [],
          replies: [],
          resolved: false,
          createdAt: new Date().toISOString()
        })
      });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.createComment(newComment);
      });

      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].content).toBe('New comment');
    });

    it('should include mentions in comment', async () => {
      const newComment = {
        content: 'Hey @john check this out',
        resourceType: 'project' as const,
        resourceId: 'project1',
        mentions: ['john']
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...newComment,
          _id: '3',
          author: { _id: 'user1', name: 'Test User' },
          reactions: [],
          replies: [],
          resolved: false,
          createdAt: new Date().toISOString()
        })
      });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.createComment(newComment);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newComment)
        })
      );
    });
  });

  describe('replyToComment', () => {
    it('should reply to comment successfully', async () => {
      const reply = {
        content: 'This is a reply'
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            _id: '3',
            ...reply,
            author: { _id: 'user1', name: 'Test User' },
            parentComment: '1',
            createdAt: new Date().toISOString()
          })
        });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      await act(async () => {
        await result.current.replyToComment('1', reply);
      });

      expect(result.current.comments[0].replies).toHaveLength(1);
    });
  });

  describe('addReaction', () => {
    it('should add reaction to comment', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockComments[0],
            reactions: [
              { emoji: '👍', users: ['user2', 'user3', 'user1'] }
            ]
          })
        });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      await act(async () => {
        await result.current.addReaction('1', '👍');
      });

      const comment = result.current.comments.find(c => c._id === '1');
      expect(comment?.reactions[0].users).toHaveLength(3);
    });

    it('should remove reaction if already exists', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockComments[0],
            reactions: [
              { emoji: '👍', users: ['user3'] }
            ]
          })
        });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      await act(async () => {
        await result.current.addReaction('1', '👍');
      });

      const comment = result.current.comments.find(c => c._id === '1');
      expect(comment?.reactions[0].users).toHaveLength(1);
    });
  });

  describe('resolveComment', () => {
    it('should resolve comment', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockComments[0],
            resolved: true
          })
        });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      await act(async () => {
        await result.current.resolveComment('1');
      });

      const comment = result.current.comments.find(c => c._id === '1');
      expect(comment?.resolved).toBe(true);
    });

    it('should reopen resolved comment', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ ...mockComments[0], resolved: true }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockComments[0],
            resolved: false
          })
        });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      await act(async () => {
        await result.current.resolveComment('1');
      });

      const comment = result.current.comments.find(c => c._id === '1');
      expect(comment?.resolved).toBe(false);
    });
  });

  describe('updateComment', () => {
    it('should update comment content', async () => {
      const updates = { content: 'Updated content' };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockComments[0],
            ...updates
          })
        });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      await act(async () => {
        await result.current.updateComment('1', updates);
      });

      const comment = result.current.comments.find(c => c._id === '1');
      expect(comment?.content).toBe('Updated content');
    });
  });

  describe('deleteComment', () => {
    it('should delete comment', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments('project', 'project1');
      });

      await act(async () => {
        await result.current.deleteComment('1');
      });

      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments.find(c => c._id === '1')).toBeUndefined();
    });
  });

  describe('optimistic updates', () => {
    it('should optimistically add comment', async () => {
      const newComment = {
        content: 'Optimistic comment',
        resourceType: 'project' as const,
        resourceId: 'project1'
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({
            ...newComment,
            _id: '3',
            author: { _id: 'user1', name: 'Test User' },
            reactions: [],
            replies: [],
            resolved: false,
            createdAt: new Date().toISOString()
          })
        }), 100))
      );

      const { result } = renderHook(() => useComments());

      act(() => {
        result.current.createComment(newComment);
      });

      // Should show optimistic comment immediately
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].content).toBe('Optimistic comment');

      // Wait for server response
      await waitFor(() => {
        expect(result.current.comments[0]._id).toBe('3');
      });
    });
  });
});
