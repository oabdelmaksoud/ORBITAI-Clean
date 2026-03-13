import { useState, useEffect, useCallback } from 'react';

interface Workspace {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  owner: {
    _id: string;
    name: string;
    email: string;
    avatar: string;
  };
  members: Array<{
    user: {
      _id: string;
      name: string;
      email: string;
      avatar: string;
    };
    role: string;
    joinedAt: string;
  }>;
  projects: string[];
  settings: {
    allowMemberInvite: boolean;
    requireApproval: boolean;
    defaultRole: string;
    maxMembers: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface CreateWorkspaceData {
  name: string;
  description?: string;
  settings?: Partial<Workspace['settings']>;
}

interface UpdateWorkspaceData {
  name?: string;
  description?: string;
  settings?: Partial<Workspace['settings']>;
}

export const useWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      const data = await response.json();
      setWorkspaces(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const createWorkspace = async (data: CreateWorkspaceData): Promise<Workspace> => {
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create workspace');
    }

    const newWorkspace = await response.json();
    setWorkspaces(prev => [...prev, newWorkspace]);
    return newWorkspace;
  };

  const updateWorkspace = async (id: string, data: UpdateWorkspaceData): Promise<Workspace> => {
    const response = await fetch(`/api/workspaces/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update workspace');
    }

    const updatedWorkspace = await response.json();
    setWorkspaces(prev =>
      prev.map(w => w._id === id ? updatedWorkspace : w)
    );
    return updatedWorkspace;
  };

  const deleteWorkspace = async (id: string): Promise<void> => {
    const response = await fetch(`/api/workspaces/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete workspace');
    }

    setWorkspaces(prev => prev.filter(w => w._id !== id));
  };

  const inviteMember = async (workspaceId: string, email: string, role: string, message?: string) => {
    const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, role, message })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite member');
    }

    return response.json();
  };

  const removeMember = async (workspaceId: string, memberId: string) => {
    const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove member');
    }

    // Refresh workspace data
    await fetchWorkspaces();
  };

  const updateMemberRole = async (workspaceId: string, memberId: string, role: string) => {
    const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update member role');
    }

    // Refresh workspace data
    await fetchWorkspaces();
  };

  return {
    workspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMember,
    removeMember,
    updateMemberRole,
    refetch: fetchWorkspaces
  };
};

export const useCurrentWorkspace = (workspaceId?: string) => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    const fetchWorkspace = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workspaces/${workspaceId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch workspace');
        }

        const data = await response.json();
        setWorkspace(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [workspaceId]);

  return { workspace, loading, error };
};
