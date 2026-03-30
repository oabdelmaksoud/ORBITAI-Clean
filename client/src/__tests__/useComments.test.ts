import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComments } from '../hooks/useComments';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn().mockReturnValue('test-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('useComments', () => {
  const mockComments = [
    {
      _id: '1',
      workspace: 'ws1',
      project: 'proj1',
      resourceType: 'project',
      resourceId: 'project1',
      author: { _id: 'user1', name: 'John', avatar: '' },
      content: 'Test comment',
      mentions: [],
      reactions: [],
      isResolved: false,
      isEdited: false,
      isDeleted: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('fetchComments', () => {
    it('should fetch comments for resource', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockComments,
      });

      const { result } = renderHook(() => useComments('project', 'project1'));

      await act(async () => {
        await result.current.fetchComments();
      });

      expect(result.current.comments).toEqual(mockComments);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useComments('project', 'project1'));

      await act(async () => {
        await result.current.fetchComments();
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should not fetch without resourceType/resourceId', async () => {
      const { result } = renderHook(() => useComments());

      await act(async () => {
        await result.current.fetchComments();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('createComment', () => {
    it('should create comment and add to state', async () => {
      const newComment = { ...mockComments[0], _id: '2', content: 'New comment' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => newComment,
      });

      const { result } = renderHook(() => useComments('project', 'project1'));

      await act(async () => {
        await result.current.createComment({
          workspace: 'ws1',
          project: 'proj1',
          resourceType: 'project',
          resourceId: 'project1',
          content: 'New comment',
        });
      });

      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].content).toBe('New comment');
    });
  });

  describe('deleteComment', () => {
    it('should delete comment from state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockComments,
      });

      const { result } = renderHook(() => useComments('project', 'project1'));

      await act(async () => {
        await result.current.fetchComments();
      });

      expect(result.current.comments).toHaveLength(1);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await act(async () => {
        await result.current.deleteComment('1');
      });

      expect(result.current.comments).toHaveLength(0);
    });
  });
});
