/**
 * Embedding Service - Generates embeddings for text using various providers
 */

import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';

export class EmbeddingService {
  private embeddingProvider: 'openai' | 'gemini' | 'hash';
  private embeddingModel: string;

  constructor() {
    // Initialize with hash fallback - will be determined dynamically
    this.embeddingProvider = 'hash';
    this.embeddingModel = 'hash';
  }

  /**
   * Initialize embedding provider from database (async)
   */
  async initialize(): Promise<void> {
    const hasOpenAI = await apiKeyProvider.hasApiKey('openai');
    const hasGemini = await apiKeyProvider.hasApiKey('gemini');
    
    if (hasOpenAI) {
      this.embeddingProvider = 'openai';
      this.embeddingModel = 'text-embedding-3-small';
    } else if (hasGemini) {
      this.embeddingProvider = 'gemini';
      this.embeddingModel = 'text-embedding-004';
    } else {
      this.embeddingProvider = 'hash';
      logger.warn('No embedding API keys configured in database. Using hash-based fallback. Add keys via Admin Console → Settings → API Keys');
    }
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Initialize provider if not already done
    if (this.embeddingProvider === 'hash') {
      await this.initialize();
    }

    switch (this.embeddingProvider) {
      case 'openai':
        return this.generateOpenAIEmbedding(text);
      case 'gemini':
        return this.generateGeminiEmbedding(text);
      case 'hash':
        return this.generateHashEmbedding(text);
      default:
        return this.generateHashEmbedding(text);
    }
  }

  /**
   * Generate embedding using OpenAI
   */
  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    try {
      const apiKey = await apiKeyProvider.getApiKey('openai');
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Add it via Admin Console → Settings → API Keys');
      }
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'OpenAI API error' }));
        throw new Error(error.message || 'Failed to generate OpenAI embedding');
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error: any) {
      logger.error('OpenAI embedding generation failed:', error);
      // Fallback to hash-based embedding
      return this.generateHashEmbedding(text);
    }
  }

  /**
   * Generate embedding using Gemini
   */
  private async generateGeminiEmbedding(text: string): Promise<number[]> {
    try {
      const apiKey = await apiKeyProvider.getApiKey('gemini');
      if (!apiKey) {
        throw new Error('Gemini API key not configured. Add it via Admin Console → Settings → API Keys');
      }
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const result = await ai.models.embedContent({
        model: this.embeddingModel,
        contents: [{ parts: [{ text }] }]
      });

      return result.embeddings?.[0]?.values || [];
    } catch (error: any) {
      logger.error('Gemini embedding generation failed:', error);
      // Fallback to hash-based embedding
      return this.generateHashEmbedding(text);
    }
  }

  /**
   * Generate hash-based embedding (fallback when no API keys available)
   * This is a simple hash-based approach - not semantic, but provides consistent vectors
   */
  private generateHashEmbedding(text: string): number[] {
    // Simple hash-based embedding (1536 dimensions to match OpenAI)
    const dimensions = 1536;
    const embedding: number[] = new Array(dimensions).fill(0);
    
    // Simple hash function to distribute values
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

  /**
   * Get embedding dimensions
   */
  getEmbeddingDimensions(): number {
    switch (this.embeddingProvider) {
      case 'openai':
        return 1536; // text-embedding-3-small
      case 'gemini':
        return 768; // text-embedding-004
      case 'hash':
        return 1536; // Match OpenAI dimensions
      default:
        return 1536;
    }
  }
}

export const embeddingService = new EmbeddingService();
