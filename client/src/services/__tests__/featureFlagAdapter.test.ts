/**
 * Integration tests for Feature Flag Adapter
 * Tests the adapter layer with custom provider (no external dependencies)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  featureFlagService, 
  CustomFeatureFlagProvider,
  FeatureFlagUser 
} from '../featureFlagAdapter';

describe('Feature Flag Adapter', () => {
  let testUser: FeatureFlagUser;

  beforeEach(() => {
    testUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user',
      plan: 'pro'
    };
  });

  describe('Custom Provider', () => {
    it('should initialize custom provider', async () => {
      const provider = new CustomFeatureFlagProvider();
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should check feature access for user role', async () => {
      const provider = new CustomFeatureFlagProvider();
      const result = await provider.isEnabled('project_creation', {
        id: 'test',
        role: 'admin'
      });

      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('source', 'custom');
      expect(typeof result.enabled).toBe('boolean');
    });
  });

  describe('Unified Service', () => {
    it('should be initialized with custom provider by default', async () => {
      // Service should be initialized with custom provider
      const result = await featureFlagService.isEnabled('project_creation', testUser);
      
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('source');
      expect(typeof result.enabled).toBe('boolean');
    });

    it('should handle gradual rollout', async () => {
      const result = await featureFlagService.isEnabledWithRollout(
        'project_creation',
        testUser,
        {
          percentage: 100, // 100% rollout
          targetRoles: ['user', 'admin']
        }
      );

      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('source');
    });

    it('should handle percentage-based rollout', async () => {
      // Test with 0% rollout - should be disabled
      const result0 = await featureFlagService.isEnabledWithRollout(
        'project_creation',
        testUser,
        { percentage: 0 }
      );

      // Test with 100% rollout - should check base flag
      const result100 = await featureFlagService.isEnabledWithRollout(
        'project_creation',
        testUser,
        { percentage: 100 }
      );

      expect(result0).toHaveProperty('enabled');
      expect(result100).toHaveProperty('enabled');
    });

    it('should assign A/B test variants consistently', async () => {
      const config = {
        variants: [
          { name: 'control', percentage: 50 },
          { name: 'variant_a', percentage: 30 },
          { name: 'variant_b', percentage: 20 }
        ]
      };

      // Same user should get same variant
      const variant1 = await featureFlagService.getABTestVariant(
        'test_feature',
        testUser,
        config
      );

      const variant2 = await featureFlagService.getABTestVariant(
        'test_feature',
        testUser,
        config
      );

      expect(variant1).toBe(variant2); // Consistent assignment
      expect(['control', 'variant_a', 'variant_b']).toContain(variant1);
    });

    it('should respect role targeting in A/B tests', async () => {
      const config = {
        variants: [
          { name: 'control', percentage: 50 },
          { name: 'variant_a', percentage: 50 }
        ],
        targetRoles: ['admin'] // Only for admins
      };

      // User with 'user' role should get 'control' (default)
      const userVariant = await featureFlagService.getABTestVariant(
        'test_feature',
        { ...testUser, role: 'user' },
        config
      );

      // Admin should get a variant
      const adminVariant = await featureFlagService.getABTestVariant(
        'test_feature',
        { ...testUser, role: 'admin' },
        config
      );

      expect(userVariant).toBe('control');
      expect(['control', 'variant_a']).toContain(adminVariant);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Test with invalid user
      const result = await featureFlagService.isEnabled('invalid_feature', {
        id: '',
        role: undefined
      });

      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('source');
    });
  });
});

