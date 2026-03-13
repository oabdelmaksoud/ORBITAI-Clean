/**
 * Admin System Control API Service
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

export interface SystemHealth {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command: string;
}

export interface LogFile {
  file: string | null;
  lines: string[];
  totalLines: number;
  message?: string;
}

export async function getSystemHealth(token: string): Promise<SystemHealth> {
  const response = await apiRequest<{ success: boolean; data: SystemHealth }>(
    '/api/admin/system/health',
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function getProcesses(token: string): Promise<ProcessInfo[]> {
  const response = await apiRequest<{ success: boolean; data: { processes: ProcessInfo[] } }>(
    '/api/admin/system/processes',
    { method: 'GET' },
    token
  );
  return response.data.processes;
}

export async function killProcess(token: string, pid: number): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/system/kill-process/${pid}`,
    { method: 'POST' },
    token
  );
}

export async function getMaintenanceMode(token: string): Promise<boolean> {
  const response = await apiRequest<{ success: boolean; data: { enabled: boolean } }>(
    '/api/admin/system/maintenance-mode',
    { method: 'GET' },
    token
  );
  return response.data.enabled;
}

export async function setMaintenanceMode(
  token: string,
  enabled: boolean
): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    '/api/admin/system/maintenance-mode',
    {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    },
    token
  );
}

export async function clearCache(
  token: string,
  type?: 'redis' | 'memory'
): Promise<{ cleared: string[]; errors: Array<{ type: string; error: string }> }> {
  const response = await apiRequest<{
    success: boolean;
    data: { cleared: string[]; errors: Array<{ type: string; error: string }> };
  }>(
    '/api/admin/system/clear-cache',
    {
      method: 'POST',
      body: JSON.stringify({ type }),
    },
    token
  );
  return response.data;
}

export async function scheduleRestart(
  token: string,
  delaySeconds: number
): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    '/api/admin/system/restart',
    {
      method: 'POST',
      body: JSON.stringify({ delaySeconds }),
    },
    token
  );
}

export async function getLogs(
  token: string,
  options?: { lines?: number; level?: string }
): Promise<LogFile> {
  const params = new URLSearchParams();
  if (options?.lines) params.append('lines', options.lines.toString());
  if (options?.level) params.append('level', options.level);

  const response = await apiRequest<{ success: boolean; data: LogFile }>(
    `/api/admin/system/logs?${params.toString()}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function forceGarbageCollection(token: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    '/api/admin/system/gc',
    { method: 'POST' },
    token
  );
}




