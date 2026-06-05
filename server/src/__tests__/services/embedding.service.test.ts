/**
 * Embedding Service Tests
 *
 * apiKeyProvider is mocked to report no provider keys, which forces the
 * deterministic hash-based fallback path — so these tests need no DB and no
 * external embedding API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from '../../services/embedding.service.js';

// Force the hash fallback (no DB, no external API) by reporting no keys.
vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    hasApiKey: vi.fn().mockResolvedValue(false),
    getApiKey: vi.fn().mockResolvedValue(null),
  },
}));

describe('Embedding Service', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
  });

  describe('generateEmbedding', () => {
    it('should generate a numeric embedding vector for text', async () => {
      const embedding = await service.generateEmbedding('Test text for embedding');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
      expect(typeof embedding[0]).toBe('number');
    });

    it('should throw for empty text', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
    });

    it('should fall back gracefully (resolve, not reject) when no provider key exists', async () => {
      // With no API keys the service uses the hash fallback and never rejects.
      const embedding = await service.generateEmbedding('fallback text');
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should produce deterministic embeddings for identical input', async () => {
      const a = await service.generateEmbedding('same input');
      const b = await service.generateEmbedding('same input');
      expect(a).toEqual(b);
    });
  });
});
