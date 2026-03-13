import { apiRequest } from './adminApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  dataSource: string;
  metrics: string[];
  defaultGroupBy: string;
  defaultDateRange: { days: number };
}

export interface ReportConfig {
  name?: string;
  dataSource: 'users' | 'projects' | 'activity' | 'audit';
  metrics: string[];
  filters?: Record<string, any>;
  groupBy?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  format?: 'json' | 'csv';
}

export interface ReportResponse {
  name: string;
  generatedAt: string;
  dataSource: string;
  metrics: string[];
  filters?: Record<string, any>;
  groupBy?: string;
  dateRange: {
    start: string;
    end: string;
  };
  results: any;
}

export async function getReportTemplates(token: string): Promise<ReportTemplate[]> {
  const response = await apiRequest<{ success: boolean; data: { templates: ReportTemplate[] } }>(
    `/api/admin/reports/templates`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch report templates');
  }
  return response.data.templates;
}

export async function generateReport(
  token: string,
  config: ReportConfig
): Promise<ReportResponse | Blob> {
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(config)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate report');
  }

  if (config.format === 'csv') {
    return await response.blob();
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to generate report');
  }
  return data.data;
}
















