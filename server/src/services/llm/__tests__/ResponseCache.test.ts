/**
 * ResponseCache Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { responseCache } from '../ResponseCache.js';

// Helper to build a standard cached entry
function storeEntry(
  prompt = 'What is TypeScript?',
  modelId = 'gemini-2.5-flash',
  response = 'TypeScript is a typed superset of JavaScript.',
  cost = 0.000123,
  provider = 'gemini',
  systemInstruction?: string
) {
  responseCache.set(
    prompt,
    modelId,
    response,
    { input: 100, output: 50, total: 150 },
    cost,
    provider,
    systemInstruction,
  );
}

describe('ResponseCache', () => {
  beforeEach(() => {
    responseCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Cache Miss ──────────────────────────────────────────────────────────────

  describe('cache miss', () => {
    it('returns null for a prompt that has never been cached', () => {
      const result = responseCache.get('unknown prompt', 'any-model');
      expect(result).toBeNull();
    });

    it('increments misses stat on cache miss', () => {
      responseCache.get('never-stored', 'model-x');
      expect(responseCache.getStats().misses).toBe(1);
    });

    it('returns null when queried with a different model ID', () => {
      storeEntry('Hello', 'model-a');
      const result = responseCache.get('Hello', 'model-b');
      expect(result).toBeNull();
    });

    it('returns null when queried with different system instruction', () => {
      storeEntry('Hello', 'model-a', 'response', 0.001, 'gemini', 'Be concise');
      const result = responseCache.get('Hello', 'model-a', 'Be verbose');
      expect(result).toBeNull();
    });
  });

  // ─── Cache Hit ───────────────────────────────────────────────────────────────

  describe('cache hit', () => {
    it('returns the stored response on a hit', () => {
      storeEntry('What is TS?', 'gemini-flash', 'TypeScript is great', 0.0005);
      const result = responseCache.get('What is TS?', 'gemini-flash');
      expect(result).not.toBeNull();
      expect(result!.response).toBe('TypeScript is great');
    });

    it('returns correct metadata: modelId, provider, cost, tokens', () => {
      storeEntry('Hello', 'model-x', 'Hi!', 0.001, 'openai');
      const result = responseCache.get('Hello', 'model-x');
      expect(result!.modelId).toBe('model-x');
      expect(result!.provider).toBe('openai');
      expect(result!.cost).toBe(0.001);
      expect(result!.tokens).toEqual({ input: 100, output: 50, total: 150 });
    });

    it('increments hitCount on each retrieval', () => {
      storeEntry('prompt', 'model-1');
      responseCache.get('prompt', 'model-1');
      responseCache.get('prompt', 'model-1');
      const result = responseCache.get('prompt', 'model-1');
      expect(result!.hitCount).toBe(3);
    });

    it('increments hits stat on cache hit', () => {
      storeEntry('key', 'mod');
      responseCache.get('key', 'mod');
      responseCache.get('key', 'mod');
      expect(responseCache.getStats().hits).toBe(2);
    });

    it('is case-insensitive and trims prompt for key generation', () => {
      storeEntry('  Hello World  ', 'model-z', 'stored answer');
      const result = responseCache.get('hello world', 'model-z');
      expect(result).not.toBeNull();
      expect(result!.response).toBe('stored answer');
    });
  });

  // ─── TTL / Expiration ────────────────────────────────────────────────────────

  describe('TTL expiration', () => {
    it('returns null after the entry has expired', async () => {
      // Manually store an entry with an old timestamp
      storeEntry('expiring prompt', 'model-ttl');

      // Reach into the cache map and backdate the timestamp
      const cacheMap: Map<string, any> = (responseCache as any).cache;
      const [key, entry] = Array.from(cacheMap.entries()).at(-1)!;
      entry.timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      cacheMap.set(key, entry);

      const result = responseCache.get('expiring prompt', 'model-ttl');
      expect(result).toBeNull();
    });

    it('increments evictions stat on expired entry retrieval', () => {
      storeEntry('old prompt', 'model-ttl');
      const cacheMap: Map<string, any> = (responseCache as any).cache;
      const [key, entry] = Array.from(cacheMap.entries()).at(-1)!;
      entry.timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000);
      cacheMap.set(key, entry);

      responseCache.get('old prompt', 'model-ttl');
      expect(responseCache.getStats().evictions).toBe(1);
    });

    it('removes expired entry during cleanup()', () => {
      storeEntry('stale', 'model-c');
      const cacheMap: Map<string, any> = (responseCache as any).cache;
      const [key, entry] = Array.from(cacheMap.entries()).at(-1)!;
      entry.timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000);
      cacheMap.set(key, entry);

      responseCache.cleanup();
      expect(responseCache.size()).toBe(0);
    });
  });

  // ─── Key Generation Consistency ─────────────────────────────────────────────

  describe('key generation consistency', () => {
    it('produces the same cache key for identical inputs', () => {
      storeEntry('same prompt', 'same-model', 'resp1', 0.001, 'gemini', 'system');
      const result1 = responseCache.get('same prompt', 'same-model', 'system');
      const result2 = responseCache.get('same prompt', 'same-model', 'system');
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });

    it('stores and retrieves with context object included in key', () => {
      responseCache.set(
        'ctx prompt',
        'model-ctx',
        'ctx response',
        { input: 10, output: 10, total: 20 },
        0.0001,
        'gemini',
        undefined,
        { projectId: 'proj-1' },
      );
      const hit = responseCache.get('ctx prompt', 'model-ctx', undefined, { projectId: 'proj-1' });
      const miss = responseCache.get('ctx prompt', 'model-ctx', undefined, { projectId: 'proj-2' });
      expect(hit).not.toBeNull();
      expect(miss).toBeNull();
    });
  });

  // ─── Size & Eviction ─────────────────────────────────────────────────────────

  describe('size and eviction', () => {
    it('size() returns the current number of entries', () => {
      expect(responseCache.size()).toBe(0);
      storeEntry('p1', 'm1');
      storeEntry('p2', 'm2');
      expect(responseCache.size()).toBe(2);
    });

    it('evicts oldest entry when maxSize is reached', () => {
      // Fill cache beyond maxSize via options
      const maxSize = 3;
      for (let i = 0; i < maxSize + 1; i++) {
        responseCache.set(
          `prompt-${i}`,
          'model-evict',
          `response-${i}`,
          { input: 10, output: 10, total: 20 },
          0.0001,
          'gemini',
          undefined,
          undefined,
          { maxSize },
        );
      }
      expect(responseCache.size()).toBe(maxSize);
    });
  });

  // ─── Stats ───────────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('returns zero stats on a fresh cache', () => {
      const stats = responseCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.estimatedSavings).toBe(0);
    });

    it('calculates hitRate correctly', () => {
      storeEntry('s1', 'mod');
      responseCache.get('s1', 'mod'); // hit
      responseCache.get('missing', 'mod'); // miss
      const stats = responseCache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it('accumulates estimatedSavings on cache hits', () => {
      storeEntry('cost-prompt', 'model-savings', 'resp', 0.01);
      responseCache.get('cost-prompt', 'model-savings');
      responseCache.get('cost-prompt', 'model-savings');
      const stats = responseCache.getStats();
      expect(stats.estimatedSavings).toBeCloseTo(0.02);
    });
  });

  // ─── clear() ─────────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes all entries and resets stats', () => {
      storeEntry('a', 'b');
      storeEntry('c', 'd');
      responseCache.get('a', 'b');
      responseCache.clear();

      const stats = responseCache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
