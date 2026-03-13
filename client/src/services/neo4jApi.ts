/**
 * Neo4j API Service
 */

import { apiRequest } from './adminApi';

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
}

export interface GraphStats {
  nodeCount: number;
  relationshipCount: number;
  nodeLabels: Array<{ label: string; count: number }>;
  relationshipTypes: Array<{ type: string; count: number }>;
}

/**
 * Get graph statistics
 */
export async function getGraphStats(token: string): Promise<GraphStats> {
  const response = await apiRequest<{
    success: boolean;
    data: GraphStats;
  }>('/api/admin/neo4j/stats', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch graph stats');
  }

  return response.data;
}

/**
 * Create node
 */
export async function createGraphNode(
  token: string,
  labels: string[],
  properties: Record<string, any>
): Promise<GraphNode> {
  const response = await apiRequest<{
    success: boolean;
    data: GraphNode;
  }>('/api/admin/neo4j/node', {
    method: 'POST',
    body: JSON.stringify({ labels, properties }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create node');
  }

  return response.data;
}

/**
 * Create relationship
 */
export async function createRelationship(
  token: string,
  startNodeId: string,
  startNodeLabel: string,
  endNodeId: string,
  endNodeLabel: string,
  relationshipType: string,
  properties?: Record<string, any>
): Promise<GraphRelationship> {
  const response = await apiRequest<{
    success: boolean;
    data: GraphRelationship;
  }>('/api/admin/neo4j/relationship', {
    method: 'POST',
    body: JSON.stringify({
      startNodeId,
      startNodeLabel,
      endNodeId,
      endNodeLabel,
      relationshipType,
      properties: properties || {}
    }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create relationship');
  }

  return response.data;
}

/**
 * Traverse graph
 */
export async function traverseGraph(
  token: string,
  startNodeId: string,
  startNodeLabel: string,
  relationshipTypes?: string[],
  depth?: number,
  direction?: 'outgoing' | 'incoming' | 'both'
): Promise<GraphPath[]> {
  const response = await apiRequest<{
    success: boolean;
    data: GraphPath[];
  }>('/api/admin/neo4j/traverse', {
    method: 'POST',
    body: JSON.stringify({
      startNodeId,
      startNodeLabel,
      relationshipTypes: relationshipTypes || [],
      depth: depth || 2,
      direction: direction || 'both'
    }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to traverse graph');
  }

  return response.data;
}

/**
 * Find shortest path
 */
export async function findShortestPath(
  token: string,
  startNodeId: string,
  startNodeLabel: string,
  endNodeId: string,
  endNodeLabel: string,
  relationshipTypes?: string[]
): Promise<GraphPath | null> {
  const response = await apiRequest<{
    success: boolean;
    data: GraphPath | null;
  }>('/api/admin/neo4j/shortest-path', {
    method: 'POST',
    body: JSON.stringify({
      startNodeId,
      startNodeLabel,
      endNodeId,
      endNodeLabel,
      relationshipTypes: relationshipTypes || []
    }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to find shortest path');
  }

  return response.data;
}
















