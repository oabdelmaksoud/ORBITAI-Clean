import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Workspace {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  members: Array<{
    user: {
      _id: string;
      name: string;
      avatar: string;
    };
    role: string;
  }>;
  projects: string[];
}

interface WorkspaceSelectorProps {
  currentWorkspace?: Workspace;
  onWorkspaceChange?: (workspace: Workspace) => void;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  currentWorkspace,
  onWorkspaceChange
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSelect = (workspace: Workspace) => {
    onWorkspaceChange?.(workspace);
    setIsOpen(false);
    navigate(`/workspace/${workspace.slug}`);
  };

  const handleCreateWorkspace = () => {
    navigate('/workspace/create');
    setIsOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-slate-800 rounded-lg">
        <div className="w-8 h-8 bg-slate-700 rounded animate-pulse"></div>
        <div className="w-32 h-4 bg-slate-700 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Current Workspace Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors w-full text-left"
      >
        {currentWorkspace ? (
          <>
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-semibold text-sm">
              {currentWorkspace.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {currentWorkspace.name}
              </div>
              <div className="text-xs text-slate-400">
                {currentWorkspace.members.length} members
              </div>
            </div>
          </>
        ) : (
          <div className="text-slate-400 text-sm">Select workspace</div>
        )}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-20 max-h-96 overflow-y-auto">
            {/* Search */}
            <div className="p-2 border-b border-slate-700">
              <input
                type="text"
                placeholder="Search workspaces..."
                className="w-full px-3 py-2 bg-slate-700 rounded-md text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Workspace List */}
            <div className="py-1">
              {workspaces.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                  No workspaces yet
                </div>
              ) : (
                workspaces.map((workspace) => (
                  <button
                    key={workspace._id}
                    onClick={() => handleWorkspaceSelect(workspace)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                      currentWorkspace?._id === workspace._id ? 'bg-slate-700' : ''
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-white font-semibold">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-white truncate">
                        {workspace.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {workspace.projects.length} projects • {workspace.members.length} members
                      </div>
                    </div>
                    {currentWorkspace?._id === workspace._id && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Create New */}
            <div className="border-t border-slate-700 p-2">
              <button
                onClick={handleCreateWorkspace}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-white text-sm font-medium">New Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WorkspaceSelector;
