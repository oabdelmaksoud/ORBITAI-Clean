import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, REDACTED } from '../secretCrypto.js';

const ORIGINAL_KEY = process.env.MCP_SECRET_KEY;
const ORIGINAL_ENC = process.env.ENCRYPTION_KEY;

describe('secretCrypto', () => {
  beforeEach(() => {
    process.env.MCP_SECRET_KEY = 'test-master-key-EXAMPLE-do-not-use';
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.MCP_SECRET_KEY;
    else process.env.MCP_SECRET_KEY = ORIGINAL_KEY;
    if (ORIGINAL_ENC === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = ORIGINAL_ENC;
  });

  it('round-trips encrypt -> decrypt', () => {
    const plaintext = 'sk-test-EXAMPLE1234567890';
    const enc = encrypt(plaintext);

    expect(enc).not.toBe(plaintext);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(isEncrypted(enc)).toBe(true);
    expect(decrypt(enc)).toBe(plaintext);
  });

  it('produces the enc:v1:<iv>:<tag>:<ciphertext> 5-part envelope', () => {
    const enc = encrypt('some-secret');
    expect(enc.split(':')).toHaveLength(5);
    expect(enc.split(':').slice(0, 2).join(':')).toBe('enc:v1');
  });

  it('does not double-encrypt an already encrypted value', () => {
    const enc1 = encrypt('hello');
    const enc2 = encrypt(enc1);
    expect(enc2).toBe(enc1);
    expect(decrypt(enc2)).toBe('hello');
  });

  it('passes plaintext through decrypt when it lacks the enc:v1: prefix (back-compat)', () => {
    expect(decrypt('legacy-plaintext-key')).toBe('legacy-plaintext-key');
    expect(isEncrypted('legacy-plaintext-key')).toBe(false);
  });

  it('returns plaintext unchanged when no key is configured (warn-and-passthrough)', () => {
    delete process.env.MCP_SECRET_KEY;
    delete process.env.ENCRYPTION_KEY;
    const out = encrypt('no-key-secret');
    expect(out).toBe('no-key-secret');
    expect(isEncrypted(out)).toBe(false);
  });

  it('falls back to ENCRYPTION_KEY when MCP_SECRET_KEY is absent', () => {
    delete process.env.MCP_SECRET_KEY;
    process.env.ENCRYPTION_KEY = 'fallback-key-EXAMPLE';
    const enc = encrypt('via-fallback');
    expect(isEncrypted(enc)).toBe(true);
    expect(decrypt(enc)).toBe('via-fallback');
  });

  it('handles empty / nullish values without throwing', () => {
    expect(encrypt('')).toBe('');
    expect(encrypt(undefined)).toBe('');
    expect(encrypt(null)).toBe('');
    expect(decrypt('')).toBe('');
    expect(decrypt(undefined)).toBe('');
  });

  it('exposes a redaction marker', () => {
    expect(REDACTED).toBe('***');
  });
});
