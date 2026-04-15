/**
 * LlamaIndex-inspired Advanced RAG Service
 * Provides advanced Retrieval-Augmented Generation with multiple index types,
 * efficient chunking, and vector database integration
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
// Simple text splitter implementation (langchain text splitter not available in this version)
class SimpleTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options: { chunkSize: number; chunkOverlap: number; separators: string[] }) {
    this.chunkSize = options.chunkSize;
    this.chunkOverlap = options.chunkOverlap;
    this.separators = options.separators;
  }

  async splitText(text: string): Promise<string[]> {
    const chunks: string[] = [];
    let currentChunk = '';
    
    const splitBySeparator = (text: string, separator: string): string[] => {
      return text.split(separator).filter(part => part.trim().length > 0);
    };

    const parts = this.separators.reduce((acc, sep) => {
      return acc.flatMap(part => splitBySeparator(part, sep));
    }, [text]);

    for (const part of parts) {
      if (currentChunk.length + part.length <= this.chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + part;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          // Add overlap
          const overlap = currentChunk.slice(-this.chunkOverlap);
          currentChunk = overlap + ' ' + part;
        } else {
          // Part is too large, split it
          for (let i = 0; i < part.length; i += this.chunkSize - this.chunkOverlap) {
            chunks.push(part.slice(i, i + this.chunkSize));
          }
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
}
import { weaviateService } from './weaviate.service.js';
import { vectorSearchService } from './vectorSearch.service.js';
import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';

export interface RAGQuery {
  query: string;
  topK?: number;
  filters?: {
    projectId?: string;
    userId?: string;
    type?: string;
    phase?: string;
  };
  useHybridSearch?: boolean;
  rerank?: boolean;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  context: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface IndexConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  indexType?: 'vector' | 'keyword' | 'hybrid';
  embeddingModel?: string;
}

class LlamaIndexService {
  private llm: any = null;
  private textSplitter: SimpleTextSplitter;
  private initialized: boolean = false;

  constructor() {
    this.textSplitter = new SimpleTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  /**
   * Initialize the RAG service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize vector search
      await vectorSearchService.initialize();
      await weaviateService.initialize();

      // Initialize LLM based on config (using database-stored API keys)
      const openaiKey = await apiKeyProvider.getApiKey('openai');
      const geminiKey = await apiKeyProvider.getApiKey('gemini');
      
      if (openaiKey) {
        this.llm = new ChatOpenAI({
          modelName: 'gpt-4o',
          temperature: 0.7,
          openAIApiKey: openaiKey,
        });
      } else if (geminiKey) {
        this.llm = new ChatGoogleGenerativeAI({
          model: 'gemini-3-pro-preview',
          temperature: 0.7,
          apiKey: geminiKey,
        });
      } else {
        throw new Error('No LLM API key configured (OpenAI or Gemini required). Add API keys via Admin Console → Settings → API Keys');
      }

      this.initialized = true;
      logger.info('✅ LlamaIndex RAG service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize LlamaIndex service:', error);
      throw error;
    }
  }

  /**
   * Index documents with advanced chunking
   */
  async indexDocuments(
    documents: Array<{ id: string; content: string; metadata?: Record<string, any> }>,
    config: IndexConfig = {}
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const chunkSize = config.chunkSize || 1000;
    const chunkOverlap = config.chunkOverlap || 200;

    this.textSplitter = new SimpleTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', ' ', ''],
    });

    try {
      for (const doc of documents) {
        // Split document into chunks
        const chunks = await this.textSplitter.splitText(doc.content);

        // Index each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = `${doc.id}_chunk_${i}`;
          const chunkMetadata = {
            ...doc.metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
            originalId: doc.id,
          };

          await vectorSearchService.addDocument({
            id: chunkId,
            content: chunks[i],
            metadata: chunkMetadata,
          });
        }

        logger.debug(`Indexed document ${doc.id} with ${chunks.length} chunks`);
      }

      logger.info(`✅ Indexed ${documents.length} documents`);
    } catch (error: unknown) {
      logger.error('Failed to index documents:', error);
      throw error;
    }
  }

  /**
   * Perform advanced RAG query with retrieval and generation
   */
  async query(query: RAGQuery): Promise<RAGResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const topK = query.topK || 5;
      const useHybridSearch = query.useHybridSearch ?? true;

      // Retrieve relevant documents
      let sources: Array<{
        id: string;
        content: string;
        score: number;
        metadata?: Record<string, any>;
      }>;

      if (useHybridSearch && weaviateService.isAvailable()) {
        // Use Weaviate hybrid search
        const results = await weaviateService.hybridSearch(
          query.query,
          topK,
          query.filters
        );
        sources = results.map(r => ({
          id: r.id,
          content: r.text,
          score: r.score,
          metadata: r.metadata,
        }));
      } else {
        // Use vector search
        const results = await vectorSearchService.vectorSearch(
          query.query,
          topK,
          query.filters
        );
        sources = results.map(r => ({
          id: r.id,
          content: r.content,
          score: r.score,
          metadata: r.metadata,
        }));
      }

      // Rerank if requested (simple score-based reranking)
      if (query.rerank) {
        sources.sort((a, b) => b.score - a.score);
        sources = sources.slice(0, topK);
      }

      // Build context from retrieved sources
      const context = sources
        .map((source, index) => {
          const title = source.metadata?.title || source.id;
          return `[Source ${index + 1}] ${title}:\n${source.content.substring(0, 500)}`;
        })
        .join('\n\n');

      // Generate answer using LLM with context
      const prompt = `You are a helpful AI assistant. Answer the following question based on the provided context. If the context doesn't contain enough information, say so.

Context:
${context}

Question: ${query.query}

Answer:`;

      const response = await this.llm.invoke(prompt);
      const answer = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      return {
        answer,
        sources,
        context,
        tokensUsed: {
          prompt: 0, // LLM response doesn't always include token usage
          completion: 0,
          total: 0,
        },
      };
    } catch (error: unknown) {
      logger.error('RAG query failed:', error);
      throw new Error(`RAG query failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Perform streaming RAG query
   */
  async *queryStream(query: RAGQuery): AsyncGenerator<string, void, unknown> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Retrieve context (same as regular query)
      const topK = query.topK || 5;
      const useHybridSearch = query.useHybridSearch ?? true;

      let sources: Array<{
        id: string;
        content: string;
        score: number;
        metadata?: Record<string, any>;
      }>;

      if (useHybridSearch && weaviateService.isAvailable()) {
        const results = await weaviateService.hybridSearch(
          query.query,
          topK,
          query.filters
        );
        sources = results.map(r => ({
          id: r.id,
          content: r.text,
          score: r.score,
          metadata: r.metadata,
        }));
      } else {
        const results = await vectorSearchService.vectorSearch(
          query.query,
          topK,
          query.filters
        );
        sources = results.map(r => ({
          id: r.id,
          content: r.content,
          score: r.score,
          metadata: r.metadata,
        }));
      }

      const context = sources
        .map((source, index) => {
          const title = source.metadata?.title || source.id;
          return `[Source ${index + 1}] ${title}:\n${source.content.substring(0, 500)}`;
        })
        .join('\n\n');

      const prompt = `You are a helpful AI assistant. Answer the following question based on the provided context.

Context:
${context}

Question: ${query.query}

Answer:`;

      // Stream response
      const stream = await this.llm.stream(prompt);
      for await (const chunk of stream) {
        const content = typeof chunk.content === 'string' 
          ? chunk.content 
          : JSON.stringify(chunk.content);
        yield content;
      }
    } catch (error: unknown) {
      logger.error('Streaming RAG query failed:', error);
      throw new Error(`Streaming RAG query failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Delete indexed documents
   */
  async deleteDocuments(documentIds: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Delete from Weaviate if available
      if (weaviateService.isAvailable()) {
        for (const docId of documentIds) {
          try {
            await weaviateService.deleteArtifact(docId);
          } catch (error: unknown) {
            logger.warn(`Failed to delete ${docId} from Weaviate:`, (error instanceof Error ? error.message : String(error)));
          }
        }
      }

      logger.info(`✅ Deleted ${documentIds.length} documents`);
    } catch (error: unknown) {
      logger.error('Failed to delete documents:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    vectorStore: 'weaviate' | 'in-memory';
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let totalDocuments = 0;
      if (weaviateService.isAvailable()) {
        totalDocuments = await weaviateService.getDocumentCount();
      }

      return {
        totalDocuments,
        totalChunks: totalDocuments, // Approximate
        vectorStore: weaviateService.isAvailable() ? 'weaviate' : 'in-memory',
      };
    } catch (error: unknown) {
      logger.error('Failed to get index stats:', error);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        vectorStore: 'in-memory',
      };
    }
  }
}

export const llamaindexService = new LlamaIndexService();

