/**
 * API Key Encryption Service
 * Securely encrypts and decrypts API keys using AES-256-GCM
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

class ApiKeyEncryptionService {
  private encryptionKey: Buffer;

  constructor() {
    // Get encryption key from environment or use a fixed development key
    // CRITICAL: Changing this key will make all existing encrypted keys unreadable!
    const masterKey = process.env.API_KEY_ENCRYPTION_KEY;
    
    if (!masterKey) {
      // In production, this should ALWAYS be set via environment variable
      console.warn('⚠️  WARNING: API_KEY_ENCRYPTION_KEY not set in environment!');
      console.warn('   A derived key will be used, but encrypted keys will NOT persist across restarts.');
      console.warn('   Set API_KEY_ENCRYPTION_KEY in your .env file immediately.');
      const derivedFallback = crypto.randomBytes(32).toString('hex');
      this.encryptionKey = this.deriveKey(derivedFallback);
    } else {
      this.encryptionKey = this.deriveKey(masterKey);
    }
  }

  /**
   * Derive encryption key from master key using PBKDF2
   */
  private deriveKey(masterKey: string): Buffer {
    const salt = process.env.API_KEY_ENCRYPTION_SALT || crypto.randomBytes(16).toString('hex');
    return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');
  }

  /**
   * Encrypt an API key
   */
  encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
    if (!plaintext || plaintext.trim() === '') {
      throw new Error('Cannot encrypt empty API key');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt an API key
   */
  decrypt(encrypted: string, iv: string, tag: string): string {
    if (!encrypted || !iv || !tag) {
      throw new Error('Missing encryption parameters');
    }

    try {
      const ivBuffer = Buffer.from(iv, 'hex');
      const tagBuffer = Buffer.from(tag, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, ivBuffer);
      decipher.setAuthTag(tagBuffer);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Mask API key for display (show only last 4 characters)
   */
  maskKey(key: string): string {
    if (!key || key.length <= 4) {
      return '****';
    }
    return '•'.repeat(key.length - 4) + key.slice(-4);
  }

  /**
   * Validate API key format (basic validation)
   */
  validateKeyFormat(provider: string, key: string): { valid: boolean; error?: string } {
    if (!key || key.trim().length === 0) {
      return { valid: false, error: 'API key cannot be empty' };
    }

    // Provider-specific validation
    switch (provider) {
      case 'openai':
        if (!key.startsWith('sk-')) {
          return { valid: false, error: 'OpenAI API key should start with "sk-"' };
        }
        break;
      case 'anthropic':
        if (!key.startsWith('sk-ant-')) {
          return { valid: false, error: 'Anthropic API key should start with "sk-ant-"' };
        }
        break;
      case 'gemini':
        if (key.length < 30) {
          return { valid: false, error: 'Gemini API key appears to be invalid' };
        }
        break;
      case 'mistral':
        if (key.length < 20) {
          return { valid: false, error: 'Mistral API key appears to be invalid' };
        }
        break;
      // Add more validations as needed
    }

    return { valid: true };
  }
}

export const apiKeyEncryption = new ApiKeyEncryptionService();

