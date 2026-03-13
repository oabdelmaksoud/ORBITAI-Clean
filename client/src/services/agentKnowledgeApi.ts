/**
 * Agent Knowledge API Service
 * Frontend service for fetching agent knowledge and skill matrix
 */

import { apiRequest } from './adminApi';

export interface KnowledgeDomain {
  domain: string;
  level: number;
  lastUpdated?: Date;
  examples?: string[];
}

export interface AgentSkill {
  skill: string;
  category: string;
  proficiency: number;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  lastUsed?: Date;
  successRate?: number;
  tasksCompleted?: number;
}

export interface AgentMetrics {
  totalTasksCompleted: number;
  averageTaskQuality: number;
  averageResponseTime: number;
  userSatisfactionRating?: number;
  lastActiveDate?: Date;
}

export interface PreferredModel {
  modelId: string;
  provider: string;
  usageCount: number;
  successRate: number;
  averageLatency: number;
  lastUsed?: Date;
}

export interface AgentKnowledge {
  _id?: string;
  agentRole: string;
  agentId?: string;
  knowledgeDomains: KnowledgeDomain[];
  skills: AgentSkill[];
  specializations: string[];
  metrics: AgentMetrics;
  preferredModels: PreferredModel[];
  knowledgeBaseRefs: Array<{
    kbId: string;
    kbName: string;
    relevance: number;
    lastAccessed?: Date;
  }>;
  metadata?: {
    version: number;
    lastTrained?: Date;
    trainingData?: string;
    notes?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GlobalKnowledgeMatrix {
  agents: Array<{
    agentRole: string;
    metrics: AgentMetrics;
    specializations: string[];
  }>;
  skillMatrix: Array<{
    skill: string;
    category: string;
    agents: Array<{
      agentRole: string;
      proficiency: number;
      experienceLevel: string;
      tasksCompleted?: number;
    }>;
    averageProficiency: number;
  }>;
  knowledgeMatrix: Array<{
    domain: string;
    agents: Array<{
      agentRole: string;
      level: number;
      lastUpdated?: Date;
    }>;
    averageLevel: number;
  }>;
  summary: {
    totalAgents: number;
    totalSkills: number;
    totalKnowledgeDomains: number;
  };
}

export interface AgentKnowledgeResponse {
  agents: AgentKnowledge[];
  totalAgents: number;
  summary: {
    totalTasksCompleted: number;
    averageQuality: number;
    totalSkills: number;
    totalKnowledgeDomains: number;
  };
}

/**
 * Get all agent knowledge
 */
export async function getAllAgentKnowledge(token: string): Promise<AgentKnowledgeResponse> {
  const response = await apiRequest<{
    success: boolean;
    data: AgentKnowledgeResponse;
  }>('/api/admin/agent-knowledge', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch agent knowledge');
  }

  return response.data;
}

/**
 * Get knowledge for a specific agent role
 */
export async function getAgentKnowledge(token: string, agentRole: string): Promise<AgentKnowledge> {
  const response = await apiRequest<{
    success: boolean;
    data: { agent: AgentKnowledge };
  }>(`/api/admin/agent-knowledge/${encodeURIComponent(agentRole)}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch agent knowledge');
  }

  return response.data.agent;
}

/**
 * Get global knowledge and skill matrix
 */
export async function getGlobalKnowledgeMatrix(token: string): Promise<GlobalKnowledgeMatrix> {
  const response = await apiRequest<{
    success: boolean;
    data: GlobalKnowledgeMatrix;
  }>('/api/admin/agent-knowledge/matrix/global', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch global knowledge matrix');
  }

  return response.data;
}

