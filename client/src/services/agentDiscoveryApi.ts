/**
 * Agent Discovery API Service
 * Frontend service for fetching available agents for reuse
 */

import { apiRequest } from './adminApi';

export interface AvailableAgent {
  agentRole: string;
  metrics: {
    totalTasksCompleted: number;
    averageTaskQuality: number;
    averageResponseTime: number;
    lastActiveDate?: Date;
  };
  skillsCount: number;
  domainsCount: number;
  lastActive?: Date;
}

export interface AgentDiscoveryResponse {
  agents: AvailableAgent[];
}

/**
 * Get all available agents for reuse across projects
 */
export async function getAvailableAgents(token: string): Promise<AgentDiscoveryResponse> {
  const response = await apiRequest<{
    success: boolean;
    data: AgentDiscoveryResponse;
  }>('/api/agents/available', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch available agents');
  }

  return response.data;
}

/**
 * Trigger agent discovery from all projects (admin only)
 */
export async function discoverAgents(token: string): Promise<{
  discoveredAgents: Array<{
    agentRole: string;
    name?: string;
    description?: string;
  }>;
  count: number;
  message: string;
}> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      discoveredAgents: Array<{
        agentRole: string;
        name?: string;
        description?: string;
      }>;
      count: number;
      message: string;
    };
  }>('/api/admin/agents/discover', {
    method: 'POST',
  }, token);

  if (!response.success) {
    throw new Error('Failed to discover agents');
  }

  return response.data;
}

