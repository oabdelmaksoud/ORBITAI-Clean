/**
 * Integration Wrapper - Wraps existing OrbitAI components with new features
 * 
 * This file provides ready-to-use wrapper components that integrate
 * the new features into the existing OrbitAI application.
 */

import React from 'react';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import WorkspaceSelector from '../components/workspace/WorkspaceSelector';
import NotificationCenter from '../components/notifications/NotificationCenter';
import TimerWidget from '../components/time-tracking/TimerWidget';
import CommentThread from '../components/comments/CommentThread';
import ChatInput from '../components/chat/ChatInput';
import ProjectDashboard from '../components/project/ProjectDashboard';
import IntegrationDashboard from '../components/integrations/IntegrationDashboard';

/**
 * Enhanced App Shell - Adds notifications to existing AppShell
 */
export const EnhancedAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <WorkspaceProvider>
      <div className="app-shell">
        {/* Header with new features */}
        <header className="app-header flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700">
          {/* Left: Workspace selector */}
          <div className="flex items-center space-x-4">
            <WorkspaceSelector />
          </div>
          
          {/* Center: Logo or title */}
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-white">OrbitAI</h1>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center space-x-4">
            <NotificationCenter />
            {/* Existing header actions */}
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex">
          {/* Sidebar with timer */}
          <aside className="w-64 bg-slate-800 border-r border-slate-700">
            {/* Existing sidebar content */}
            
            {/* Timer at bottom */}
            <div className="fixed bottom-0 left-0 w-64 p-4 bg-slate-800 border-t border-slate-700">
              <TimerWidget />
            </div>
          </aside>
          
          {/* Content area */}
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  );
};

/**
 * Enhanced Project View - Adds comments to existing project view
 */
export const EnhancedProjectView: React.FC<{ projectId: string; children?: React.ReactNode }> = ({ 
  projectId, 
  children 
}) => {
  return (
    <div className="project-view grid grid-cols-3 gap-6 p-6">
      {/* Main project content (2/3 width) */}
      <div className="col-span-2">
        {children}
      </div>
      
      {/* Comments sidebar (1/3 width) */}
      <div className="col-span-1">
        <div className="sticky top-6">
          <h3 className="text-lg font-semibold text-white mb-4">Comments</h3>
          <CommentThread
            resourceType="project"
            resourceId={projectId}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Enhanced Chat Panel - Replaces chat input with @mention support
 */
export const EnhancedChatPanel: React.FC<{ onSend: (message: string, mentions: string[]) => void }> = ({ 
  onSend 
}) => {
  return (
    <div className="chat-panel">
      {/* Existing chat messages */}
      <div className="messages-container">
        {/* Messages here */}
      </div>
      
      {/* Enhanced chat input with @mentions */}
      <ChatInput
        onSend={onSend}
        placeholder="Type a message... use @ for mentions"
      />
    </div>
  );
};

/**
 * Enhanced Dashboard View - Shows project dashboard
 */
export const EnhancedDashboardView: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  return (
    <div className="dashboard-view p-6">
      <ProjectDashboard workspaceId={workspaceId} />
    </div>
  );
};

/**
 * Enhanced Settings View - Adds integration management
 */
export const EnhancedSettingsView: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [activeTab, setActiveTab] = React.useState('integrations');

  return (
    <div className="settings-view p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>
      
      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'profile' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('workspaces')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'workspaces' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          Workspaces
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'integrations' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          Integrations
        </button>
      </div>
      
      {/* Tab content */}
      {activeTab === 'integrations' && (
        <IntegrationDashboard workspaceId={workspaceId} />
      )}
      
      {/* Other tabs would go here */}
    </div>
  );
};

/**
 * Quick Integration Component - Add all features at once
 */
export const QuickIntegration: React.FC<{ 
  projectId?: string;
  workspaceId?: string;
  onChatSend?: (message: string, mentions: string[]) => void;
}> = ({ 
  projectId, 
  workspaceId, 
  onChatSend 
}) => {
  return (
    <WorkspaceProvider>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900">
        <WorkspaceSelector />
        <NotificationCenter />
      </div>
      
      {/* Timer Widget (floating) */}
      <div className="fixed bottom-4 right-4 z-50">
        <TimerWidget />
      </div>
      
      {/* Main content based on context */}
      {projectId && (
        <CommentThread resourceType="project" resourceId={projectId} />
      )}
      
      {/* Chat with @mentions */}
      {onChatSend && (
        <ChatInput onSend={onChatSend} />
      )}
      
      {/* Dashboard */}
      {workspaceId && !projectId && (
        <ProjectDashboard workspaceId={workspaceId} />
      )}
    </WorkspaceProvider>
  );
};

/**
 * Hook to check if integration is complete
 */
export const useIntegrationStatus = () => {
  const [status, setStatus] = React.useState({
    workspaces: false,
    comments: false,
    notifications: false,
    timeTracking: false,
    integrations: false
  });
  
  React.useEffect(() => {
    // Check if components are mounted
    const checkIntegration = async () => {
      try {
        // Test API endpoints
        const response = await fetch('/api/workspaces');
        if (response.ok) {
          setStatus(prev => ({ ...prev, workspaces: true }));
        }
      } catch (error) {
        console.error('Workspace integration not ready');
      }
      
      // Add checks for other integrations...
    };
    
    checkIntegration();
  }, []);
  
  return status;
};

/**
 * Integration Status Banner - Shows what's integrated
 */
export const IntegrationStatusBanner: React.FC = () => {
  const status = useIntegrationStatus();
  
  const allIntegrated = Object.values(status).every(Boolean);
  
  if (allIntegrated) {
    return null; // Don't show banner if everything is integrated
  }
  
  return (
    <div className="bg-yellow-500 text-yellow-900 px-4 py-2">
      <div className="flex items-center justify-between">
        <span>⚠️ Some features are not fully integrated</span>
        <div className="flex space-x-2">
          {!status.workspaces && <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Workspaces</span>}
          {!status.comments && <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Comments</span>}
          {!status.notifications && <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Notifications</span>}
          {!status.timeTracking && <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Time Tracking</span>}
          {!status.integrations && <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Integrations</span>}
        </div>
      </div>
    </div>
  );
};

// Export all integration helpers
export default {
  EnhancedAppShell,
  EnhancedProjectView,
  EnhancedChatPanel,
  EnhancedDashboardView,
  EnhancedSettingsView,
  QuickIntegration,
  useIntegrationStatus,
  IntegrationStatusBanner
};
