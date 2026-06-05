/**
 * E2B Service Tests
 *
 * The E2B service resolves its API key asynchronously via apiKeyProvider
 * (DB-backed). These tests mock apiKeyProvider so no real DB or E2B sandbox
 * is required — they validate the service's key/configuration logic only.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { E2BService } from '../../services/e2b.service.js';
import { apiKeyProvider } from '../../services/apiKeyProvider.service.js';

// Mock apiKeyProvider (source of truth for the E2B key) to avoid DB access.
vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    getApiKey: vi.fn(),
  },
}));

// Mock E2B SDK so no real sandbox is spawned.
vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
  })),
}));

describe('E2B Service', () => {
  let service: E2BService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new E2BService();
  });

  describe('getApiKey', () => {
    it('should return the API key from apiKeyProvider', async () => {
      vi.mocked(apiKeyProvider.getApiKey).mockResolvedValue('test-api-key');
      await expect(service.getApiKey()).resolves.toBe('test-api-key');
    });

    it('should return null when no key is configured', async () => {
      vi.mocked(apiKeyProvider.getApiKey).mockResolvedValue(null);
      await expect(service.getApiKey()).resolves.toBeNull();
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is present', async () => {
      vi.mocked(apiKeyProvider.getApiKey).mockResolvedValue('test-api-key');
      await expect(service.isConfigured()).resolves.toBe(true);
    });

    it('should return false when API key is missing', async () => {
      vi.mocked(apiKeyProvider.getApiKey).mockResolvedValue('');
      await expect(service.isConfigured()).resolves.toBe(false);
    });

    it('should return false when API key is null', async () => {
      vi.mocked(apiKeyProvider.getApiKey).mockResolvedValue(null);
      await expect(service.isConfigured()).resolves.toBe(false);
    });
  });
});
