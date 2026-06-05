/**
 * secretCrypto — AES-256-GCM encryption helpers for secrets at rest.
 *
 * Format: `enc:v1:<iv b64>:<tag b64>:<ciphertext b64>`
 *
 * The 32-byte key is derived (SHA-256) from `process.env.MCP_SECRET_KEY`
 * (falling back to `process.env.ENCRYPTION_KEY`). If no key is configured,
 * `encrypt` returns the plaintext unchanged (warn-and-passthrough) so the
 * application does not crash — but encryption is strongly preferred.
 *
 * `decrypt` passes through any value that lacks the `enc:v1:` prefix, keeping
 * backward compatibility with previously-stored plaintext secrets.
 */

import crypto from 'crypto';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12; // 96-bit IV is the GCM standard
const KEY_LENGTH = 32; // 256 bits

let warnedMissingKey = false;

/**
 * Resolve the configured master key, if any.
 */
function getMasterKey(): string | undefined {
  return process.env.MCP_SECRET_KEY || process.env.ENCRYPTION_KEY || undefined;
}

/**
 * Derive a deterministic 32-byte key from the configured master key.
 */
function deriveKey(masterKey: string): Buffer {
  return crypto.createHash('sha256').update(masterKey, 'utf8').digest();
}

/**
 * True when a value is already in the `enc:v1:` envelope.
 */
export function isEncrypted(value: string): boolean {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) {
    return false;
  }
  // enc:v1:<iv>:<tag>:<ciphertext> → exactly 5 colon-separated parts.
  // base64 standard alphabet (A-Za-z0-9+/=) contains no ':' so this is safe.
  return value.split(':').length === 5;
}

/**
 * Encrypt a plaintext secret into the `enc:v1:` envelope.
 *
 * - Empty/undefined input is returned unchanged.
 * - Already-encrypted input is returned unchanged (no double-encryption).
 * - When no master key is configured, the plaintext is returned unchanged
 *   and a one-time warning is logged.
 */
export function encrypt(plaintext: string | undefined | null): string {
  if (plaintext === undefined || plaintext === null || plaintext === '') {
    return plaintext ?? '';
  }
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  const masterKey = getMasterKey();
  if (!masterKey) {
    if (!warnedMissingKey) {
      logger.warn(
        '[secretCrypto] No MCP_SECRET_KEY/ENCRYPTION_KEY configured — storing secret in PLAINTEXT. Set MCP_SECRET_KEY to enable encryption at rest.'
      );
      warnedMissingKey = true;
    }
    return plaintext;
  }

  const key = deriveKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypt an `enc:v1:` envelope back to plaintext.
 *
 * - Values without the `enc:v1:` prefix are returned unchanged (back-compat).
 * - When no master key is configured but the value IS encrypted, the original
 *   ciphertext envelope is returned (cannot decrypt) and a warning is logged.
 */
export function decrypt(value: string | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return value ?? '';
  }
  if (!isEncrypted(value)) {
    return value; // plaintext passthrough (back-compat)
  }

  const masterKey = getMasterKey();
  if (!masterKey) {
    logger.warn(
      '[secretCrypto] Encountered encrypted secret but no MCP_SECRET_KEY/ENCRYPTION_KEY configured — cannot decrypt.'
    );
    return value;
  }

  const parts = value.slice(PREFIX.length).split(':');
  const [ivB64, tagB64, ciphertextB64] = parts;

  const key = deriveKey(masterKey);
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  if (iv.length !== IV_LENGTH || key.length !== KEY_LENGTH) {
    throw new Error('[secretCrypto] Invalid IV or key length during decryption');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Redaction marker used when serializing secrets to clients.
 */
export const REDACTED = '***';
