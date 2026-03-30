/**
 * Weaviate Vector Database Service
 * Production-grade vector database integration for RAG and semantic search
 */

import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { embeddingService } from './embedding.service.js';
import { Artifact } from '../../../types.js';

// Lazy import Weaviate to avoid startup failure if package not installed
let weaviateClient: any = null;
let WeaviateClient: any = null;
let ApiKey: any = null;

async function loadWeaviateClient() {
  if (weaviateClient !== null) return; // Already loaded or attempted
  
  try {
    const weaviateModule = await import('weaviate-ts-client');
    weaviateClient = weaviateModule.default;
    WeaviateClient = weaviateModule.WeaviateClient;
    ApiKey = weaviateModule.ApiKey;
  } catch (error: any) {
    logger.warn('Weaviate package not installed. Vector search will use in-memory fallback.');
    logger.debug('Install with: npm install weaviate-ts-client');
    weaviateClient = false; // Mark as unavailable
  }
}

interface WeaviateArtifact {
  id: string;
  artifactId: string;
  projectId?: string;
  userId?: string;
  title: string;
  content: string;
  type: string;
  phase?: string;
  createdBy?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class WeaviateService {
  private client: any = null;
  private initialized: boolean = false;
  private className: string;

  constructor() {
    this.className = config.weaviateClassName;
  }

  /**
   * Initialize Weaviate client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Lazy load Weaviate client
    await loadWeaviateClient();
    
    if (weaviateClient === false) {
      // Weaviate package not available
      logger.debug('Weaviate not available, service will be disabled');
      return;
    }

    try {
      // Ensure Weaviate URL is configured
      if (!config.weaviateUrl) {
        logger.debug('Weaviate URL not configured, service will be disabled');
        return;
      }

      // Parse URL to extract host and scheme
      const url = new URL(config.weaviateUrl);
      const scheme = url.protocol === 'https:' ? 'https' : 'http';
      const host = url.host; // Includes port if specified

      // Create Weaviate client
      if (config.weaviateApiKey && ApiKey) {
        // Cloud instance with API key
        this.client = weaviateClient.client({
          scheme: scheme,
          host: host,
          apiKey: new ApiKey(config.weaviateApiKey),
        });
      } else {
        // Local instance without API key
        this.client = weaviateClient.client({
          scheme: scheme,
          host: host,
        });
      }

      // Check connection
      await this.client.misc.metaGetter().do();
      
      // Create schema if it doesn't exist
      await this.ensureSchema();

      this.initialized = true;
      logger.info(`✅ Weaviate connected: ${config.weaviateUrl}`);
    } catch (error: any) {
      logger.error('Failed to initialize Weaviate:', error);
      logger.warn('Vector search will use fallback (in-memory)');
      this.client = null;
    }
  }

  /**
   * Ensure Weaviate schema exists
   */
  private async ensureSchema(): Promise<void> {
    if (!this.client) return;

    try {
      // Check if class exists
      const schema = await this.client.schema.getter().do();
      const classExists = schema.classes?.some((cls: any) => cls.class === this.className);

      if (classExists) {
        logger.debug(`Weaviate class "${this.className}" already exists`);
        return;
      }

      // Create class schema
      const embeddingDimensions = embeddingService.getEmbeddingDimensions();

      const classDefinition = {
        class: this.className,
        description: 'OrbitAI Artifacts for semantic search and RAG',
        vectorizer: 'none' as const, // We provide our own embeddings
        properties: [
          {
            name: 'artifactId',
            dataType: ['string'],
            description: 'Unique artifact ID',
            indexInverted: true,
          },
          {
            name: 'projectId',
            dataType: ['string'],
            description: 'Project ID',
            indexInverted: true,
          },
          {
            name: 'userId',
            dataType: ['string'],
            description: 'User ID',
            indexInverted: true,
          },
          {
            name: 'title',
            dataType: ['string'],
            description: 'Artifact title',
            indexInverted: true,
          },
          {
            name: 'content',
            dataType: ['text'],
            description: 'Artifact content',
            indexInverted: true,
          },
          {
            name: 'type',
            dataType: ['string'],
            description: 'Artifact type',
            indexInverted: true,
          },
          {
            name: 'phase',
            dataType: ['string'],
            description: 'Project phase',
            indexInverted: true,
          },
          {
            name: 'createdBy',
            dataType: ['string'],
            description: 'Agent role that created the artifact',
          },
          {
            name: 'tags',
            dataType: ['string[]'],
            description: 'Artifact tags',
          },
          {
            name: 'createdAt',
            dataType: ['date'],
            description: 'Creation timestamp',
          },
          {
            name: 'updatedAt',
            dataType: ['date'],
            description: 'Update timestamp',
          },
        ],
        vectorIndexType: 'hnsw' as const,
        vectorIndexConfig: {
          distance: 'cosine' as const,
        },
      };

      await this.client.schema.classCreator().withClass(classDefinition).do();
      logger.info(`✅ Created Weaviate class: ${this.className}`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        logger.debug(`Weaviate class "${this.className}" already exists`);
      } else {
        logger.error('Failed to create Weaviate schema:', error);
        throw error;
      }
    }
  }

  /**
   * Check if Weaviate is available
   */
  isAvailable(): boolean {
    return this.client !== null && this.initialized;
  }

  /**
   * Initialize with artifacts
   */
  async initializeWithArtifacts(artifacts: Artifact[]): Promise<void> {
    await this.initialize();
    
    if (!this.isAvailable()) {
      logger.warn('Weaviate not available, skipping artifact initialization');
      return;
    }

    try {
      // Batch insert artifacts
      const batchSize = 100;
      for (let i = 0; i < artifacts.length; i += batchSize) {
        const batch = artifacts.slice(i, i + batchSize);
        await Promise.all(batch.map(artifact => this.addArtifact(artifact)));
      }

      logger.info(`✅ Initialized Weaviate with ${artifacts.length} artifacts`);
    } catch (error: any) {
      logger.error('Failed to initialize artifacts in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Add or update an artifact
   */
  async addArtifact(artifact: Artifact): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Weaviate is not available');
    }

    try {
      // Generate embedding if not present
      let embedding = artifact.embedding;
      if (!embedding || embedding.length === 0) {
        const textToEmbed = `${artifact.title} ${artifact.content || ''}`.substring(0, 8000);
        embedding = await embeddingService.generateEmbedding(textToEmbed);
      }

      // Prepare Weaviate object
      const weaviateObject: WeaviateArtifact = {
        id: artifact.id,
        artifactId: artifact.id,
        projectId: (artifact as any).projectId,
        userId: (artifact as any).userId,
        title: artifact.title,
        content: artifact.content || artifact.title,
        type: artifact.type,
        phase: artifact.phase,
        createdBy: artifact.createdBy,
        tags: artifact.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Upsert (insert or update)
      await this.client!.data
        .merger()
        .withId(artifact.id)
        .withClassName(this.className)
        .withProperties(weaviateObject)
        .withVector(embedding)
        .do();

      logger.debug(`Added artifact to Weaviate: ${artifact.id}`);
    } catch (error: any) {
      logger.error(`Failed to add artifact ${artifact.id} to Weaviate:`, error);
      throw error;
    }
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(artifactId: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Weaviate is not available');
    }

    try {
      await this.client!.data
        .deleter()
        .withId(artifactId)
        .withClassName(this.className)
        .do();

      logger.debug(`Deleted artifact from Weaviate: ${artifactId}`);
    } catch (error: any) {
      logger.error(`Failed to delete artifact ${artifactId} from Weaviate:`, error);
      throw error;
    }
  }

  /**
   * Perform vector similarity search
   */
  async vectorSearch(
    query: string,
    topK: number = 5,
    filters?: {
      projectId?: string;
      userId?: string;
      type?: string;
      phase?: string;
    }
  ): Promise<Array<{
    id: string;
    text: string;
    score: number;
    metadata?: Record<string, any>;
  }>> {
    if (!this.isAvailable()) {
      logger.warn('Weaviate not available, returning empty results');
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Build filter
      let whereFilter: any = undefined;
      if (filters) {
        const conditions: any[] = [];
        if (filters.projectId) {
          conditions.push({
            path: ['projectId'],
            operator: 'Equal' as const,
            valueString: filters.projectId,
          });
        }
        if (filters.userId) {
          conditions.push({
            path: ['userId'],
            operator: 'Equal' as const,
            valueString: filters.userId,
          });
        }
        if (filters.type) {
          conditions.push({
            path: ['type'],
            operator: 'Equal' as const,
            valueString: filters.type,
          });
        }
        if (filters.phase) {
          conditions.push({
            path: ['phase'],
            operator: 'Equal' as const,
            valueString: filters.phase,
          });
        }

        if (conditions.length === 1) {
          whereFilter = conditions[0];
        } else if (conditions.length > 1) {
          whereFilter = {
            operator: 'And' as const,
            operands: conditions,
          };
        }
      }

      // Perform vector search
      const result = await this.client!.graphql
        .get()
        .withClassName(this.className)
        .withFields('artifactId title content type phase createdBy tags')
        .withNearVector({
          vector: queryEmbedding,
          certainty: 0.7, // Minimum similarity threshold
        })
        .withLimit(topK)
        .withWhere(whereFilter)
        .do();

      // Transform results
      const artifacts = (result.data?.Get?.[this.className] as any[]) || [];
      
      return artifacts.map((item: any) => ({
        id: item.artifactId || item._additional?.id,
        text: item.content || item.title,
        score: item._additional?.certainty || 0,
        metadata: {
          title: item.title,
          type: item.type,
          phase: item.phase,
          createdBy: item.createdBy,
          tags: item.tags,
        },
      }));
    } catch (error: any) {
      logger.error('Weaviate vector search failed:', error);
      return [];
    }
  }

  /**
   * Perform hybrid search (vector + keyword)
   */
  async hybridSearch(
    query: string,
    topK: number = 5,
    filters?: {
      projectId?: string;
      userId?: string;
      type?: string;
      phase?: string;
    }
  ): Promise<Array<{
    id: string;
    text: string;
    score: number;
    metadata?: Record<string, any>;
  }>> {
    if (!this.isAvailable()) {
      return await this.vectorSearch(query, topK, filters);
    }

    try {
      // Generate query embedding for vector search
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Build filter (same as vector search)
      let whereFilter: any = undefined;
      if (filters) {
        const conditions: any[] = [];
        if (filters.projectId) {
          conditions.push({
            path: ['projectId'],
            operator: 'Equal' as const,
            valueString: filters.projectId,
          });
        }
        if (filters.userId) {
          conditions.push({
            path: ['userId'],
            operator: 'Equal' as const,
            valueString: filters.userId,
          });
        }
        if (filters.type) {
          conditions.push({
            path: ['type'],
            operator: 'Equal' as const,
            valueString: filters.type,
          });
        }
        if (filters.phase) {
          conditions.push({
            path: ['phase'],
            operator: 'Equal' as const,
            valueString: filters.phase,
          });
        }

        if (conditions.length === 1) {
          whereFilter = conditions[0];
        } else if (conditions.length > 1) {
          whereFilter = {
            operator: 'And' as const,
            operands: conditions,
          };
        }
      }

      // Perform hybrid search (vector + BM25 keyword search)
      const result = await this.client!.graphql
        .get()
        .withClassName(this.className)
        .withFields('artifactId title content type phase createdBy tags')
        .withHybrid({
          query: query,
          vector: queryEmbedding,
          alpha: 0.7, // 70% vector, 30% keyword
        })
        .withLimit(topK)
        .withWhere(whereFilter)
        .do();

      // Transform results
      const artifacts = (result.data?.Get?.[this.className] as any[]) || [];
      
      return artifacts.map((item: any) => ({
        id: item.artifactId || item._additional?.id,
        text: item.content || item.title,
        score: item._additional?.score || item._additional?.certainty || 0,
        metadata: {
          title: item.title,
          type: item.type,
          phase: item.phase,
          createdBy: item.createdBy,
          tags: item.tags,
        },
      }));
    } catch (error: any) {
      logger.error('Weaviate hybrid search failed:', error);
      // Fallback to vector search
      return await this.vectorSearch(query, topK, filters);
    }
  }

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const result = await this.client!.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('meta { count }')
        .do();

      return (result.data?.Aggregate?.[this.className]?.[0]?.meta as any)?.count || 0;
    } catch (error: any) {
      logger.error('Failed to get document count from Weaviate:', error);
      return 0;
    }
  }

  /**
   * Clear all documents (use with caution!)
   */
  async clearAll(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Weaviate is not available');
    }

    try {
      await this.client!.batch
        .objectsBatchDeleter()
        .withClassName(this.className)
        .withWhere({
          operator: 'Like' as const,
          path: ['artifactId'],
          valueText: '*', // Match all
        })
        .do();

      logger.warn('⚠️  Cleared all documents from Weaviate');
    } catch (error: any) {
      logger.error('Failed to clear Weaviate:', error);
      throw error;
    }
  }
}

export const weaviateService = new WeaviateService();

