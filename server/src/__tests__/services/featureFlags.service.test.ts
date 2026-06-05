/**
 * Feature Flags Service Tests
 *
 * The FeatureFlag model is mocked, so no DB is required. The source resolves
 * flags via `FeatureFlag.findOne({...}).lean()`, so the mock must return an
 * object exposing a `lean()` method.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isFeatureEnabled } from '../../services/featureFlags.service.js';
import { FeatureFlag } from '../../models/FeatureFlag.model.js';
import { logger } from '../../utils/logger.js';

// Mock the FeatureFlag model
vi.mock('../../models/FeatureFlag.model.js');
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper: make FeatureFlag.findOne(...).lean() resolve to `flag`.
function mockFindOneLean(flag: unknown) {
  vi.mocked(FeatureFlag.findOne).mockReturnValue({
    lean: vi.fn().mockResolvedValue(flag),
  } as any);
}

describe('FeatureFlags Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFeatureEnabled', () => {
    it('should return true when flag is active and role has access', async () => {
      mockFindOneLean({
        featureKey: 'test_feature',
        isActive: true,
        enabledEnvironments: [],
        enabledRoles: ['public'],
      });

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(true);
    });

    it('should return false when feature flag is inactive', async () => {
      mockFindOneLean({
        featureKey: 'test_feature',
        isActive: false,
      });

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(false);
    });

    it('should return true when feature flag does not exist (default behavior)', async () => {
      mockFindOneLean(null);

      const result = await isFeatureEnabled('non_existent_feature');
      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle errors gracefully and return true', async () => {
      vi.mocked(FeatureFlag.findOne).mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should normalize feature key to lowercase', async () => {
      mockFindOneLean({
        featureKey: 'test_feature',
        isActive: true,
        enabledRoles: ['public'],
      });

      await isFeatureEnabled('TEST_FEATURE');
      expect(FeatureFlag.findOne).toHaveBeenCalledWith({
        featureKey: 'test_feature',
      });
    });
  });
});
