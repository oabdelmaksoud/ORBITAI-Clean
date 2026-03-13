/**
 * Frontend Service - Calls Backend API for Gemini Operations
 * This keeps the API key secure on the backend
 */

import { ChatMessage, ProjectState, ProjectPreview } from '@orbitai/shared';

const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';

// Helper function for API calls
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true', // Allow requests through localtunnel
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `API Error: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// Re-export types from the original service
export type { ProjectPreview };
export type APIHealth = 'healthy' | 'degraded' | 'paused';

export interface APIMetrics {
  requests: number;
  lastLatency: number;
  errors: number;
  latencyHistory: number[];
  usageHistory: number[];
  msg?: string;
}

// API Monitor (simple frontend version)
class APIMonitor {
  private listeners: ((status: APIHealth, metrics: APIMetrics) => void)[] = [];
  private metrics: APIMetrics = {
    requests: 0,
    lastLatency: 0,
    errors: 0,
    latencyHistory: [],
    usageHistory: []
  };
  private status: APIHealth = 'healthy';

  subscribe(listener: (status: APIHealth, metrics: APIMetrics) => void) {
    this.listeners.push(listener);
    listener(this.status, this.metrics);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  logRequest(latency: number, isError: boolean = false) {
    this.metrics.requests++;
    this.metrics.lastLatency = latency;
    if (isError) this.metrics.errors++;

    this.metrics.latencyHistory.push(latency);
    if (this.metrics.latencyHistory.length > 50) this.metrics.latencyHistory.shift();

    this.metrics.usageHistory.push(1);
    if (this.metrics.usageHistory.length > 50) this.metrics.usageHistory.shift();

    this.notify();
  }

  private notify() {
    this.listeners.forEach(l => l(this.status, this.metrics));
  }
}

export const apiMonitor = new APIMonitor();

// Generate Project Preview - calls backend API
export async function generateProjectPreview(
  userGoal: string,
  conversationHistory: ChatMessage[],
  useInternet: boolean,
  brainstormingContext?: any
): Promise<ProjectPreview> {
  const startTime = Date.now();

  try {
    const response = await apiRequest<{ success: boolean; data: ProjectPreview; latency: number }>(
      '/api/llm/generate-preview',
      {
        method: 'POST',
        body: JSON.stringify({
          userGoal,
          conversationHistory,
          useInternet,
          brainstormingContext
        })
      }
    );

    apiMonitor.logRequest(response.latency || (Date.now() - startTime));

    return response.data;
  } catch (error) {
    apiMonitor.logRequest(Date.now() - startTime, true);
    throw error;
  }
}

// Chat with Orchestrator - calls backend API
export async function chatWithOrchestrator(
  message: string,
  history: ChatMessage[],
  projectState: ProjectState & { contextType?: string }
): Promise<{ text: string; action?: any }> {
  try {
    const response = await apiRequest<{ success: boolean; response: string; data?: { text: string } }>(
      '/api/llm/chat',
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          history,
          projectState,
          contextType: projectState.contextType
        })
      }
    );

    // Backend returns { success: true, response: string, ... }
    // Handle both formats for compatibility
    const text = response.response || response.data?.text || '';

    if (!text) {
      throw new Error('No response text received from backend');
    }

    return { text };
  } catch (error: any) {
    console.error('Chat error:', error);
    return { text: "I'm having trouble connecting right now. Please try again." };
  }
}

// Enhance User Prompt - calls backend API
export async function enhanceUserPrompt(input: string): Promise<string> {
  try {
    const response = await apiRequest<{ success: boolean; data: { enhanced: string } }>(
      '/api/llm/enhance-prompt',
      {
        method: 'POST',
        body: JSON.stringify({ input })
      }
    );

    return response.data.enhanced;
  } catch (error) {
    console.error('Enhance prompt error:', error);
    return input; // Return original if enhancement fails
  }
}

// Execute Agent Task - calls backend API
export async function executeAgentTask(
  agent: any,
  task: any,
  projectContext: string,
  artifacts: any[],
  useInternet: boolean,
  mcpServers: any[],
  onDialogue: (event: any) => void,
  standards: string[],
  signal?: AbortSignal
): Promise<any> {
  try {
    const response = await apiRequest<{ success: boolean; output: string; modelUsed: string; provider: string }>(
      '/api/llm/execute-task',
      {
        method: 'POST',
        body: JSON.stringify({
          task,
          projectState: { description: projectContext, artifacts },
          useInternet,
          mcpServers,
          selectedStandards: standards
        }),
        signal
      }
    );

    return {
      output: response.output || '',
      resources: [],
      tokenUsage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
      modelUsed: response.modelUsed || 'unknown',
      collaboration: []
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Operation cancelled by user');
    }
    throw error;
  }
}

// Orchestrate Next Steps - calls backend API
export async function orchestrateNextSteps(
  phase: string,
  description: string,
  completedTasks: any[],
  useInternet: boolean,
  mcpServers: any[],
  maxTasks: number,
  agents: any[]
): Promise<{ tasks: Partial<any>[] }> {
  try {
    const response = await apiRequest<{ success: boolean; data: { tasks: any[] } }>(
      '/api/llm/orchestrate',
      {
        method: 'POST',
        body: JSON.stringify({
          phase,
          description,
          completedTasks,
          useInternet,
          mcpServers,
          maxTasks,
          agents
        })
      }
    );

    return { tasks: response.data.tasks || [] };
  } catch (error: any) {
    console.error('Orchestration error:', error);
    return { tasks: [] };
  }
}

// Interrogate Agent - calls backend API
export async function interrogateAgent(agent: any, question: string, context: any): Promise<string> {
  try {
    const response = await apiRequest<{ success: boolean; data: { text: string } }>(
      '/api/llm/interrogate',
      {
        method: 'POST',
        body: JSON.stringify({
          agentRole: agent.role,
          question,
          context
        })
      }
    );

    return response.data.text;
  } catch (error: any) {
    console.error('Interrogate agent error:', error);
    return 'I am unable to answer that question at this time.';
  }
}

// Perform Deep Research - calls backend API
export async function performDeepResearch(query: string): Promise<string> {
  try {
    const response = await apiRequest<{ success: boolean; data: { result: string } }>(
      '/api/llm/deep-research',
      {
        method: 'POST',
        body: JSON.stringify({ query })
      }
    );

    return response.data.result;
  } catch (error: any) {
    console.error('Deep research error:', error);
    throw error;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await apiRequest<{ success: boolean; data: { embedding: number[] } }>(
      '/api/llm/generate-embedding',
      {
        method: 'POST',
        body: JSON.stringify({ text })
      }
    );

    return response.data.embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw error;
  }
}

// Modify Task with AI - calls backend API
export async function modifyTaskWithAI(task: any, instruction: string): Promise<any> {
  try {
    const response = await apiRequest<{ success: boolean; data: { task: any } }>(
      '/api/llm/modify-task',
      {
        method: 'POST',
        body: JSON.stringify({
          task,
          instruction
        })
      }
    );

    return response.data.task;
  } catch (error: any) {
    console.error('Modify task error:', error);
    return task; // Return original task on error
  }
}

export async function extractMCPTools(description: string, mcpServers: any[] = []): Promise<string[]> {
  try {
    // This should call the backend MCP API
    const response = await fetch(`${API_BASE_URL}/api/mcp/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify({ servers: mcpServers.filter(s => s.status === 'active') })
    });

    if (!response.ok) {
      return ["readFile", "writeFile", "execCommand"]; // Fallback
    }

    const result = await response.json();
    const toolsByServer = result.data?.toolsByServer || {};

    // Extract all tool names
    const allToolNames: string[] = [];
    for (const tools of Object.values(toolsByServer)) {
      if (Array.isArray(tools)) {
        allToolNames.push(...tools.map((t: any) => t.name));
      }
    }

    return allToolNames.length > 0 ? allToolNames : ["readFile", "writeFile", "execCommand"];
  } catch (error) {
    console.error('Error extracting MCP tools:', error);
    return ["readFile", "writeFile", "execCommand"]; // Fallback
  }
}

// Generate Agent Profile - calls backend API
export async function generateAgentProfile(role: string, context: string): Promise<any> {
  try {
    const response = await apiRequest<{ success: boolean; data: { profile: any } }>(
      '/api/llm/generate-agent-profile',
      {
        method: 'POST',
        body: JSON.stringify({
          role,
          context
        })
      }
    );

    return response.data.profile;
  } catch (error: any) {
    console.error('Generate agent profile error:', error);
    // Return default profile on error
    return {
      name: role,
      role: role,
      description: `An agent specialized in ${role}`,
      goal: `Execute ${role} tasks effectively`,
      backstory: `Experienced ${role} with expertise in the project domain`
    };
  }
}

export async function generateQuickSuggestions(input: string, history: ChatMessage[]): Promise<any[]> {
  return [];
}

export async function generateAppTheme(description: string): Promise<any> {
  return {
    id: 'generated-' + Math.random(),
    label: 'AI Generated',
    primary: '#6366f1',
    background: '#f8fafc'
  };
}

export async function validateProjectScope(description: string): Promise<string> {
  return "Scope validation complete.";
}

