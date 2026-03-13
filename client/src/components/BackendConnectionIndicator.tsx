import React from 'react';
import { WifiOff, AlertTriangle, X } from 'lucide-react';
import { useBackendConnection } from '../hooks/useBackendConnection';

const BackendConnectionIndicator: React.FC = () => {
  const backendConnection = useBackendConnection();

  // Only show when backend is disconnected
  if (backendConnection.isConnected || backendConnection.isChecking) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white shadow-lg animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Backend Server Disconnected</p>
            <p className="text-xs text-red-100 mt-0.5">
              {backendConnection.error || 'Unable to connect to the backend server. Some features may not work.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => backendConnection.refresh()}
          className="ml-4 px-3 py-1.5 bg-red-700 hover:bg-red-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
          title="Retry connection"
        >
          <AlertTriangle className="w-4 h-4" />
          Retry
        </button>
      </div>
    </div>
  );
};

export default BackendConnectionIndicator;

