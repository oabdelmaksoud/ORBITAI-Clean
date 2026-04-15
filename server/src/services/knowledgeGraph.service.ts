/**
 * Knowledge Graph Service (via Weaviate)
 * Provides knowledge graph capabilities including entity extraction,
 * relationship mapping, and graph-based queries
 */

import { weaviateService } from './weaviate.service.js';
import { embeddingService } from './embedding.service.js';
import { logger } from '../utils/logger.js';

export interface Entity {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
  embedding?: number[];
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties?: Record<string, any>;
  strength?: number;
}

export interface GraphQuery {
  entityId?: string;
  entityName?: string;
  relationshipType?: string;
  depth?: number;
  limit?: number;
}

export interface GraphPath {
  entities: Entity[];
  relationships: Relationship[];
  path: string[];
}

class KnowledgeGraphService {
  private initialized: boolean = false;
  // @ts-ignore TS6133
  private _entityClass: string = 'KnowledgeEntity';
  // @ts-ignore TS6133
  private _relationshipClass: string = 'KnowledgeRelationship';

  /**
   * Initialize knowledge graph service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await weaviateService.initialize();
      
      if (!weaviateService.isAvailable()) {
        logger.warn('Weaviate not available, knowledge graph features will be limited');
        this.initialized = true;
        return;
      }

      // Note: Weaviate schema creation is handled by weaviateService
      // We'll use the existing schema and extend it for knowledge graph use
      
      this.initialized = true;
      logger.info('✅ Knowledge Graph service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize Knowledge Graph service:', error);
      throw error;
    }
  }

  /**
   * Add or update an entity in the knowledge graph
   */
  async addEntity(entity: Entity): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!weaviateService.isAvailable()) {
      throw new Error('Weaviate is not available for knowledge graph operations');
    }

    try {
      // Generate embedding if not provided
      let embedding = entity.embedding;
      if (!embedding || embedding.length === 0) {
        const textToEmbed = `${entity.name} ${entity.type} ${JSON.stringify(entity.properties || {})}`.substring(0, 8000);
        embedding = await embeddingService.generateEmbedding(textToEmbed);
      }

      // Store entity in Weaviate
      // We'll use the existing artifact schema but with entity-specific metadata
      const artifact = {
        id: entity.id,
        title: entity.name,
        content: JSON.stringify({
          type: entity.type,
          properties: entity.properties || {},
        }),
        type: 'knowledge_entity',
        createdBy: 'knowledge_graph',
        tags: [entity.type],
        embedding: embedding,
      } as any;

      // Use Weaviate service to store
      await weaviateService.addArtifact(artifact);

      logger.debug(`Added entity to knowledge graph: ${entity.id} (${entity.name})`);
    } catch (error: unknown) {
      logger.error(`Failed to add entity ${entity.id}:`, error);
      throw error;
    }
  }

  /**
   * Add a relationship between entities
   */
  async addRelationship(relationship: Relationship): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!weaviateService.isAvailable()) {
      throw new Error('Weaviate is not available for knowledge graph operations');
    }

    try {
      // Store relationship as a special artifact
      const relationshipId = relationship.id || `rel_${relationship.sourceId}_${relationship.targetId}_${relationship.type}`;
      
      const artifact = {
        id: relationshipId,
        title: `${relationship.type}: ${relationship.sourceId} -> ${relationship.targetId}`,
        content: JSON.stringify({
          sourceId: relationship.sourceId,
          targetId: relationship.targetId,
          type: relationship.type,
          properties: relationship.properties || {},
          strength: relationship.strength || 1.0,
        }),
        type: 'knowledge_relationship',
        createdBy: 'knowledge_graph',
        tags: [relationship.type, 'relationship'],
        embedding: await embeddingService.generateEmbedding(
          `${relationship.type} ${relationship.sourceId} ${relationship.targetId}`
        ),
      } as any;

      await weaviateService.addArtifact(artifact);

      logger.debug(`Added relationship: ${relationship.type} (${relationship.sourceId} -> ${relationship.targetId})`);
    } catch (error: unknown) {
      logger.error(`Failed to add relationship:`, error);
      throw error;
    }
  }

  /**
   * Find entities by query
   */
  async findEntities(query: string, limit: number = 10): Promise<Entity[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!weaviateService.isAvailable()) {
      return [];
    }

    try {
      const results = await weaviateService.vectorSearch(query, limit, {
        type: 'knowledge_entity',
      });

      return results.map(result => {
        try {
          const data = JSON.parse(result.text);
          return {
            id: result.id,
            name: result.metadata?.title || result.id,
            type: data.type || 'unknown',
            properties: data.properties || {},
          };
        } catch {
          return {
            id: result.id,
            name: result.metadata?.title || result.id,
            type: 'unknown',
            properties: {},
          };
        }
      });
    } catch (error: unknown) {
      logger.error('Failed to find entities:', error);
      return [];
    }
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityId: string): Promise<Entity | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!weaviateService.isAvailable()) {
      return null;
    }

    try {
      // Search for entity by ID
      const results = await weaviateService.vectorSearch(entityId, 1, {
        type: 'knowledge_entity',
      });

      if (results.length === 0) {
        return null;
      }

      const result = results[0];
      try {
        const data = JSON.parse(result.text);
        return {
          id: result.id,
          name: result.metadata?.title || result.id,
          type: data.type || 'unknown',
          properties: data.properties || {},
        };
      } catch {
        return {
          id: result.id,
          name: result.metadata?.title || result.id,
          type: 'unknown',
          properties: {},
        };
      }
    } catch (error: unknown) {
      logger.error(`Failed to get entity ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Get relationships for an entity
   */
  async getEntityRelationships(entityId: string, relationshipType?: string): Promise<Relationship[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!weaviateService.isAvailable()) {
      return [];
    }

    try {
      // Search for relationships involving this entity
      const query = relationshipType 
        ? `${relationshipType} ${entityId}`
        : entityId;

      const results = await weaviateService.vectorSearch(query, 50, {
        type: 'knowledge_relationship',
      });

      const relationships: Relationship[] = [];

      for (const result of results) {
        try {
          const data = JSON.parse(result.text);
          
          // Check if this relationship involves the entity
          if (data.sourceId === entityId || data.targetId === entityId) {
            if (!relationshipType || data.type === relationshipType) {
              relationships.push({
                id: result.id,
                sourceId: data.sourceId,
                targetId: data.targetId,
                type: data.type,
                properties: data.properties || {},
                strength: data.strength || 1.0,
              });
            }
          }
        } catch (error: unknown) {
          // Skip malformed relationships
          continue;
        }
      }

      return relationships;
    } catch (error: unknown) {
      logger.error(`Failed to get relationships for ${entityId}:`, error);
      return [];
    }
  }

  /**
   * Find path between two entities
   */
  async findPath(sourceId: string, targetId: string, maxDepth: number = 3): Promise<GraphPath | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!weaviateService.isAvailable()) {
      return null;
    }

    try {
      // Simple BFS path finding
      const visited = new Set<string>();
      const queue: Array<{ entityId: string; path: string[]; relationships: Relationship[] }> = [
        { entityId: sourceId, path: [sourceId], relationships: [] },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (current.entityId === targetId) {
          // Found path
          const entities: Entity[] = [];
          for (const entityId of current.path) {
            const entity = await this.getEntity(entityId);
            if (entity) {
              entities.push(entity);
            }
          }

          return {
            entities,
            relationships: current.relationships,
            path: current.path,
          };
        }

        if (current.path.length > maxDepth) {
          continue;
        }

        if (visited.has(current.entityId)) {
          continue;
        }
        visited.add(current.entityId);

        // Get relationships for current entity
        const relationships = await this.getEntityRelationships(current.entityId);
        
        for (const rel of relationships) {
          const nextEntityId = rel.sourceId === current.entityId ? rel.targetId : rel.sourceId;
          
          if (!visited.has(nextEntityId) && !current.path.includes(nextEntityId)) {
            queue.push({
              entityId: nextEntityId,
              path: [...current.path, nextEntityId],
              relationships: [...current.relationships, rel],
            });
          }
        }
      }

      return null; // No path found
    } catch (error: unknown) {
      logger.error(`Failed to find path from ${sourceId} to ${targetId}:`, error);
      return null;
    }
  }

  /**
   * Extract entities and relationships from text
   */
  async extractFromText(_text: string): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    // This is a simplified extraction
    // In production, you'd use an LLM or NER model for entity extraction
    
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    // Placeholder: In a real implementation, you'd use an LLM to extract entities and relationships
    // For now, return empty arrays
    
    logger.debug(`Extracted ${entities.length} entities and ${relationships.length} relationships from text`);
    
    return { entities, relationships };
  }

  /**
   * Get graph statistics
   */
  async getGraphStats(): Promise<{
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<string, number>;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!weaviateService.isAvailable()) {
      return {
        totalEntities: 0,
        totalRelationships: 0,
        entityTypes: {},
      };
    }

    try {
      const totalEntities = await weaviateService.getDocumentCount();
      
      // Note: In a full implementation, you'd query for entity types
      // This is a simplified version
      
      return {
        totalEntities,
        totalRelationships: 0, // Would need separate tracking
        entityTypes: {},
      };
    } catch (error: unknown) {
      logger.error('Failed to get graph stats:', error);
      return {
        totalEntities: 0,
        totalRelationships: 0,
        entityTypes: {},
      };
    }
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
















