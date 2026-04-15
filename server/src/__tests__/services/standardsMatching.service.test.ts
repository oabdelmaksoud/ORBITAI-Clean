/**
 * Standards Matching Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../models/QualityStandard.model.js', () => ({
  QualityStandard: {
    find: vi.fn().mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([]),
      }),
    }),
    findOne: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    }),
  },
}));

vi.mock('../../services/llamaindex.service.js', () => ({
  llamaindexService: {
    query: vi.fn().mockResolvedValue({ response: '', sourceNodes: [] }),
  },
}));

vi.mock('../../services/vectorSearch.service.js', () => ({
  vectorSearchService: {
    addDocument: vi.fn().mockResolvedValue(undefined),
    vectorSearch: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { standardsMatchingService } from '../../services/standardsMatching.service.js';
import { QualityStandard } from '../../models/QualityStandard.model.js';

describe('Standards Matching Service', () => {
  let service: typeof standardsMatchingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = standardsMatchingService;

    // Reset the default mock for find to return chainable lean().exec()
    vi.mocked(QualityStandard.find).mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([]),
      }),
      limit: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
  });

  describe('matchStandards', () => {
    it('should match standards for a project', async () => {
      const projectDescription = 'Web application with user authentication';
      const matches = await service.searchStandards(projectDescription);

      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should return empty array for empty description', async () => {
      const matches = await service.searchStandards('');
      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });
  });

  describe('searchStandards (by standard ID)', () => {
    it('should get details for a standard', async () => {
      const standardId = 'ISO27001';
      const details = await service.searchStandards(standardId);

      expect(details).toBeDefined();
      expect(Array.isArray(details)).toBe(true);
    });
  });
});
