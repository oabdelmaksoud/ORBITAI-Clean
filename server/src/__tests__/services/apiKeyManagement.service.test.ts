/**
 * API Key Management Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiKeyManagement } from '../../services/apiKeyManagement.service.js';
import { ApiKey } from '../../models/ApiKey.model.js';

// Mock dependencies
vi.mock('../../models/ApiKey.model.js', () => {
  const saveFn = vi.fn().mockResolvedValue(true);
  class MockApiKey {
    static findOne = vi.fn();
    static find = vi.fn();
    static deleteOne = vi.fn();
    static __mockSave = saveFn;

    _id = { toString: () => 'key123' };
    provider: string;
    keyName: string;
    encryptedValue: string;
    iv: string;
    tag: string;
    isActive = true;
    createdAt = new Date();
    updatedAt = new Date();
    save = saveFn;
    metadata: any;

    constructor(data: any) {
      this.provider = data.provider;
      this.keyName = data.keyName;
      this.encryptedValue = data.encryptedValue;
      this.iv = data.iv;
      this.tag = data.tag;
      this.metadata = data.metadata;
    }
  }
  return { ApiKey: MockApiKey };
});
vi.mock('../../services/apiKeyEncryption.service.js', () => ({
  apiKeyEncryption: {
    validateKeyFormat: vi.fn(() => ({ valid: true })),
    encrypt: vi.fn(() => ({
      encrypted: 'encrypted_value',
      iv: 'iv_value',
      tag: 'tag_value',
    })),
    decrypt: vi.fn((encrypted: string) => encrypted.replace('encrypted_', '')),
    maskKey: vi.fn((key: string) => '••••••••'),
  },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('API Key Management Service', () => {
  let service: typeof apiKeyManagement;

  beforeEach(() => {
    service = apiKeyManagement;
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

      vi.mocked(ApiKey.findOne).mockResolvedValue(null);

      const result = await service.createApiKey(input, userId);

      expect(result).toBeDefined();
      expect((ApiKey as any).__mockSave).toHaveBeenCalled();
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

  describe('getApiKeys', () => {
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

      vi.mocked(ApiKey.find).mockReturnValue({
        sort: vi.fn().mockResolvedValue(
          mockKeys.map(k => ({
            ...k,
            _id: { toString: () => k._id },
          }))
        ),
      } as any);

      const keys = await service.getAllApiKeys();
      expect(keys).toBeDefined();
      expect(Array.isArray(keys)).toBe(true);
    });
  });
});
