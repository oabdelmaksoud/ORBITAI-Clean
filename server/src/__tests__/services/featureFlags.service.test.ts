/**
 * Feature Flags Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isFeatureEnabled } from '../../services/featureFlags.service.js';
import { FeatureFlag } from '../../models/FeatureFlag.model.js';
import { logger } from '../../utils/logger.js';

// Mock the FeatureFlag model with lean() chain support
vi.mock('../../models/FeatureFlag.model.js', () => ({
  FeatureFlag: {
    findOne: vi.fn(),
  },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FeatureFlags Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to mock findOne().lean() chain
  function mockFindOneResult(result: any) {
    vi.mocked(FeatureFlag.findOne).mockReturnValue({
      lean: () => Promise.resolve(result),
    } as any);
  }

  function mockFindOneError(error: Error) {
    vi.mocked(FeatureFlag.findOne).mockReturnValue({
      lean: () => Promise.reject(error),
    } as any);
  }

  describe('isFeatureEnabled', () => {
    it('should return true when feature flag is active', async () => {
      mockFindOneResult({ featureKey: 'test_feature', isActive: true, enabledRoles: ['public'] });

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(true);
    });

    it('should return false when feature flag is inactive', async () => {
      mockFindOneResult({ featureKey: 'test_feature', isActive: false });

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(false);
    });

    it('should return true when feature flag does not exist (default behavior)', async () => {
      mockFindOneResult(null);

      const result = await isFeatureEnabled('non_existent_feature');
      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle errors gracefully and return true', async () => {
      mockFindOneError(new Error('Database error'));

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should normalize feature key to lowercase', async () => {
      mockFindOneResult({ featureKey: 'test_feature', isActive: true, enabledRoles: ['public'] });

      await isFeatureEnabled('TEST_FEATURE');
      expect(FeatureFlag.findOne).toHaveBeenCalledWith({
        featureKey: 'test_feature',
      });
    });
  });
});


