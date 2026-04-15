/**
 * User API Key Encryption Service
 * Encrypts/decrypts user API keys using AES-256-GCM encryption
 * Uses a dedicated encryption key (USER_API_KEY_ENCRYPTION_KEY env var),
 * falling back to JWT secret for backward compatibility.
 */

import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

class UserApiKeyEncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16; // 128 bits
  // @ts-ignore TS6133
  private readonly _SALT_LENGTH = 64; // 512 bits
  // @ts-ignore TS6133
  private readonly _TAG_LENGTH = 16; // 128 bits
  private readonly KEY_LENGTH = 32; // 256 bits
  private encryptionKeyWarningLogged = false;

  /**
   * Get the encryption secret, preferring a dedicated env var over jwtSecret
   */
  private getEncryptionSecret(): string {
    const dedicatedKey = process.env.USER_API_KEY_ENCRYPTION_KEY;
    if (dedicatedKey && dedicatedKey.trim().length > 0) {
      return dedicatedKey;
    }

    // Fall back to jwtSecret for backward compatibility, but warn
    if (!this.encryptionKeyWarningLogged) {
      logger.warn(
        'USER_API_KEY_ENCRYPTION_KEY is not set. Falling back to JWT secret for API key encryption. ' +
          'Set USER_API_KEY_ENCRYPTION_KEY to a dedicated secret to decouple API key encryption from JWT authentication.'
      );
      this.encryptionKeyWarningLogged = true;
    }
    return config.jwtSecret;
  }

  /**
   * Derive encryption key from user ID and encryption secret
   */
  private deriveKey(userId: string): Buffer {
    const encryptionSecret = this.getEncryptionSecret();
    const salt = crypto.createHash('sha256').update(`${userId}:${encryptionSecret}`).digest();

    return crypto.pbkdf2Sync(
      encryptionSecret,
      salt,
      100000, // iterations
      this.KEY_LENGTH,
      'sha512'
    );
  }

  /**
   * Encrypt an API key for a specific user
   */
  encryptApiKey(userId: string, apiKey: string): string {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }

    if (!userId || userId.trim().length === 0) {
      throw new Error('User ID is required for encryption');
    }

    try {
      const key = this.deriveKey(userId);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Combine IV, tag, and encrypted data
      const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;

      return combined;
    } catch (error: unknown) {
      logger.error(`Failed to encrypt API key for user ${userId}:`, error);
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Decrypt an API key for a specific user
   */
  decryptApiKey(userId: string, encryptedApiKey: string): string {
    if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
      throw new Error('Encrypted API key cannot be empty');
    }

    if (!userId || userId.trim().length === 0) {
      throw new Error('User ID is required for decryption');
    }

    try {
      const parts = encryptedApiKey.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted API key format');
      }

      const [ivHex, tagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const key = this.deriveKey(userId);

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: unknown) {
      logger.error(`Failed to decrypt API key for user ${userId}:`, error);
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate API key format (basic validation)
   */
  validateApiKeyFormat(provider: string, apiKey: string): { valid: boolean; error?: string } {
    if (!apiKey || apiKey.trim().length === 0) {
      return { valid: false, error: 'API key cannot be empty' };
    }

    // Basic format validation per provider
    const validations: { [key: string]: RegExp } = {
      openai: /^sk-[a-zA-Z0-9]{32,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-]{95,}$/,
      deepseek: /^sk-[a-zA-Z0-9]{32,}$/,
      grok: /^xai-[a-zA-Z0-9-]{64,}$/,
      mistral: /^[a-zA-Z0-9]{32,}$/,
      qwen: /^[a-zA-Z0-9]{32,}$/,
      groq: /^gsk_[a-zA-Z0-9]{32,}$/,
      openrouter: /^sk-or-[a-zA-Z0-9-]{32,}$/,
      gemini: /^AIza[0-9A-Za-z-_]{35}$/,
      ollama: /^.*$/, // Ollama doesn't use API keys
      vllm: /^.*$/, // vLLM doesn't use API keys
      openai_compatible: /^.*$/, // OpenAI-compatible may or may not use keys
    };

    const validation = validations[provider.toLowerCase()];
    if (validation && !validation.test(apiKey)) {
      return {
        valid: false,
        error: `Invalid API key format for ${provider}. Please check your API key.`,
      };
    }

    return { valid: true };
  }

  /**
   * Test if an API key is valid by making a test request
   * This is a placeholder - actual validation should be done via provider-specific test endpoints
   */
  async testApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
    // Basic format validation first
    const formatCheck = this.validateApiKeyFormat(provider, apiKey);
    if (!formatCheck.valid) {
      return formatCheck;
    }

    // For local LLMs, we don't validate API keys
    if (['ollama', 'vllm', 'openai_compatible'].includes(provider.toLowerCase())) {
      return { valid: true };
    }

    // Actual API key testing should be done via provider-specific services
    // This is just a format check
    return { valid: true };
  }
}

export const userApiKeyEncryption = new UserApiKeyEncryptionService();
