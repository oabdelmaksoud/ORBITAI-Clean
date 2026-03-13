/**
 * Admin Integrations API Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API Error: ${response.statusText}`);
  }

  return data;
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  status: string;
  source: string;
  tools: any[];
  config: any;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Webhook {
  _id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  events: string[];
  headers?: Record<string, string>;
  isActive: boolean;
  retryCount: number;
  timeout: number;
  lastTriggered?: Date;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationStatus {
  mcpServers: {
    total: number;
    active: number;
  };
  webhooks: {
    total: number;
    healthy: number;
    failed: number;
    neverTriggered: number;
  };
}

// MCP Servers
export async function getMCPServers(token: string): Promise<MCPServer[]> {
  const response = await apiRequest<{ success: boolean; data: { servers: MCPServer[] } }>(
    '/api/admin/integrations/mcp',
    { method: 'GET' },
    token
  );
  return response.data.servers;
}

export async function createMCPServer(
  token: string,
  server: {
    name: string;
    description?: string;
    config: any;
    tools?: any[];
    source?: string;
  }
): Promise<MCPServer> {
  const response = await apiRequest<{ success: boolean; data: MCPServer }>(
    '/api/admin/integrations/mcp',
    {
      method: 'POST',
      body: JSON.stringify(server),
    },
    token
  );
  return response.data;
}

export async function updateMCPServer(
  token: string,
  id: string,
  updates: Partial<MCPServer>
): Promise<MCPServer> {
  const response = await apiRequest<{ success: boolean; data: MCPServer }>(
    `/api/admin/integrations/mcp/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    token
  );
  return response.data;
}

export async function deleteMCPServer(token: string, id: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/integrations/mcp/${id}`,
    { method: 'DELETE' },
    token
  );
}

export async function testMCPServer(
  token: string,
  id: string
): Promise<{ status: string; message: string; timestamp: Date }> {
  const response = await apiRequest<{
    success: boolean;
    data: { status: string; message: string; timestamp: Date };
  }>(`/api/admin/integrations/mcp/${id}/test`, { method: 'POST' }, token);
  return response.data;
}

// Webhooks
export async function getWebhooks(
  token: string,
  isActive?: boolean
): Promise<Webhook[]> {
  const params = new URLSearchParams();
  if (isActive !== undefined) params.append('isActive', isActive.toString());

  const response = await apiRequest<{ success: boolean; data: { webhooks: Webhook[] } }>(
    `/api/admin/integrations/webhooks?${params.toString()}`,
    { method: 'GET' },
    token
  );
  return response.data.webhooks;
}

export async function createWebhook(
  token: string,
  webhook: {
    name: string;
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    events: string[];
    headers?: Record<string, string>;
    secret?: string;
    retryCount?: number;
    timeout?: number;
  }
): Promise<Webhook> {
  const response = await apiRequest<{ success: boolean; data: Webhook }>(
    '/api/admin/integrations/webhooks',
    {
      method: 'POST',
      body: JSON.stringify(webhook),
    },
    token
  );
  return response.data;
}

export async function updateWebhook(
  token: string,
  id: string,
  updates: Partial<Webhook>
): Promise<Webhook> {
  const response = await apiRequest<{ success: boolean; data: Webhook }>(
    `/api/admin/integrations/webhooks/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    token
  );
  return response.data;
}

export async function deleteWebhook(token: string, id: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/integrations/webhooks/${id}`,
    { method: 'DELETE' },
    token
  );
}

export async function testWebhook(
  token: string,
  id: string,
  payload?: any
): Promise<{ status: string; statusCode: number; message: string }> {
  const response = await apiRequest<{
    success: boolean;
    data: { status: string; statusCode: number; message: string };
  }>(
    `/api/admin/integrations/webhooks/${id}/test`,
    {
      method: 'POST',
      body: JSON.stringify({ payload }),
    },
    token
  );
  return response.data;
}

export async function getIntegrationStatus(token: string): Promise<IntegrationStatus> {
  const response = await apiRequest<{ success: boolean; data: IntegrationStatus }>(
    '/api/admin/integrations/status',
    { method: 'GET' },
    token
  );
  return response.data;
}




