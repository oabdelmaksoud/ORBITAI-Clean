/**
 * Feature Flags Service Tests
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

describe('FeatureFlags Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature flag is active', async () => {
      const mockFlag = {
        featureKey: 'test_feature',
        isActive: true,
      };

      vi.mocked(FeatureFlag.findOne).mockResolvedValue(mockFlag as any);

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(true);
    });

    it('should return false when feature flag is inactive', async () => {
      const mockFlag = {
        featureKey: 'test_feature',
        isActive: false,
      };

      vi.mocked(FeatureFlag.findOne).mockResolvedValue(mockFlag as any);

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(false);
    });

    it('should return true when feature flag does not exist (default behavior)', async () => {
      vi.mocked(FeatureFlag.findOne).mockResolvedValue(null);

      const result = await isFeatureEnabled('non_existent_feature');
      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle errors gracefully and return true', async () => {
      vi.mocked(FeatureFlag.findOne).mockRejectedValue(new Error('Database error'));

      const result = await isFeatureEnabled('test_feature');
      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should normalize feature key to lowercase', async () => {
      const mockFlag = {
        featureKey: 'test_feature',
        isActive: true,
      };

      vi.mocked(FeatureFlag.findOne).mockResolvedValue(mockFlag as any);

      await isFeatureEnabled('TEST_FEATURE');
      expect(FeatureFlag.findOne).toHaveBeenCalledWith({
        featureKey: 'test_feature',
      });
    });
  });
});


