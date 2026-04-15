/**
 * LangChain Service
 * Provides chain orchestration, prompt management, and tool integration
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
// MemoryVectorStore not available in this version, using alternative approach
// import { MemoryVectorStore } from '@langchain/community/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import { weaviateService } from './weaviate.service.js';
import { embeddingService } from './embedding.service.js';
import { vectorSearchService } from './vectorSearch.service.js';
import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';

export interface ChainConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  memory?: boolean;
  tools?: any[];
}

export interface ChainInput {
  input: string;
  context?: Record<string, any>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChainOutput {
  output: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  metadata?: Record<string, any>;
}

class LangChainService {
  private llm: any = null;
  private embeddings: any = null;
  private vectorStore: any = null; // MemoryVectorStore not available
  private initialized: boolean = false;

  /**
   * Initialize LangChain service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize LLM (using database-stored API keys)
      const openaiKey = await apiKeyProvider.getApiKey('openai');
      const geminiKey = await apiKeyProvider.getApiKey('gemini');

      if (openaiKey) {
        this.llm = new ChatOpenAI({
          modelName: 'gpt-4o',
          temperature: 0.7,
          openAIApiKey: openaiKey,
        });
        this.embeddings = new OpenAIEmbeddings({
          openAIApiKey: openaiKey,
        });
      } else if (geminiKey) {
        this.llm = new ChatGoogleGenerativeAI({
          modelName: 'gemini-3-pro-preview',
          temperature: 0.7,
          apiKey: geminiKey,
        });
        this.embeddings = new GoogleGenerativeAIEmbeddings({
          modelName: 'models/embedding-001',
          apiKey: geminiKey,
        });
      } else {
        throw new Error('No LLM API key configured. Add API keys via Admin Console → Settings → API Keys');
      }

      // MemoryVectorStore not available, using weaviateService or vectorSearchService instead
      // this.vectorStore = await MemoryVectorStore.fromDocuments([], this.embeddings);
      this.vectorStore = null;

      this.initialized = true;
      logger.info('✅ LangChain service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize LangChain service:', error);
      throw error;
    }
  }

  /**
   * Create a simple chain
   */
  async createChain(chainConfig: ChainConfig = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const systemPrompt = chainConfig.systemPrompt || 'You are a helpful AI assistant.';
    const temperature = chainConfig.temperature ?? 0.7;

    // Create LLM instance with config (using database-stored API keys)
    const openaiKey = await apiKeyProvider.getApiKey('openai');
    const geminiKey = await apiKeyProvider.getApiKey('gemini');
    let chainLLM: any;

    if (openaiKey) {
      chainLLM = new ChatOpenAI({
        modelName: chainConfig.model || 'gpt-4o',
        temperature,
        maxTokens: chainConfig.maxTokens,
        openAIApiKey: openaiKey,
      });
    } else if (geminiKey) {
      chainLLM = new ChatGoogleGenerativeAI({
        modelName: chainConfig.model || 'gemini-3-pro-preview',
        temperature,
        apiKey: geminiKey,
      });
    } else {
      throw new Error('No LLM API key configured. Add API keys via Admin Console → Settings → API Keys');
    }

    // Create prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);

    // Create chain
    const chain = RunnableSequence.from([
      {
        input: (x: ChainInput) => x.input,
        history: (x: ChainInput) => {
          if (!x.history) return [];
          return x.history.map(msg => {
            if (msg.role === 'user') {
              return new HumanMessage(msg.content);
            } else {
              return new AIMessage(msg.content);
            }
          });
        },
      },
      prompt,
      chainLLM,
    ]);

    return chain;
  }

  /**
   * Run a chain with input
   */
  async runChain(chain: any, input: ChainInput): Promise<ChainOutput> {
    try {
      const response = await chain.invoke(input);

      const output = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      return {
        output,
        tokensUsed: {
          prompt: 0,
          completion: 0,
          total: 0,
        },
      };
    } catch (error: unknown) {
      logger.error('Chain execution failed:', error);
      throw new Error(`Chain execution failed: ${error.message}`);
    }
  }

  /**
   * Create a RAG chain with retrieval
   */
  async createRAGChain(chainConfig: ChainConfig = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const systemPrompt = chainConfig.systemPrompt || 'You are a helpful AI assistant. Answer questions based on the provided context.';

    const openaiKey = await apiKeyProvider.getApiKey('openai');
    const geminiKey = await apiKeyProvider.getApiKey('gemini');
    let chainLLM: any;

    if (openaiKey) {
      chainLLM = new ChatOpenAI({
        modelName: chainConfig.model || 'gpt-4o',
        temperature: chainConfig.temperature ?? 0.7,
        openAIApiKey: openaiKey,
      });
    } else if (geminiKey) {
      chainLLM = new ChatGoogleGenerativeAI({
        modelName: chainConfig.model || 'gemini-3-pro-preview',
        temperature: chainConfig.temperature ?? 0.7,
        apiKey: geminiKey,
      });
    } else {
      throw new Error('No LLM API key configured. Add API keys via Admin Console → Settings → API Keys');
    }

    // Create RAG chain with retrieval
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt + '\n\nContext: {context}'],
      ['human', '{input}'],
    ]);

    const ragChain = RunnableSequence.from([
      {
        input: (x: ChainInput) => x.input,
        context: async (x: ChainInput) => {
          // Retrieve relevant context
          if (weaviateService.isAvailable()) {
            const results = await weaviateService.vectorSearch(x.input, 3);
            return results.map(r => r.text).join('\n\n');
          } else {
            // Use vectorSearchService as fallback
            const results = await vectorSearchService.vectorSearch(x.input, 3);
            return results.map(r => r.content).join('\n\n');
          }
          return '';
        },
      },
      prompt,
      chainLLM,
    ]);

    return ragChain;
  }

  /**
   * Add documents to vector store
   */
  async addDocuments(documents: Array<{ content: string; metadata?: Record<string, any> }>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const docs = documents.map(doc => new Document({
        pageContent: doc.content,
        metadata: doc.metadata || {},
      }));

      // Use vectorSearchService instead of MemoryVectorStore
      for (const doc of docs) {
        await vectorSearchService.addDocument({
          id: doc.metadata?.id || Math.random().toString(36),
          content: doc.pageContent,
          metadata: doc.metadata || {},
        });
      }
      logger.debug(`Added ${documents.length} documents to vector search service`);
    } catch (error: unknown) {
      logger.error('Failed to add documents:', error);
      throw error;
    }
  }

  /**
   * Create a sequential chain (multiple steps)
   */
  async createSequentialChain(steps: Array<{ name: string; prompt: string }>, chainConfig: ChainConfig = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const openaiKey = await apiKeyProvider.getApiKey('openai');
    const geminiKey = await apiKeyProvider.getApiKey('gemini');
    let chainLLM: any;

    if (openaiKey) {
      chainLLM = new ChatOpenAI({
        modelName: chainConfig.model || 'gpt-4o',
        temperature: chainConfig.temperature ?? 0.7,
        openAIApiKey: openaiKey,
      });
    } else if (geminiKey) {
      chainLLM = new ChatGoogleGenerativeAI({
        modelName: chainConfig.model || 'gemini-3-pro-preview',
        temperature: chainConfig.temperature ?? 0.7,
        apiKey: geminiKey,
      });
    } else {
      throw new Error('No LLM API key configured. Add API keys via Admin Console → Settings → API Keys');
    }

    // Build sequential chain
    const chains = steps.map((step, index) => {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', step.prompt],
        ['human', index === 0 ? '{input}' : `{step${index - 1}}`],
      ]);

      return RunnableSequence.from([prompt, chainLLM]);
    });

    // Chain them together
    let sequentialChain = chains[0];
    for (let i = 1; i < chains.length; i++) {
      sequentialChain = sequentialChain.pipe(chains[i]);
    }

    return sequentialChain;
  }

  /**
   * Stream chain output
   */
  async *streamChain(chain: any, input: ChainInput): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await chain.stream(input);

      for await (const chunk of stream) {
        const content = typeof chunk.content === 'string'
          ? chunk.content
          : JSON.stringify(chunk.content);
        yield content;
      }
    } catch (error: unknown) {
      logger.error('Chain streaming failed:', error);
      throw new Error(`Chain streaming failed: ${error.message}`);
    }
  }
}

export const langchainService = new LangChainService();
