/**
 * Custom Agent API Service
 * Frontend service for managing custom agents
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface CustomAgent {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  role: string;
  mode: 'Reasoning' | 'Deterministic';
  avatar: string;
  description: string;
  goal: string;
  backstory: string;
  systemPrompt?: string;
  capabilities: string[];
  preferredLLM?: string;
  temperature?: number;
  maxTokens?: number;
  tools: string[];
  isActive: boolean;
  isPublic: boolean;
  usageCount: number;
  rating?: number;
  ratingCount?: number;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomAgentRequest {
  name: string;
  role: string;
  mode?: 'Reasoning' | 'Deterministic';
  avatar?: string;
  description: string;
  goal: string;
  backstory: string;
  systemPrompt?: string;
  capabilities?: string[];
  preferredLLM?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  isPublic?: boolean;
  tags?: string[];
  projectId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateCustomAgentRequest extends Partial<CreateCustomAgentRequest> {
  isActive?: boolean;
}

export interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  goal: string;
  backstory?: string;
  capabilities: string[];
  tags: string[];
}

export interface ProjectAgent extends CustomAgent {
  projectId: string;
  projectName: string;
  projectDescription: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
}

export interface ProjectAgentGroup {
  projectId: string;
  projectName: string;
  projectDescription: string;
  agents: ProjectAgent[];
}

export interface AllProjectAgentsResponse {
  totalAgents: number;
  totalProjects: number;
  projectAgents: ProjectAgentGroup[];
  allAgents: ProjectAgent[];
}

function getAuthHeaders(token?: string): HeadersInit {
  // Use provided token, or try admin_token (for admin console), then regular token
  const authToken = token || localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || `HTTP error ${response.status}`);
  }
  return response.json();
}

export const customAgentApi = {
  /**
   * Get all custom agents for the current user
   */
  async getAgents(projectId?: string, includePublic = false): Promise<CustomAgent[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    if (includePublic) params.append('includePublic', 'true');
    
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents?${params.toString()}`,
      { headers: getAuthHeaders() }
    );
    
    const data = await handleResponse<{ success: boolean; data: { agents: CustomAgent[] } }>(response);
    return data.data.agents;
  },

  /**
   * Get public agents (marketplace)
   */
  async getPublicAgents(options?: { search?: string; tags?: string[]; sort?: 'popular' | 'newest' | 'rating' }): Promise<CustomAgent[]> {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.tags?.length) params.append('tags', options.tags.join(','));
    if (options?.sort) params.append('sort', options.sort);
    
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/public?${params.toString()}`,
      { headers: getAuthHeaders() }
    );
    
    const data = await handleResponse<{ success: boolean; data: { agents: CustomAgent[] } }>(response);
    return data.data.agents;
  },

  /**
   * Get a specific custom agent
   */
  async getAgent(agentId: string): Promise<CustomAgent> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/${agentId}`,
      { headers: getAuthHeaders() }
    );
    
    const data = await handleResponse<{ success: boolean; data: { agent: CustomAgent } }>(response);
    return data.data.agent;
  },

  /**
   * Create a new custom agent
   */
  async createAgent(agentData: CreateCustomAgentRequest): Promise<CustomAgent> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(agentData)
      }
    );
    
    const data = await handleResponse<{ success: boolean; data: { agent: CustomAgent } }>(response);
    return data.data.agent;
  },

  /**
   * Update a custom agent
   */
  async updateAgent(agentId: string, updates: UpdateCustomAgentRequest): Promise<CustomAgent> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/${agentId}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      }
    );
    
    const data = await handleResponse<{ success: boolean; data: { agent: CustomAgent } }>(response);
    return data.data.agent;
  },

  /**
   * Delete a custom agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/${agentId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders()
      }
    );
    
    await handleResponse<{ success: boolean; message: string }>(response);
  },

  /**
   * Clone an agent to your collection
   */
  async cloneAgent(agentId: string): Promise<CustomAgent> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/${agentId}/clone`,
      {
        method: 'POST',
        headers: getAuthHeaders()
      }
    );
    
    const data = await handleResponse<{ success: boolean; data: { agent: CustomAgent } }>(response);
    return data.data.agent;
  },

  /**
   * Rate a public agent
   */
  async rateAgent(agentId: string, rating: number): Promise<{ rating: number; ratingCount: number }> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/${agentId}/rate`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rating })
      }
    );
    
    const data = await handleResponse<{ success: boolean; data: { rating: number; ratingCount: number } }>(response);
    return data.data;
  },

  /**
   * Get agent templates
   */
  async getTemplates(): Promise<AgentTemplate[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/templates/list`,
      { headers: getAuthHeaders() }
    );
    
    const data = await handleResponse<{ success: boolean; data: { templates: AgentTemplate[] } }>(response);
    return data.data.templates;
  },

  /**
   * Get all agents across all projects (admin only)
   * Shows agents created by the system in different projects
   */
  async getAllProjectAgents(token?: string): Promise<AllProjectAgentsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/custom-agents/all-projects`,
      { headers: getAuthHeaders(token) }
    );
    
    const data = await handleResponse<{ success: boolean; data: AllProjectAgentsResponse }>(response);
    return data.data;
  }
};


