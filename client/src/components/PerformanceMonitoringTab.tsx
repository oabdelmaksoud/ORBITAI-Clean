import React from 'react';
import PerformanceMonitoring from './PerformanceMonitoring';
import { useBackendConnection } from '../hooks/useBackendConnection';

interface PerformanceMonitoringTabProps {
  token?: string;
}

const PerformanceMonitoringTab: React.FC<PerformanceMonitoringTabProps> = ({ token }) => {
  const backendConnection = useBackendConnection();

  return (
    <div className="space-y-6">
      <PerformanceMonitoring token={token} />
      
      {/* Real-time Monitoring Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time System Monitoring</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Backend Connection</p>
              <p className={`text-lg font-semibold ${backendConnection.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {backendConnection.isConnected ? 'Connected' : 'Disconnected'}
              </p>
              {backendConnection.latency !== null && (
                <p className="text-xs text-gray-500 mt-1">Latency: {backendConnection.latency}ms</p>
              )}
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Uptime</p>
              <p className="text-lg font-semibold text-gray-900">
                {backendConnection.uptime !== null ? `${Math.floor(backendConnection.uptime / 3600)}h` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitoringTab;




