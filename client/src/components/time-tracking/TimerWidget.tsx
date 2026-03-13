import React, { useState } from 'react';

interface TimerWidgetProps {
  activeTimer?: {
    _id: string;
    project: { name: string };
    task?: { title: string };
    description?: string;
  } | null;
  elapsedTime?: number;
  formattedTime?: string;
  onStart?: (data: {
    workspace: string;
    project: string;
    task?: string;
    description?: string;
    tags?: string[];
    isBillable?: boolean;
  }) => void;
  onStop?: (timerId: string) => void;
  loading?: boolean;
}

const TimerWidget: React.FC<TimerWidgetProps> = ({
  activeTimer,
  elapsedTime = 0,
  formattedTime = '00:00:00',
  onStart,
  onStop,
  loading = false
}) => {
  const [showStartForm, setShowStartForm] = useState(false);
  const [workspace, setWorkspace] = useState('');
  const [project, setProject] = useState('');
  const [task, setTask] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isBillable, setIsBillable] = useState(true);

  const handleStart = () => {
    if (onStart && workspace && project) {
      onStart({
        workspace,
        project,
        task: task || undefined,
        description: description || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
        isBillable
      });
      setShowStartForm(false);
      resetForm();
    }
  };

  const handleStop = () => {
    if (activeTimer && onStop) {
      onStop(activeTimer._id);
    }
  };

  const resetForm = () => {
    setWorkspace('');
    setProject('');
    setTask('');
    setDescription('');
    setTags('');
    setIsBillable(true);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (activeTimer) {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">Timer Running</span>
          </div>
          <button
            onClick={handleStop}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors"
          >
            Stop
          </button>
        </div>

        <div className="text-white text-3xl font-mono mb-3">
          {formattedTime}
        </div>

        <div className="text-blue-100 text-sm space-y-1">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>{activeTimer.project.name}</span>
          </div>
          
          {activeTimer.task && (
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>{activeTimer.task.title}</span>
            </div>
          )}

          {activeTimer.description && (
            <div className="text-blue-200 text-xs truncate">
              {activeTimer.description}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showStartForm) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-white font-semibold mb-3">Start Timer</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-slate-300 text-sm mb-1 block">Workspace *</label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="Workspace ID"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Project *</label>
            <input
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Project ID"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Task</label>
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Task ID (optional)"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              rows={2}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="development, frontend, bugfix"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="billable"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="billable" className="text-slate-300 text-sm">
              Billable
            </label>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleStart}
              disabled={!workspace || !project}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
            >
              Start Timer
            </button>
            <button
              onClick={() => {
                setShowStartForm(false);
                resetForm();
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <button
        onClick={() => setShowStartForm(true)}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Start Timer</span>
      </button>
      
      <div className="mt-3 text-center text-slate-400 text-sm">
        No active timer
      </div>
    </div>
  );
};

export default TimerWidget;
