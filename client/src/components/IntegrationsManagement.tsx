/**
 * Integrations Management Component
 * Admin interface for MCP servers and webhooks
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plug, Webhook as WebhookIcon, Plus, Edit2, Trash2, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { showAlert, showConfirm } from '../utils/browserUtils';
import { toast } from '../services/toastService';
import {
  getMCPServers,
  createMCPServer,
  updateMCPServer,
  deleteMCPServer,
  testMCPServer,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getIntegrationStatus,
  MCPServer,
  Webhook,
  IntegrationStatus
} from '../services/adminIntegrationsApi';

interface IntegrationsManagementProps {
  token: string;
}

const IntegrationsManagement: React.FC<IntegrationsManagementProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'mcp' | 'webhooks'>('mcp');
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMCPForm, setShowMCPForm] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [editingMCP, setEditingMCP] = useState<MCPServer | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      if (activeTab === 'mcp') {
        const [servers, integrationStatus] = await Promise.all([
          getMCPServers(token),
          getIntegrationStatus(token)
        ]);
        setMcpServers(servers);
        setStatus(integrationStatus);
      } else {
        const [hooks, integrationStatus] = await Promise.all([
          getWebhooks(token),
          getIntegrationStatus(token)
        ]);
        setWebhooks(hooks);
        setStatus(integrationStatus);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTestMCP = async (id: string) => {
    try {
      const result = await testMCPServer(token, id);
      toast.info(`Test Result: ${result.status}\n${result.message}`);
    } catch (err: any) {
      toast.error(`Test Failed: ${err.message}`);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const result = await testWebhook(token, id);
      toast.info(`Test Result: ${result.status}\nStatus Code: ${result.statusCode}\n${result.message}`);
    } catch (err: any) {
      toast.error(`Test Failed: ${err.message}`);
    }
  };

  const handleDeleteMCP = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to delete this MCP server?'))) return;
    try {
      await deleteMCPServer(token, id);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete MCP server');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to delete this webhook?'))) return;
    try {
      await deleteWebhook(token, id);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete webhook');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Integrations Management
          </h2>
          {status && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">MCP Servers:</span>
                <span className="font-semibold">{status.mcpServers.active}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Webhooks:</span>
                <span className="font-semibold">{status.webhooks.total}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('mcp')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'mcp'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            MCP Servers
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'webhooks'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Webhooks
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* MCP Servers Tab */}
        {activeTab === 'mcp' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingMCP(null);
                  setShowMCPForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add MCP Server
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : mcpServers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No MCP servers found</div>
            ) : (
              <div className="space-y-3">
                {mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-800">{server.name}</h3>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              server.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {server.status}
                          </span>
                        </div>
                        {server.description && (
                          <p className="text-sm text-slate-600 mb-2">{server.description}</p>
                        )}
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span>Source: {server.source}</span>
                          <span>Tools: {server.tools?.length || 0}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTestMCP(server.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Test"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingMCP(server);
                            setShowMCPForm(true);
                          }}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMCP(server.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingWebhook(null);
                  setShowWebhookForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Webhook
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No webhooks found</div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook._id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-800">{webhook.name}</h3>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              webhook.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {webhook.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {webhook.lastStatus && (
                            <span className="flex items-center gap-1">
                              {webhook.lastStatus === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2 font-mono">{webhook.url}</p>
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span>Method: {webhook.method}</span>
                          <span>Events: {webhook.events.length}</span>
                          {webhook.lastTriggered && (
                            <span>Last: {new Date(webhook.lastTriggered).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTestWebhook(webhook._id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Test"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingWebhook(webhook);
                            setShowWebhookForm(true);
                          }}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MCP Server Form Modal */}
        {showMCPForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">
                {editingMCP ? 'Edit MCP Server' : 'Add MCP Server'}
              </h3>
              <MCPForm
                server={editingMCP}
                onSave={async (serverData) => {
                  try {
                    if (editingMCP) {
                      await updateMCPServer(token, editingMCP.id, serverData);
                    } else {
                      await createMCPServer(token, serverData);
                    }
                    setShowMCPForm(false);
                    setEditingMCP(null);
                    loadData();
                  } catch (err: any) {
                    setError(err.message || 'Failed to save MCP server');
                  }
                }}
                onCancel={() => {
                  setShowMCPForm(false);
                  setEditingMCP(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Webhook Form Modal */}
        {showWebhookForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">
                {editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
              </h3>
              <WebhookForm
                webhook={editingWebhook}
                onSave={async (webhookData) => {
                  try {
                    if (editingWebhook) {
                      await updateWebhook(token, editingWebhook._id, webhookData);
                    } else {
                      await createWebhook(token, webhookData);
                    }
                    setShowWebhookForm(false);
                    setEditingWebhook(null);
                    loadData();
                  } catch (err: any) {
                    setError(err.message || 'Failed to save webhook');
                  }
                }}
                onCancel={() => {
                  setShowWebhookForm(false);
                  setEditingWebhook(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// MCP Server Form Component
interface MCPFormProps {
  server: MCPServer | null;
  onSave: (data: { name: string; description?: string; config: any; tools?: string[]; source?: string }) => void;
  onCancel: () => void;
}

const MCPForm: React.FC<MCPFormProps> = ({ server, onSave, onCancel }) => {
  const [name, setName] = useState(server?.name || '');
  const [description, setDescription] = useState(server?.description || '');
  const [configType, setConfigType] = useState<'e2b' | 'http' | 'stdio' | 'websocket' | 'custom'>(server?.config?.type || 'http');
  const [endpoint, setEndpoint] = useState(server?.config?.endpoint || '');
  const [command, setCommand] = useState(server?.config?.command || '');
  const [args, setArgs] = useState(server?.config?.args?.join(', ') || '');
  const [headers, setHeaders] = useState(JSON.stringify(server?.config?.headers || {}, null, 2));
  const [apiKey, setApiKey] = useState(server?.config?.apiKey || '');
  const [tools, setTools] = useState(server?.tools?.join(', ') || '');
  const [source, setSource] = useState<'system' | 'user' | 'agent'>(server?.source || 'user');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const config: any = { type: configType };
    if (configType === 'http' || configType === 'websocket') {
      if (endpoint) config.endpoint = endpoint;
      if (headers) {
        try {
          config.headers = JSON.parse(headers);
        } catch {
          config.headers = {};
        }
      }
      if (apiKey) config.apiKey = apiKey;
    } else if (configType === 'stdio') {
      if (command) config.command = command;
      if (args) config.args = args.split(',').map(a => a.trim()).filter(a => a);
    }

    const toolsArray = tools ? tools.split(',').map(t => t.trim()).filter(t => t) : [];

    onSave({
      name,
      description: description || undefined,
      config,
      tools: toolsArray,
      source
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as 'system' | 'user' | 'agent')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="user">User</option>
          <option value="system">System</option>
          <option value="agent">Agent</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Config Type *</label>
        <select
          value={configType}
          onChange={(e) => setConfigType(e.target.value as any)}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="http">HTTP</option>
          <option value="websocket">WebSocket</option>
          <option value="stdio">STDIO</option>
          <option value="e2b">E2B</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {(configType === 'http' || configType === 'websocket') && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)</label>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              rows={3}
              placeholder='{"Authorization": "Bearer token"}'
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      {configType === 'stdio' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Command *</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="python"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Arguments (comma-separated)</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="script.py, --arg1, --arg2"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Tools (comma-separated)</label>
        <input
          type="text"
          value={tools}
          onChange={(e) => setTools(e.target.value)}
          placeholder="tool1, tool2, tool3"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {server ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

// Webhook Form Component
interface WebhookFormProps {
  webhook: Webhook | null;
  onSave: (data: {
    name: string;
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    events: string[];
    headers?: Record<string, string>;
    secret?: string;
    retryCount?: number;
    timeout?: number;
  }) => void;
  onCancel: () => void;
}

const WebhookForm: React.FC<WebhookFormProps> = ({ webhook, onSave, onCancel }) => {
  const [name, setName] = useState(webhook?.name || '');
  const [url, setUrl] = useState(webhook?.url || '');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>(webhook?.method || 'POST');
  const [events, setEvents] = useState(webhook?.events?.join(', ') || '');
  const [headers, setHeaders] = useState(JSON.stringify(webhook?.headers || {}, null, 2));
  const [secret, setSecret] = useState('');
  const [retryCount, setRetryCount] = useState(webhook?.retryCount || 3);
  const [timeout, setTimeout] = useState(webhook?.timeout || 5000);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const eventsArray = events ? events.split(',').map(e => e.trim()).filter(e => e) : [];
    let headersObj: Record<string, string> = {};
    try {
      headersObj = JSON.parse(headers);
    } catch {
      headersObj = {};
    }

    onSave({
      name,
      url,
      method,
      events: eventsArray,
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      secret: secret || undefined,
      retryCount,
      timeout
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">URL *</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://api.example.com/webhook"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as any)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="POST">POST</option>
          <option value="GET">GET</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Events (comma-separated) *</label>
        <input
          type="text"
          value={events}
          onChange={(e) => setEvents(e.target.value)}
          required
          placeholder="project.created, task.completed"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)</label>
        <textarea
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          rows={3}
          placeholder='{"Authorization": "Bearer token"}'
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Secret</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Webhook secret (optional)"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Retry Count</label>
          <input
            type="number"
            value={retryCount}
            onChange={(e) => setRetryCount(parseInt(e.target.value) || 3)}
            min={0}
            max={10}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Timeout (ms)</label>
          <input
            type="number"
            value={timeout}
            onChange={(e) => setTimeout(parseInt(e.target.value) || 5000)}
            min={1000}
            max={30000}
            step={1000}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {webhook ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

export default IntegrationsManagement;

