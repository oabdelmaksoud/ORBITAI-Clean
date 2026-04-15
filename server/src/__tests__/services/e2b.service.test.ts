/**
 * E2B Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { E2BService } from '../../services/e2b.service.js';

// Mock the apiKeyProvider service
const mockGetApiKey = vi.fn();
vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    getApiKey: (...args: any[]) => mockGetApiKey(...args),
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
    vi.clearAllMocks();
    mockGetApiKey.mockResolvedValue('test-api-key');
    service = new E2BService();
  });

  describe('constructor', () => {
    it('should initialize with API key from apiKeyProvider', async () => {
      const key = await service.getApiKey();
      expect(key).toBe('test-api-key');
      expect(mockGetApiKey).toHaveBeenCalledWith('e2b');
    });

    it('should be configured when API key exists', async () => {
      expect(await service.isConfigured()).toBe(true);
    });

    it('should not be configured when API key is missing', async () => {
      mockGetApiKey.mockResolvedValue(null);
      const unconfiguredService = new E2BService();
      expect(await unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('getApiKey', () => {
    it('should return the API key', async () => {
      const key = await service.getApiKey();
      expect(key).toBe('test-api-key');
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is present', async () => {
      expect(await service.isConfigured()).toBe(true);
    });

    it('should return false when API key is missing', async () => {
      mockGetApiKey.mockResolvedValue(null);
      const unconfiguredService = new E2BService();
      expect(await unconfiguredService.isConfigured()).toBe(false);
    });
  });
});
