import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkspaces } from '../useWorkspaces';
import { WorkspaceContext } from '../../contexts/WorkspaceContext';

// Mock fetch
global.fetch = jest.fn();

describe('useWorkspaces', () => {
  const mockWorkspaces = [
    {
      _id: '1',
      name: 'Workspace 1',
      slug: 'workspace-1',
      description: 'Test workspace 1',
      owner: 'user1',
      members: [],
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: '2',
      name: 'Workspace 2',
      slug: 'workspace-2',
      description: 'Test workspace 2',
      owner: 'user1',
      members: [],
      createdAt: '2026-01-02T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchWorkspaces', () => {
    it('should fetch workspaces successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspaces
      });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      expect(result.current.workspaces).toEqual(mockWorkspaces);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });

    it('should set loading state during fetch', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => mockWorkspaces
        }), 100))
      );

      const { result } = renderHook(() => useWorkspaces());

      act(() => {
        result.current.fetchWorkspaces();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('createWorkspace', () => {
    it('should create workspace successfully', async () => {
      const newWorkspace = {
        name: 'New Workspace',
        description: 'Test'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...newWorkspace, _id: '3' })
      });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.createWorkspace(newWorkspace);
      });

      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.workspaces[0].name).toBe('New Workspace');
    });

    it('should validate workspace name', async () => {
      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        try {
          await result.current.createWorkspace({ name: '' });
        } catch (error: any) {
          expect(error.message).toContain('name');
        }
      });
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace successfully', async () => {
      const updatedData = { name: 'Updated Name' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorkspaces
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockWorkspaces[0], ...updatedData })
        });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      await act(async () => {
        await result.current.updateWorkspace('1', updatedData);
      });

      const updated = result.current.workspaces.find(w => w._id === '1');
      expect(updated?.name).toBe('Updated Name');
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace successfully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWorkspaces
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      await act(async () => {
        await result.current.deleteWorkspace('1');
      });

      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.workspaces.find(w => w._id === '1')).toBeUndefined();
    });
  });

  describe('inviteMember', () => {
    it('should invite member successfully', async () => {
      const inviteData = {
        email: 'test@example.com',
        role: 'member'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Invitation sent' })
      });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.inviteMember('1', inviteData);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/workspaces/1/members',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(inviteData)
        })
      );
    });
  });

  describe('setCurrentWorkspace', () => {
    it('should set current workspace', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspaces
      });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      act(() => {
        result.current.setCurrentWorkspace(mockWorkspaces[0]);
      });

      expect(result.current.currentWorkspace).toEqual(mockWorkspaces[0]);
    });
  });

  describe('error handling', () => {
    it('should handle unauthorized error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' })
      });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      expect(result.current.error).toContain('Unauthorized');
    });

    it('should handle validation error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Validation failed' })
      });

      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await result.current.createWorkspace({ name: 'Test' });
      });

      expect(result.current.error).toContain('Validation');
    });
  });
});
