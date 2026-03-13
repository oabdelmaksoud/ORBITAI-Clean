/**
 * Agent Communication Logs Component
 * Displays agent-to-agent communication messages
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, RefreshCw, Filter, Clock } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface AgentCommunicationLogsProps {
  projectId: string;
}

interface AgentMessage {
  _id: string;
  projectId: string;
  fromAgentId: string;
  fromAgentRole: string;
  toAgentId?: string;
  toAgentRole?: string;
  messageType: 'status_update' | 'dependency_notification' | 'result_sharing' | 'error_propagation' | 'request' | 'response';
  content: string;
  metadata?: any;
  timestamp: Date;
  read: boolean;
}

const AgentCommunicationLogs: React.FC<AgentCommunicationLogsProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadMessages();
  }, [projectId]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setMessages([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error_propagation': return 'bg-red-100 text-red-800';
      case 'status_update': return 'bg-blue-100 text-blue-800';
      case 'dependency_notification': return 'bg-yellow-100 text-yellow-800';
      case 'result_sharing': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMessages = messages.filter(msg => filterType === 'all' || msg.messageType === filterType);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Agent Communication Logs</h2>
        </div>
        <button
          onClick={loadMessages}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          <option value="status_update">Status Updates</option>
          <option value="dependency_notification">Dependencies</option>
          <option value="result_sharing">Results</option>
          <option value="error_propagation">Errors</option>
          <option value="request">Requests</option>
          <option value="response">Responses</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No communication messages found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((message, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium">
                    {message.fromAgentRole} → {message.toAgentRole || 'Broadcast'}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(message.timestamp).toLocaleString()}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(message.messageType)}`}>
                  {message.messageType.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-700">{message.content}</div>
              {message.metadata && (
                <div className="mt-2 text-xs text-gray-500">
                  Metadata: {JSON.stringify(message.metadata)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentCommunicationLogs;



