/**
 * Workflow Engine API Service
 */

import { apiRequest } from './adminApi';

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description: string;
  bpmnXml: string;
  version?: number;
  status?: 'draft' | 'active' | 'archived';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowInstance {
  id: string;
  workflowDefinitionId: string;
  status: 'running' | 'completed' | 'suspended' | 'terminated';
  startTime: string;
  endTime?: string;
  variables?: Record<string, any>;
  currentTasks?: Array<{
    id: string;
    name: string;
    assignee?: string;
    dueDate?: string;
  }>;
}

export interface WorkflowTask {
  id: string;
  name: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  status: 'created' | 'assigned' | 'in-progress' | 'completed';
}

/**
 * Get all workflow definitions
 */
export async function getWorkflowDefinitions(token: string): Promise<WorkflowDefinition[]> {
  const response = await apiRequest<{
    success: boolean;
    data: WorkflowDefinition[];
  }>('/api/admin/workflow/definitions', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch workflow definitions');
  }

  return response.data;
}

/**
 * Get workflow definition by ID
 */
export async function getWorkflowDefinition(token: string, id: string): Promise<WorkflowDefinition> {
  const response = await apiRequest<{
    success: boolean;
    data: WorkflowDefinition;
  }>(`/api/admin/workflow/definitions/${id}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch workflow definition');
  }

  return response.data;
}

/**
 * Create workflow definition
 */
export async function createWorkflowDefinition(
  token: string,
  definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>
): Promise<WorkflowDefinition> {
  const response = await apiRequest<{
    success: boolean;
    data: WorkflowDefinition;
  }>('/api/admin/workflow/definitions', {
    method: 'POST',
    body: JSON.stringify(definition),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create workflow definition');
  }

  return response.data;
}

/**
 * Update workflow definition
 */
export async function updateWorkflowDefinition(
  token: string,
  id: string,
  definition: Partial<WorkflowDefinition>
): Promise<WorkflowDefinition> {
  const response = await apiRequest<{
    success: boolean;
    data: WorkflowDefinition;
  }>(`/api/admin/workflow/definitions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(definition),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update workflow definition');
  }

  return response.data;
}

/**
 * Delete workflow definition
 */
export async function deleteWorkflowDefinition(token: string, id: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>(`/api/admin/workflow/definitions/${id}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete workflow definition');
  }
}

/**
 * Start workflow instance
 */
export async function startWorkflowInstance(
  token: string,
  workflowDefinitionId: string,
  variables?: Record<string, any>
): Promise<WorkflowInstance> {
  const response = await apiRequest<{
    success: boolean;
    data: WorkflowInstance;
  }>('/api/admin/workflow/instances', {
    method: 'POST',
    body: JSON.stringify({ workflowDefinitionId, variables }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to start workflow instance');
  }

  return response.data;
}

/**
 * Get workflow instances
 */
export async function getWorkflowInstances(
  token: string,
  workflowDefinitionId?: string
): Promise<WorkflowInstance[]> {
  const params = workflowDefinitionId ? `?workflowDefinitionId=${workflowDefinitionId}` : '';
  const response = await apiRequest<{
    success: boolean;
    data: WorkflowInstance[];
  }>(`/api/admin/workflow/instances${params}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch workflow instances');
  }

  return response.data;
}

/**
 * Get workflow instance by ID
 */
export async function getWorkflowInstance(token: string, id: string): Promise<WorkflowInstance> {
  const response = await apiRequest<{
    success: boolean;
    data: WorkflowInstance;
  }>(`/api/admin/workflow/instances/${id}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch workflow instance');
  }

  return response.data;
}

/**
 * Complete workflow task
 */
export async function completeWorkflowTask(
  token: string,
  taskId: string,
  variables?: Record<string, any>
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>(`/api/admin/workflow/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ variables }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to complete workflow task');
  }
}
















