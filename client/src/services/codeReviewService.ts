import { Artifact } from '@orbitai/shared';

const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';

export interface CodeSuggestion {
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  category: 'performance' | 'security' | 'style' | 'bug' | 'best-practice';
  suggestion?: string;
  code?: string;
}

export interface CodeReviewResult {
  suggestions: CodeSuggestion[];
  score: number;
  summary: string;
}

/**
 * Review code and get suggestions
 */
export async function reviewCode(
  code: string,
  filePath?: string,
  language?: string
): Promise<CodeReviewResult> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/ai/code-review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, filePath, language })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || { suggestions: [], score: 100, summary: 'No issues found' };
  } catch (error: any) {
    console.error('Code review failed:', error);
    return { suggestions: [], score: 100, summary: 'Review unavailable' };
  }
}
















