/**
 * Embedding Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from '../../services/embedding.service.js';
import { config } from '../../config/env.js';

// Mock config
vi.mock('../../config/env.js', () => ({
  config: {
    geminiApiKey: 'test-gemini-key',
  },
}));

// Mock Google GenAI
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: vi.fn().mockResolvedValue({
        embedding: {
          values: Array(768).fill(0.1),
        },
      }),
    },
  })),
}));

describe('Embedding Service', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const text = 'Test text for embedding';
      const embedding = await service.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should handle empty text', async () => {
      const embedding = await service.generateEmbedding('');
      expect(embedding).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // Mock error scenario
      vi.mocked(config).geminiApiKey = '';

      await expect(service.generateEmbedding('test')).rejects.toThrow();
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const embeddings = await service.generateEmbeddings(texts);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(texts.length);
    });
  });
});
