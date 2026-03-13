import { ChatMessage } from '@orbitai/shared';

const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';

export interface CustomMode {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Get all custom modes for the user
 */
export async function getCustomModes(): Promise<CustomMode[]> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/custom-modes`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error: any) {
    console.error('Get custom modes failed:', error);
    return [];
  }
}

/**
 * Create a new custom mode
 */
export async function createCustomMode(mode: Omit<CustomMode, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomMode> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/custom-modes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(mode)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data;
  } catch (error: any) {
    console.error('Create custom mode failed:', error);
    throw error;
  }
}

/**
 * Update a custom mode
 */
export async function updateCustomMode(id: string, mode: Partial<CustomMode>): Promise<CustomMode> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/custom-modes/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(mode)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data;
  } catch (error: any) {
    console.error('Update custom mode failed:', error);
    throw error;
  }
}

/**
 * Delete a custom mode
 */
export async function deleteCustomMode(id: string): Promise<void> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/custom-modes/${id}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error: any) {
    console.error('Delete custom mode failed:', error);
    throw error;
  }
}
















