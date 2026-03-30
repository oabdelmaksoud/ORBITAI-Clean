/**
 * Neo4j Knowledge Graph Service
 * Enhanced knowledge graph with advanced relationship mapping and graph algorithms
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

// Types for Neo4j (will be resolved from dynamic import)
type Driver = any;
type Session = any;
type Result = any;

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

export interface GraphQueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  paths: GraphPath[];
}

class Neo4jService {
  private driver: Driver | null = null;
  private initialized: boolean = false;
  private neo4j: any = null; // Store the neo4j module

  /**
   * Initialize Neo4j connection
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.driver) {
      return;
    }

    try {
      // Dynamic import to avoid crashing if package is not installed
      const neo4jModule = await import('neo4j-driver').catch((err) => {
        throw new Error('neo4j-driver package not installed. Install it with: npm install neo4j-driver');
      });
      this.neo4j = neo4jModule.default;

      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || '';

      this.driver = this.neo4j.driver(uri, this.neo4j.auth.basic(user, password));

      // Test connection
      const session = this.driver.session();
      await session.run('RETURN 1 as test');
      await session.close();

      // Create indexes
      await this.createIndexes();

      this.initialized = true;
      logger.info('✅ Neo4j service initialized');
    } catch (error: any) {
      logger.error('Failed to initialize Neo4j service:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Create indexes for better performance
   */
  private async createIndexes(): Promise<void> {
    if (!this.driver) return;

    const session = this.driver.session();
    try {
      // Indexes for common queries
      await session.run('CREATE INDEX IF NOT EXISTS FOR (n:ProcessImprovement) ON (n.id)');
      await session.run('CREATE INDEX IF NOT EXISTS FOR (n:KnowledgeBase) ON (n.id)');
      await session.run('CREATE INDEX IF NOT EXISTS FOR (n:Agent) ON (n.role)');
      await session.run('CREATE INDEX IF NOT EXISTS FOR (n:Standard) ON (n.id)');
      await session.run('CREATE INDEX IF NOT EXISTS FOR (n:Project) ON (n.id)');

      logger.debug('Neo4j indexes created');
    } catch (error: any) {
      logger.warn('Failed to create Neo4j indexes:', error.message);
    } finally {
      await session.close();
    }
  }

  /**
   * Create or update a node
   */
  async createNode(
    labels: string[],
    properties: Record<string, any>
  ): Promise<GraphNode> {
    if (!this.driver) {
      await this.initialize();
    }

    const session = this.driver!.session();
    try {
      const labelStr = labels.map(l => `\`${l}\``).join(':');
      const propsStr = Object.keys(properties)
        .map(key => `n.\`${key}\` = $${key}`)
        .join(', ');
      const setProps = Object.keys(properties).length > 0 ? `SET ${propsStr}` : '';

      const query = `
        MERGE (n:${labelStr} {id: $id})
        ${setProps}
        RETURN n
      `;

      const result = await session.run(query, { id: properties.id, ...properties });
      const record = result.records[0];
      const node = record.get('n');

      return {
        id: node.properties.id,
        labels: node.labels,
        properties: node.properties
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Create a relationship between nodes
   */
  async createRelationship(
    startNodeId: string,
    startNodeLabel: string,
    endNodeId: string,
    endNodeLabel: string,
    relationshipType: string,
    properties: Record<string, any> = {}
  ): Promise<GraphRelationship> {
    if (!this.driver) {
      await this.initialize();
    }

    const session = this.driver!.session();
    try {
      const relProps = Object.keys(properties).length > 0
        ? `{${Object.keys(properties).map(k => `${k}: $${k}`).join(', ')}}`
        : '';

      const query = `
        MATCH (a:\`${startNodeLabel}\` {id: $startId})
        MATCH (b:\`${endNodeLabel}\` {id: $endId})
        MERGE (a)-[r:\`${relationshipType}\` ${relProps}]->(b)
        RETURN r, id(r) as relId
      `;

      const params = { startId: startNodeId, endId: endNodeId, ...properties };
      const result = await session.run(query, params);

      if (result.records.length === 0) {
        throw new Error('Failed to create relationship');
      }

      const record = result.records[0];
      const rel = record.get('r');
      const relId = record.get('relId').toString();

      return {
        id: relId,
        type: relationshipType,
        startNodeId: startNodeId,
        endNodeId: endNodeId,
        properties: rel.properties || {}
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Find nodes by label and properties
   */
  async findNodes(
    label: string,
    properties: Record<string, any> = {},
    limit: number = 100
  ): Promise<GraphNode[]> {
    if (!this.driver) {
      await this.initialize();
    }

    const session = this.driver!.session();
    try {
      const whereClause = Object.keys(properties).length > 0
        ? `WHERE ${Object.keys(properties).map(k => `n.\`${k}\` = $${k}`).join(' AND ')}`
        : '';

      const query = `
        MATCH (n:\`${label}\`)
        ${whereClause}
        RETURN n
        LIMIT $limit
      `;

      const result = await session.run(query, { ...properties, limit });

      return result.records.map(record => {
        const node = record.get('n');
        return {
          id: node.properties.id,
          labels: node.labels,
          properties: node.properties
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Traverse graph from a node
   */
  async traverseGraph(
    startNodeId: string,
    startNodeLabel: string,
    relationshipTypes: string[] = [],
    depth: number = 2,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<GraphPath[]> {
    if (!this.driver) {
      await this.initialize();
    }

    const session = this.driver!.session();
    try {
      const relFilter = relationshipTypes.length > 0
        ? `[${relationshipTypes.map(r => `:\`${r}\``).join('|')}]*`
        : '[*]';

      const directionArrow = direction === 'outgoing' ? '->' : direction === 'incoming' ? '<-' : '-';
      const maxDepth = depth > 0 ? `1..${depth}` : '1..';

      const query = `
        MATCH path = (start:\`${startNodeLabel}\` {id: $startId})${directionArrow}${relFilter}${directionArrow}(end)
        WHERE length(path) <= ${depth}
        RETURN path
        LIMIT 100
      `;

      const result = await session.run(query, { startId: startNodeId });

      return result.records.map(record => {
        const path = record.get('path');
        const nodes: GraphNode[] = [];
        const relationships: GraphRelationship[] = [];

        path.segments.forEach((segment: any, index: number) => {
          // Start node
          if (index === 0) {
            nodes.push({
              id: segment.start.properties.id,
              labels: segment.start.labels,
              properties: segment.start.properties
            });
          }

          // Relationship
          relationships.push({
            id: segment.relationship.identity.toString(),
            type: segment.relationship.type,
            startNodeId: segment.start.properties.id,
            endNodeId: segment.end.properties.id,
            properties: segment.relationship.properties || {}
          });

          // End node
          nodes.push({
            id: segment.end.properties.id,
            labels: segment.end.labels,
            properties: segment.end.properties
          });
        });

        return {
          nodes: Array.from(new Map(nodes.map(n => [n.id, n])).values()), // Remove duplicates
          relationships,
          length: path.length
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Find shortest path between two nodes
   */
  async findShortestPath(
    startNodeId: string,
    startNodeLabel: string,
    endNodeId: string,
    endNodeLabel: string,
    relationshipTypes: string[] = []
  ): Promise<GraphPath | null> {
    if (!this.driver) {
      await this.initialize();
    }

    const session = this.driver!.session();
    try {
      const relFilter = relationshipTypes.length > 0
        ? `[${relationshipTypes.map(r => `:\`${r}\``).join('|')}]*`
        : '[*]';

      const query = `
        MATCH path = shortestPath(
          (start:\`${startNodeLabel}\` {id: $startId})-[${relFilter}]-(end:\`${endNodeLabel}\` {id: $endId})
        )
        RETURN path
      `;

      const result = await session.run(query, { startId: startNodeId, endId: endNodeId });

      if (result.records.length === 0) {
        return null;
      }

      const path = result.records[0].get('path');
      const nodes: GraphNode[] = [];
      const relationships: GraphRelationship[] = [];

      path.segments.forEach((segment: any) => {
        if (!nodes.find(n => n.id === segment.start.properties.id)) {
          nodes.push({
            id: segment.start.properties.id,
            labels: segment.start.labels,
            properties: segment.start.properties
          });
        }

        relationships.push({
          id: segment.relationship.identity.toString(),
          type: segment.relationship.type,
          startNodeId: segment.start.properties.id,
          endNodeId: segment.end.properties.id,
          properties: segment.relationship.properties || {}
        });

        if (!nodes.find(n => n.id === segment.end.properties.id)) {
          nodes.push({
            id: segment.end.properties.id,
            labels: segment.end.labels,
            properties: segment.end.properties
          });
        }
      });

      return {
        nodes,
        relationships,
        length: path.length
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Execute custom Cypher query
   */
  async executeQuery(cypher: string, parameters: Record<string, any> = {}): Promise<any> {
    if (!this.driver) {
      await this.initialize();
    }

    const session = this.driver!.session();
    try {
      const result = await session.run(cypher, parameters);
      return {
        records: result.records.map(record => {
          const obj: any = {};
          record.keys.forEach(key => {
            obj[key] = record.get(key);
          });
          return obj;
        }),
        summary: result.summary
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStats(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    nodeLabels: Array<{ label: string; count: number }>;
    relationshipTypes: Array<{ type: string; count: number }>;
  }> {
    if (!this.driver) {
      await this.initialize();
    }

    const session = this.driver!.session();
    try {
      const [nodeCount, relCount, labels, types] = await Promise.all([
        session.run('MATCH (n) RETURN count(n) as count'),
        session.run('MATCH ()-[r]->() RETURN count(r) as count'),
        session.run('CALL db.labels() YIELD label RETURN label'),
        session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType')
      ]);

      const labelCounts = await Promise.all(
        labels.records.map(async (record) => {
          const label = record.get('label');
          const countResult = await session.run(`MATCH (n:\`${label}\`) RETURN count(n) as count`);
          return {
            label,
            count: countResult.records[0].get('count').toNumber()
          };
        })
      );

      const typeCounts = await Promise.all(
        types.records.map(async (record) => {
          const type = record.get('relationshipType');
          const countResult = await session.run(`MATCH ()-[r:\`${type}\`]->() RETURN count(r) as count`);
          return {
            type,
            count: countResult.records[0].get('count').toNumber()
          };
        })
      );

      return {
        nodeCount: nodeCount.records[0].get('count').toNumber(),
        relationshipCount: relCount.records[0].get('count').toNumber(),
        nodeLabels: labelCounts,
        relationshipTypes: typeCounts
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Check if Neo4j is available
   */
  isAvailable(): boolean {
    return this.initialized && this.driver !== null;
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.initialized = false;
      logger.info('Neo4j connection closed');
    }
  }
}

export const neo4jService = new Neo4jService();


