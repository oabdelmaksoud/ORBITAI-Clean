import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkspaces } from '../hooks/useWorkspaces';

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

describe('useWorkspaces', () => {
  const mockWorkspaces = [
    {
      _id: '1',
      name: 'Workspace 1',
      slug: 'workspace-1',
      description: 'Test workspace',
      owner: { _id: 'user1', name: 'John', email: 'john@test.com', avatar: '' },
      members: [],
      projects: [],
      settings: { allowMemberInvite: true, requireApproval: false, defaultRole: 'member', maxMembers: 50 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  // The hook auto-fetches on mount
  function mockInitialFetch(data = mockWorkspaces) {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('fetchWorkspaces', () => {
    it('should fetch workspaces on mount', async () => {
      mockInitialFetch();

      const { result } = renderHook(() => useWorkspaces());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.workspaces).toEqual(mockWorkspaces);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch error on mount', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useWorkspaces());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('createWorkspace', () => {
    it('should create workspace successfully', async () => {
      mockInitialFetch([]);

      const { result } = renderHook(() => useWorkspaces());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newWorkspace = { ...mockWorkspaces[0], _id: '2', name: 'New Workspace' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => newWorkspace,
      });

      await act(async () => {
        await result.current.createWorkspace({ name: 'New Workspace' });
      });

      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.workspaces[0].name).toBe('New Workspace');
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace', async () => {
      mockInitialFetch();

      const { result } = renderHook(() => useWorkspaces());

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(1);
      });

      // Delete returns ok, then refetch is called
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      await act(async () => {
        await result.current.deleteWorkspace('1');
      });

      expect(result.current.workspaces).toHaveLength(0);
    });
  });
});
