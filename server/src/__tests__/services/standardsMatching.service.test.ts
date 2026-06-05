/**
 * Standards Matching Service Tests
 *
 * The service exports a singleton (`standardsMatchingService`) — the class is not
 * exported. Its public surface is `findMatchingStandards` / `searchStandards`,
 * both of which need MongoDB (standards collection) and a RAG/embedding provider
 * (llamaindexService). When that infra is absent the suite skips, so it stays a
 * trustworthy signal in environments without external dependencies.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { standardsMatchingService } from '../../services/standardsMatching.service.js';
import type { ProjectContext } from '../../services/standardsMatching.service.js';
import { hasMongo, hasEmbeddingApi } from '../helpers/testEnv.js';

const hasInfra = hasMongo && hasEmbeddingApi;

describe.skipIf(!hasInfra)('Standards Matching Service', () => {
  beforeAll(async () => {
    await standardsMatchingService.initialize();
  });

  describe('findMatchingStandards', () => {
    it('returns a structured recommendation with match buckets', async () => {
      const context: ProjectContext = {
        name: 'Secure Web Portal',
        description: 'Web application with user authentication and payment handling',
        projectType: 'web',
        complexity: 'moderate',
      };

      const recommendation = await standardsMatchingService.findMatchingStandards(context, {
        maxResults: 5,
      });

      expect(recommendation).toBeDefined();
      expect(Array.isArray(recommendation.required)).toBe(true);
      expect(Array.isArray(recommendation.recommended)).toBe(true);
      expect(Array.isArray(recommendation.optional)).toBe(true);
      expect(Array.isArray(recommendation.allMatches)).toBe(true);
    });
  });

  describe('searchStandards', () => {
    it('returns an array of standard matches for a query', async () => {
      const matches = await standardsMatchingService.searchStandards('information security');
      expect(Array.isArray(matches)).toBe(true);
    });
  });
});
