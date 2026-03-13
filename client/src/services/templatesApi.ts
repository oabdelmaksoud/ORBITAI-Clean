/**
 * Templates API Service
 * Database-only templates management
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('authToken');
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
  }
  return null;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category?: string;
  methodology?: string;
  estimatedSprints?: number;
  agents: any[];
  selectedStandards?: string[];
  mcpServers: any[];
  budget: {
    total: number;
    used: number;
    currency: string;
    totalTokens: number;
    lastUpdated: number;
  };
  tags: string[];
  createdAt: number;
  isPublic?: boolean;
}

/**
 * Get all templates
 */
export async function getTemplates(): Promise<ProjectTemplate[]> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/templates`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch templates' }));
    throw new Error(error.message || 'Failed to fetch templates');
  }

  const result = await response.json();
  return result.data?.templates || [];
}

/**
 * Get a specific template
 */
export async function getTemplate(id: string): Promise<ProjectTemplate> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/templates/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch template' }));
    throw new Error(error.message || 'Failed to fetch template');
  }

  const result = await response.json();
  return result.data?.template;
}

/**
 * Create a new template
 */
export async function createTemplate(template: Omit<ProjectTemplate, 'id' | 'createdAt'>): Promise<ProjectTemplate> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(template)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create template' }));
    throw new Error(error.message || 'Failed to create template');
  }

  const result = await response.json();
  return result.data?.template;
}

/**
 * Update a template
 */
export async function updateTemplate(id: string, template: Partial<ProjectTemplate>): Promise<ProjectTemplate> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/templates/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(template)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update template' }));
    throw new Error(error.message || 'Failed to update template');
  }

  const result = await response.json();
  return result.data?.template;
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/templates/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete template' }));
    throw new Error(error.message || 'Failed to delete template');
  }
}

/**
 * Toggle template sharing (make public/private)
 */
export async function shareTemplate(id: string, isPublic: boolean): Promise<ProjectTemplate> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/templates/${id}/share`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isPublic })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to share template' }));
    throw new Error(error.message || 'Failed to share template');
  }

  const result = await response.json();
  return result.data?.template;
}

export const templatesApi = {
  getAll: getTemplates,
  getById: getTemplate,
  create: createTemplate,
  update: updateTemplate,
  delete: deleteTemplate,
  share: shareTemplate
};









