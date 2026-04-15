/**
 * Vector Search Service
 * Provides vector search functionality for artifacts and documents
 * Uses Weaviate for production vector search, falls back to in-memory with embeddings
 */

import { logger } from '../utils/logger.js';
import { weaviateService } from './weaviate.service.js';
import { embeddingService } from './embedding.service.js';

interface Document {
  id: string;
  content: string;
  metadata?: {
    type?: string;
    title?: string;
    projectId?: string;
    userId?: string;
    phase?: string;
    [key: string]: any;
  };
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: any;
}

class VectorSearchService {
  private isInitialized = false;
  private documents: Map<string, Document> = new Map();
  private documentEmbeddings: Map<string, number[]> = new Map();

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Vector search service already initialized');
      return;
    }

    // Initialize Weaviate if available
    try {
      await weaviateService.initialize();
    } catch (error: unknown) {
      logger.warn('Weaviate initialization failed, using in-memory fallback:', error.message);
    }

    this.isInitialized = true;
    this.documents.clear();
    this.documentEmbeddings.clear();
    logger.info('Vector search service initialized');
  }

  async addDocument(doc: Document): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Generate embedding for the document
    const textToEmbed = `${doc.metadata?.title || ''} ${doc.content}`.substring(0, 8000);
    let embedding: number[];
    
    try {
      embedding = await embeddingService.generateEmbedding(textToEmbed);
      this.documentEmbeddings.set(doc.id, embedding);
    } catch (error: unknown) {
      logger.warn(`Failed to generate embedding for document ${doc.id}, using fallback:`, error.message);
      // Fallback: create a simple hash-based embedding
      embedding = this.createHashEmbedding(textToEmbed);
      this.documentEmbeddings.set(doc.id, embedding);
    }

    // Store document
    this.documents.set(doc.id, doc);

    // If Weaviate is available, also store there
    if (weaviateService.isAvailable()) {
      try {
        // Convert Document to Artifact format for Weaviate
        const artifact = {
          id: doc.id,
          title: doc.metadata?.title || doc.id,
          content: doc.content,
          type: doc.metadata?.type || 'document',
          phase: doc.metadata?.phase,
          createdBy: doc.metadata?.createdBy,
          tags: doc.metadata?.tags || [],
          embedding: embedding
        } as any;
        
        if (doc.metadata?.projectId) {
          (artifact as any).projectId = doc.metadata.projectId;
        }
        if (doc.metadata?.userId) {
          (artifact as any).userId = doc.metadata.userId;
        }

        await weaviateService.addArtifact(artifact);
      } catch (error: unknown) {
        logger.warn(`Failed to add document ${doc.id} to Weaviate:`, error.message);
        // Continue with in-memory storage
      }
    }

    logger.debug(`Added document to vector search: ${doc.id}`);
  }

  async vectorSearch(
    query: string, 
    limit: number = 5,
    filters?: {
      projectId?: string;
      userId?: string;
      type?: string;
      phase?: string;
    }
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try Weaviate first if available
    if (weaviateService.isAvailable()) {
      try {
        const weaviateResults = await weaviateService.vectorSearch(query, limit, filters);
        
        return weaviateResults.map(result => ({
          id: result.id,
          content: result.text,
          score: result.score,
          metadata: result.metadata
        }));
      } catch (error: unknown) {
        logger.warn('Weaviate vector search failed, falling back to in-memory:', error.message);
        // Fall through to in-memory search
      }
    }

    // Fallback to in-memory vector search with embeddings
    return this.inMemoryVectorSearch(query, limit, filters);
  }

  private async inMemoryVectorSearch(
    query: string,
    limit: number,
    filters?: {
      projectId?: string;
      userId?: string;
      type?: string;
      phase?: string;
    }
  ): Promise<SearchResult[]> {
    // Generate query embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embeddingService.generateEmbedding(query);
    } catch (error: unknown) {
      logger.warn('Failed to generate query embedding, using hash fallback:', error.message);
      queryEmbedding = this.createHashEmbedding(query);
    }

    const results: SearchResult[] = [];

    // Calculate cosine similarity for each document
    for (const [id, doc] of this.documents.entries()) {
      // Apply filters
      if (filters) {
        if (filters.projectId && doc.metadata?.projectId !== filters.projectId) continue;
        if (filters.userId && doc.metadata?.userId !== filters.userId) continue;
        if (filters.type && doc.metadata?.type !== filters.type) continue;
        if (filters.phase && doc.metadata?.phase !== filters.phase) continue;
      }

      const docEmbedding = this.documentEmbeddings.get(id);
      if (!docEmbedding) continue;

      // Calculate cosine similarity
      const score = this.cosineSimilarity(queryEmbedding, docEmbedding);

      if (score > 0.1) { // Minimum similarity threshold
        results.push({
          id: doc.id,
          content: doc.content.substring(0, 500),
          score,
          metadata: doc.metadata
        });
      }
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      logger.warn('Vector dimensions mismatch, using shorter length');
      const minLen = Math.min(vecA.length, vecB.length);
      vecA = vecA.slice(0, minLen);
      vecB = vecB.slice(0, minLen);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  private createHashEmbedding(text: string): number[] {
    const dimensions = embeddingService.getEmbeddingDimensions();
    const embedding: number[] = new Array(dimensions).fill(0);
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * (i + 1)) % dimensions;
      embedding[index] = (embedding[index] + charCode / 1000) % 1;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  async recallContext(query: string, limit: number = 3): Promise<string> {
    const results = await this.vectorSearch(query, limit);
    
    if (results.length === 0) {
      return 'No relevant context found.';
    }

    // Combine top results into context
    const context = results
      .map((result, index) => {
        const title = result.metadata?.title || result.id;
        return `[${index + 1}] ${title}:\n${result.content.substring(0, 300)}...`;
      })
      .join('\n\n');

    return context;
  }

  clear(): void {
    this.documents.clear();
    this.documentEmbeddings.clear();
    this.isInitialized = false;
    logger.info('Vector search service cleared');
  }
}

// Export singleton instance
export const vectorSearchService = new VectorSearchService();
