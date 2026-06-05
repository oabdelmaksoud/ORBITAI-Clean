/**
 * API Key Management Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
// The service exports a singleton (the class itself is not exported), and the
// ApiKey model is mocked below, so no real DB is required.
import { apiKeyManagement } from '../../services/apiKeyManagement.service.js';
import { ApiKey } from '../../models/ApiKey.model.js';

// Mock dependencies
vi.mock('../../models/ApiKey.model.js');
vi.mock('../../services/apiKeyEncryption.service.js', () => ({
  apiKeyEncryption: {
    validateKeyFormat: vi.fn(() => ({ valid: true })),
    encrypt: vi.fn(() => ({
      encrypted: 'encrypted_value',
      iv: 'iv_value',
      tag: 'tag_value',
    })),
    decrypt: vi.fn((encrypted: string) => encrypted.replace('encrypted_', '')),
    maskKey: vi.fn((key: string) => `****${key.slice(-4)}`),
  },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('API Key Management Service', () => {
  const service = apiKeyManagement;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      const input = {
        provider: 'openai' as const,
        keyName: 'Test Key',
        value: 'sk-test-key',
      };
      const userId = 'user123';

      const mockApiKey = {
        _id: 'key123',
        provider: 'openai',
        keyName: 'Test Key',
        encryptedValue: 'encrypted_value:tag_value',
        iv: 'iv_value',
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(ApiKey.findOne).mockResolvedValue(null);
      // mockImplementation must be usable with `new` — use a function, not an arrow.
      vi.mocked(ApiKey).mockImplementation(function () {
        return mockApiKey as any;
      });

      const result = await service.createApiKey(input, userId);

      expect(result).toBeDefined();
      expect(mockApiKey.save).toHaveBeenCalled();
    });

    it('should validate key format before creating', async () => {
      const { apiKeyEncryption } = await import('../../services/apiKeyEncryption.service.js');
      vi.mocked(apiKeyEncryption.validateKeyFormat).mockReturnValue({
        valid: false,
        error: 'Invalid key format',
      });

      const input = {
        provider: 'openai' as const,
        keyName: 'Test Key',
        value: 'invalid-key',
      };

      await expect(service.createApiKey(input, 'user123')).rejects.toThrow('Invalid key format');
    });
  });

  describe('getAllApiKeys', () => {
    it('should retrieve all API keys', async () => {
      const mockKeys = [
        {
          _id: 'key1',
          provider: 'openai',
          keyName: 'Key 1',
          encryptedValue: 'encrypted_value:tag',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Source uses ApiKey.find(query).sort(...) — no .populate().
      vi.mocked(ApiKey.find).mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockKeys),
      } as any);

      const keys = await service.getAllApiKeys();
      expect(keys).toBeDefined();
      expect(Array.isArray(keys)).toBe(true);
    });
  });
});
