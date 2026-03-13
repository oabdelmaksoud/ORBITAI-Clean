import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWorkspaces } from '../hooks/useWorkspaces';

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

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (data: { name: string; description?: string }) => Promise<Workspace>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  inviteMember: (workspaceId: string, email: string, role: string, message?: string) => Promise<any>;
  removeMember: (workspaceId: string, memberId: string) => Promise<void>;
  updateMemberRole: (workspaceId: string, memberId: string, role: string) => Promise<void>;
  refetch: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const {
    workspaces,
    loading,
    error,
    createWorkspace: create,
    updateWorkspace: update,
    deleteWorkspace: deleteWS,
    inviteMember: invite,
    removeMember: remove,
    updateMemberRole: updateRole,
    refetch
  } = useWorkspaces();

  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  // Load last selected workspace from localStorage
  useEffect(() => {
    const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
    if (savedWorkspaceId && workspaces.length > 0) {
      const savedWorkspace = workspaces.find(w => w._id === savedWorkspaceId);
      if (savedWorkspace) {
        setCurrentWorkspace(savedWorkspace);
      }
    } else if (workspaces.length > 0 && !currentWorkspace) {
      // Default to first workspace if none selected
      setCurrentWorkspace(workspaces[0]);
    }
  }, [workspaces]);

  // Save selected workspace to localStorage
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem('currentWorkspaceId', currentWorkspace._id);
    } else {
      localStorage.removeItem('currentWorkspaceId');
    }
  }, [currentWorkspace]);

  const handleSetCurrentWorkspace = (workspace: Workspace | null) => {
    setCurrentWorkspace(workspace);
  };

  const createWorkspace = async (data: { name: string; description?: string }) => {
    const newWorkspace = await create(data);
    if (!currentWorkspace) {
      setCurrentWorkspace(newWorkspace);
    }
    return newWorkspace;
  };

  const updateWorkspace = async (id: string, data: Partial<Workspace>) => {
    const updatedWorkspace = await update(id, data);
    if (currentWorkspace?._id === id) {
      setCurrentWorkspace(updatedWorkspace);
    }
    return updatedWorkspace;
  };

  const deleteWorkspace = async (id: string) => {
    await deleteWS(id);
    if (currentWorkspace?._id === id) {
      // Switch to another workspace or set to null
      const remainingWorkspaces = workspaces.filter(w => w._id !== id);
      setCurrentWorkspace(remainingWorkspaces[0] || null);
    }
  };

  const inviteMember = async (workspaceId: string, email: string, role: string, message?: string) => {
    const result = await invite(workspaceId, email, role, message);
    // Refresh workspace data to show new member
    await refetch();
    return result;
  };

  const removeMember = async (workspaceId: string, memberId: string) => {
    await remove(workspaceId, memberId);
  };

  const updateMemberRole = async (workspaceId: string, memberId: string, role: string) => {
    await updateRole(workspaceId, memberId, role);
  };

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    loading,
    error,
    setCurrentWorkspace: handleSetCurrentWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMember,
    removeMember,
    updateMemberRole,
    refetch
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
};

export default WorkspaceContext;
