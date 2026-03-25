/**
 * Integration tests for Feature Flag Adapter
 * Tests the adapter layer with the actual exported functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeFeatureFlags,
  isAdapterInitialized,
  resetAdapter,
} from '../featureFlagAdapter';

describe('Feature Flag Adapter', () => {
  beforeEach(() => {
    resetAdapter();
  });

  describe('Initialization', () => {
    it('should initialize with custom provider', async () => {
      await initializeFeatureFlags({ providerType: 'custom' });
      expect(isAdapterInitialized()).toBe(true);
    });

    it('should not re-initialize if already initialized', async () => {
      await initializeFeatureFlags({ providerType: 'custom' });
      expect(isAdapterInitialized()).toBe(true);

      // Second call should be a no-op
      await initializeFeatureFlags({ providerType: 'custom' });
      expect(isAdapterInitialized()).toBe(true);
    });

    it('should initialize with flagsmith provider (falls back to custom)', async () => {
      await initializeFeatureFlags({ providerType: 'flagsmith' });
      expect(isAdapterInitialized()).toBe(true);
    });

    it('should initialize with hybrid provider (falls back to custom)', async () => {
      await initializeFeatureFlags({ providerType: 'hybrid' });
      expect(isAdapterInitialized()).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset adapter state', async () => {
      await initializeFeatureFlags({ providerType: 'custom' });
      expect(isAdapterInitialized()).toBe(true);

      resetAdapter();
      expect(isAdapterInitialized()).toBe(false);
    });
  });

  describe('State Checking', () => {
    it('should report not initialized before init', () => {
      expect(isAdapterInitialized()).toBe(false);
    });

    it('should report initialized after init', async () => {
      await initializeFeatureFlags({ providerType: 'custom' });
      expect(isAdapterInitialized()).toBe(true);
    });
  });
});
