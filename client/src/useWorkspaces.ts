/**
 * useWorkspaces Hook
 * Manages workspace CRUD operations
 */

import { useState, useCallback } from 'react';

export interface Workspace {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  owner?: string;
  members?: unknown[];
  createdAt?: string;
  [key: string]: unknown;
}

interface UseWorkspacesReturn {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (data: { name: string; description?: string }) => Promise<void>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  inviteMember: (workspaceId: string, data: { email: string; role: string }) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace) => void;
}

export function useWorkspaces(): UseWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/workspaces', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch workspaces');
      }
      const data = await response.json();
      setWorkspaces(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorkspace = useCallback(async (data: { name: string; description?: string }) => {
    if (!data.name) {
      throw new Error('Workspace name is required');
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        setError(errData.message || 'Validation failed');
        return;
      }
      const newWorkspace = await response.json();
      setWorkspaces(prev => [...prev, newWorkspace]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWorkspace = useCallback(async (id: string, data: Partial<Workspace>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update workspace');
      }
      const updated = await response.json();
      setWorkspaces(prev =>
        prev.map(w => (w._id === id ? { ...w, ...updated } : w))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to delete workspace');
      }
      setWorkspaces(prev => prev.filter(w => w._id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const inviteMember = useCallback(async (workspaceId: string, data: { email: string; role: string }) => {
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to invite member');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  return {
    workspaces,
    currentWorkspace,
    loading,
    error,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMember,
    setCurrentWorkspace,
  };
}
