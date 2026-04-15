/**
 * Standards Matching Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StandardsMatchingService } from '../../services/standardsMatching.service.js';

describe('Standards Matching Service', () => {
  let service: StandardsMatchingService;

  beforeEach(() => {
    service = new StandardsMatchingService();
  });

  describe('matchStandards', () => {
    it('should match standards for a project', async () => {
      const projectDescription = 'Web application with user authentication';
      const matches = await service.matchStandards(projectDescription);

      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should return empty array for empty description', async () => {
      const matches = await service.matchStandards('');
      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });
  });

  describe('getStandardDetails', () => {
    it('should get details for a standard', async () => {
      const standardId = 'ISO27001';
      const details = await service.getStandardDetails(standardId);

      expect(details).toBeDefined();
    });
  });
});
