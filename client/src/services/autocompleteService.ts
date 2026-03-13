import { ChatMessage } from '@orbitai/shared';

const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';

export interface AutocompleteSuggestion {
  text: string;
  range: {
    start: number;
    end: number;
  };
  displayText?: string;
}

export interface AutocompleteRequest {
  code: string;
  cursorPosition: number;
  filePath?: string;
  fileType?: string;
  context?: {
    selectedCode?: string;
    nearbyCode?: string;
    projectContext?: string;
  };
}

/**
 * Get AI-powered code autocomplete suggestions
 */
export async function getAutocompleteSuggestions(
  request: AutocompleteRequest
): Promise<AutocompleteSuggestion[]> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/ai/autocomplete`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error: any) {
    console.error('Autocomplete request failed:', error);
    return [];
  }
}

/**
 * Get code explanation for selected code
 */
export async function explainCode(
  code: string,
  context?: string
): Promise<string> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/ai/explain-code`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, context })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data?.explanation || '';
  } catch (error: any) {
    console.error('Explain code failed:', error);
    return 'Failed to explain code.';
  }
}

/**
 * Refactor code using natural language
 */
export async function refactorCode(
  code: string,
  instruction: string,
  context?: string
): Promise<{ refactoredCode: string; explanation: string; changes: string[] }> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/ai/refactor`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, instruction, context })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || { refactoredCode: code, explanation: '', changes: [] };
  } catch (error: any) {
    console.error('Refactor code failed:', error);
    throw error;
  }
}
















