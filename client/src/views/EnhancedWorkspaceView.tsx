/**
 * Enhanced Workspace View - Wraps existing WorkspaceView with new features
 * 
 * This adds:
 * - Workspace context provider
 * - Workspace selector in header
 * - Notification center in header  
 * - Timer widget in sidebar
 * 
 * Usage: Replace imports of WorkspaceView with this file
 */

import React from 'react';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import WorkspaceSelector from '../components/workspace/WorkspaceSelector';
import NotificationCenter from '../components/notifications/NotificationCenter';
import TimerWidget from '../components/time-tracking/TimerWidget';
import WorkspaceView from './WorkspaceView';

interface EnhancedWorkspaceViewProps {
  // All props from original WorkspaceView
  [key: string]: any;
}

/**
 * Enhanced Workspace View with new features
 */
const EnhancedWorkspaceView: React.FC<EnhancedWorkspaceViewProps> = (props) => {
  const [showTimer, setShowTimer] = React.useState(true);

  return (
    <WorkspaceProvider>
      {/* Top banner with new features */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-slate-900 border-b border-slate-700 z-40 flex items-center justify-between px-4">
        {/* Left: Workspace selector */}
        <div className="flex items-center space-x-4">
          <WorkspaceSelector />
        </div>
        
        {/* Center: Title or logo */}
        <div className="flex-1 text-center">
          <h1 className="text-sm font-semibold text-white">OrbitAI Workspace</h1>
        </div>
        
        {/* Right: Notifications and timer toggle */}
        <div className="flex items-center space-x-4">
          <NotificationCenter />
          
          {/* Timer toggle button */}
          <button
            onClick={() => setShowTimer(!showTimer)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Toggle Timer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Main workspace content (pushed down by banner height) */}
      <div className="pt-12">
        <WorkspaceView {...props} />
      </div>
      
      {/* Floating timer widget (bottom-right corner) */}
      {showTimer && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700">
            <TimerWidget />
          </div>
        </div>
      )}
    </WorkspaceProvider>
  );
};

export default EnhancedWorkspaceView;
