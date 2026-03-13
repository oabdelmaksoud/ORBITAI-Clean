/**
 * Process Mining API Service
 */

import { apiRequest } from './adminApi';

export interface WorkflowPattern {
  id: string;
  name: string;
  agentRole: string;
  steps: Array<{
    stepNumber: number;
    taskType: string;
    taskTitle: string;
    averageDuration: number;
    successRate: number;
    nextSteps: Array<{ step: number; probability: number }>;
  }>;
  frequency: number;
  successRate: number;
  averageDuration: number;
  variants: Array<{
    variantId: string;
    steps: any[];
    frequency: number;
    successRate: number;
  }>;
}

export interface Bottleneck {
  stepNumber: number;
  taskType: string;
  averageWaitTime: number;
  averageDuration: number;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
}

export interface ProcessDiscoveryResult {
  patterns: WorkflowPattern[];
  bottlenecks: Bottleneck[];
  recommendations: string[];
  statistics: {
    totalWorkflows: number;
    uniquePatterns: number;
    averageSteps: number;
    averageSuccessRate: number;
  };
}

/**
 * Discover workflows
 */
export async function discoverWorkflows(
  token: string,
  agentRole: string,
  projectId?: string
): Promise<ProcessDiscoveryResult> {
  const response = await apiRequest<{
    success: boolean;
    data: ProcessDiscoveryResult;
  }>('/api/admin/process-mining/discover', {
    method: 'POST',
    body: JSON.stringify({ agentRole, projectId }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to discover workflows');
  }

  return response.data;
}

/**
 * Suggest improvements from patterns
 */
export async function suggestImprovementsFromMining(
  token: string,
  patterns: WorkflowPattern[],
  bottlenecks: Bottleneck[]
): Promise<Array<{
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}>> {
  const response = await apiRequest<{
    success: boolean;
    data: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      category: string;
    }>;
  }>('/api/admin/process-mining/suggest-improvements', {
    method: 'POST',
    body: JSON.stringify({ patterns, bottlenecks }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to suggest improvements');
  }

  return response.data;
}
















