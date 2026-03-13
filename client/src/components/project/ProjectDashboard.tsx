import React, { useState, useEffect } from 'react';

interface Project {
  _id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  progress: number;
  tasks: {
    total: number;
    completed: number;
  };
  members: Array<{
    _id: string;
    name: string;
    avatar: string;
  }>;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectDashboardProps {
  workspaceId: string;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ workspaceId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'deadline' | 'progress'>('deadline');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [workspaceId]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'progress') return b.progress - a.progress;
      return 0;
    });

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `${days} days`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-800 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Projects</h2>
        <button
          onClick={() => {/* Open create project modal */}}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Project</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full px-4 py-2 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="deadline">Sort by Deadline</option>
          <option value="name">Sort by Name</option>
          <option value="progress">Sort by Progress</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Total Projects</div>
          <div className="text-3xl font-bold text-white">{projects.length}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Active</div>
          <div className="text-3xl font-bold text-green-400">
            {projects.filter(p => p.status === 'active').length}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Completed</div>
          <div className="text-3xl font-bold text-blue-400">
            {projects.filter(p => p.status === 'completed').length}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Total Tasks</div>
          <div className="text-3xl font-bold text-white">
            {projects.reduce((sum, p) => sum + p.tasks.total, 0)}
          </div>
        </div>
      </div>

      {/* Project List */}
      {filteredProjects.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-white text-lg font-medium mb-2">No projects found</h3>
          <p className="text-slate-400 mb-6">
            {searchQuery ? 'Try a different search query' : 'Create your first project to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => {/* Open create modal */}}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <div
              key={project._id}
              className="bg-slate-800 rounded-lg p-6 hover:bg-slate-750 transition-colors cursor-pointer border border-slate-700 hover:border-blue-500"
              onClick={() => {/* Navigate to project */}}
            >
              {/* Status Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)} text-white`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDate(project.deadline)}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-white font-semibold text-lg mb-2">{project.name}</h3>
              {project.description && (
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{project.description}</p>
              )}

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-white font-medium">{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Tasks & Members */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  <span className="text-white font-medium">{project.tasks.completed}</span>
                  /{project.tasks.total} tasks
                </div>
                
                {/* Member Avatars */}
                {project.members.length > 0 && (
                  <div className="flex -space-x-2">
                    {project.members.slice(0, 3).map((member, i) => (
                      <img
                        key={member._id}
                        src={member.avatar}
                        alt={member.name}
                        className="w-8 h-8 rounded-full border-2 border-slate-800"
                        title={member.name}
                      />
                    ))}
                    {project.members.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs text-white">
                        +{project.members.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
