import React, { useState, useEffect } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  connectedAt?: string;
  category: 'version_control' | 'project_management' | 'communication' | 'cloud';
}

interface IntegrationDashboardProps {
  workspaceId: string;
}

const IntegrationDashboard: React.FC<IntegrationDashboardProps> = ({ workspaceId }) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [connectingIntegration, setConnectingIntegration] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [workspaceId]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      // Mock data for demo
      setIntegrations([
        {
          id: 'github',
          name: 'GitHub',
          description: 'Sync code repositories and pull requests',
          icon: '🐙',
          connected: false,
          category: 'version_control'
        },
        {
          id: 'gitlab',
          name: 'GitLab',
          description: 'Connect to GitLab repositories',
          icon: '🦊',
          connected: false,
          category: 'version_control'
        },
        {
          id: 'jira',
          name: 'Jira',
          description: 'Sync tasks and issues with Jira',
          icon: '📋',
          connected: false,
          category: 'project_management'
        },
        {
          id: 'trello',
          name: 'Trello',
          description: 'Sync boards and cards',
          icon: '📌',
          connected: false,
          category: 'project_management'
        },
        {
          id: 'slack',
          name: 'Slack',
          description: 'Send notifications to Slack channels',
          icon: '💬',
          connected: false,
          category: 'communication'
        },
        {
          id: 'discord',
          name: 'Discord',
          description: 'Connect to Discord servers',
          icon: '🎮',
          connected: false,
          category: 'communication'
        },
        {
          id: 'aws',
          name: 'AWS',
          description: 'Deploy to Amazon Web Services',
          icon: '☁️',
          connected: false,
          category: 'cloud'
        },
        {
          id: 'vercel',
          name: 'Vercel',
          description: 'Deploy to Vercel',
          icon: '▲',
          connected: false,
          category: 'cloud'
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integrationId: string) => {
    try {
      setConnectingIntegration(integrationId);
      
      if (integrationId === 'github') {
        // Redirect to GitHub OAuth
        window.location.href = '/api/integrations/github/auth';
      } else {
        // Generic OAuth flow
        console.log(`Connecting to ${integrationId}...`);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setConnectingIntegration(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (window.confirm('Are you sure you want to disconnect this integration?')) {
      setIntegrations(prev =>
        prev.map(i =>
          i.id === integrationId
            ? { ...i, connected: false, connectedAt: undefined }
            : i
        )
      );
    }
  };

  const categories = [
    { id: 'all', label: 'All Integrations', icon: '🔌' },
    { id: 'version_control', label: 'Version Control', icon: '📦' },
    { id: 'project_management', label: 'Project Management', icon: '📋' },
    { id: 'communication', label: 'Communication', icon: '💬' },
    { id: 'cloud', label: 'Cloud', icon: '☁️' }
  ];

  const filteredIntegrations = selectedCategory === 'all'
    ? integrations
    : integrations.filter(i => i.category === selectedCategory);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-800 rounded-lg p-6 animate-pulse">
            <div className="w-12 h-12 bg-slate-700 rounded mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-2/3 mb-2"></div>
            <div className="h-3 bg-slate-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
        <p className="text-slate-400">Connect your favorite tools and services</p>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === category.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="mr-2">{category.icon}</span>
            {category.label}
          </button>
        ))}
      </div>

      {/* Integration Grid */}
      {filteredIntegrations.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">🔌</div>
          <h3 className="text-white text-lg font-medium mb-2">No integrations found</h3>
          <p className="text-slate-400">Try selecting a different category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map(integration => (
            <div
              key={integration.id}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-blue-500 transition-colors"
            >
              {/* Icon */}
              <div className="text-4xl mb-4">{integration.icon}</div>

              {/* Info */}
              <h3 className="text-white font-semibold text-lg mb-2">{integration.name}</h3>
              <p className="text-slate-400 text-sm mb-4">{integration.description}</p>

              {/* Status & Actions */}
              {integration.connected ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-green-400 text-sm">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Connected</span>
                  </div>
                  {integration.connectedAt && (
                    <div className="text-xs text-slate-500">
                      Connected {new Date(integration.connectedAt).toLocaleDateString()}
                    </div>
                  )}
                  <button
                    onClick={() => handleDisconnect(integration.id)}
                    className="w-full mt-2 px-4 py-2 bg-slate-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(integration.id)}
                  disabled={connectingIntegration === integration.id}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  {connectingIntegration === integration.id ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Connected Integrations Summary */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Connected Services</h2>
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {integrations.filter(i => i.connected).length}
            </div>
            <div className="text-sm text-slate-400">Connected</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-400">
              {integrations.filter(i => !i.connected).length}
            </div>
            <div className="text-sm text-slate-400">Available</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationDashboard;
