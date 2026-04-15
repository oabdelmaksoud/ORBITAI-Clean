/**
 * Embedding Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from '../../services/embedding.service.js';

// Mock apiKeyProvider
vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    hasApiKey: vi.fn().mockResolvedValue(false),
    getApiKey: vi.fn().mockResolvedValue(null),
  },
}));

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
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

    it('should throw for empty text', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
    });

    it('should generate embeddings for multiple texts individually', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const embeddings = await Promise.all(texts.map(t => service.generateEmbedding(t)));

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(texts.length);
      embeddings.forEach(e => {
        expect(Array.isArray(e)).toBe(true);
        expect(e.length).toBeGreaterThan(0);
      });
    });
  });
});
