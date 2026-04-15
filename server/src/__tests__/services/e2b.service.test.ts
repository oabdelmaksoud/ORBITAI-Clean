/**
 * E2B Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { E2BService } from '../../services/e2b.service.js';
import { config } from '../../config/env.js';

// Mock the config
vi.mock('../../config/env.js', () => ({
  config: {
    e2bApiKey: 'test-api-key',
  },
}));

// Mock E2B SDK
vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
  })),
}));

describe('E2B Service', () => {
  let service: E2BService;

  beforeEach(() => {
    service = new E2BService();
  });

  describe('constructor', () => {
    it('should initialize with API key from config', () => {
      expect(service.getApiKey()).toBe('test-api-key');
    });

    it('should be configured when API key exists', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should not be configured when API key is missing', () => {
      vi.mocked(config).e2bApiKey = '';
      const unconfiguredService = new E2BService();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('getApiKey', () => {
    it('should return the API key', () => {
      expect(service.getApiKey()).toBe('test-api-key');
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      vi.mocked(config).e2bApiKey = '';
      const unconfiguredService = new E2BService();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });
});
