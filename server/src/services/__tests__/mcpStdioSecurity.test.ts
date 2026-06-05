import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertStdioCommandAllowed, buildAllowedStdioEnv } from '../mcp.service.js';

const SNAPSHOT = { ...process.env };

function resetEnv() {
  // Restore to a clean snapshot between tests so allowlists don't leak.
  for (const key of Object.keys(process.env)) {
    if (!(key in SNAPSHOT)) delete process.env[key];
  }
  Object.assign(process.env, SNAPSHOT);
}

describe('mcp stdio security', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  describe('assertStdioCommandAllowed', () => {
    it('default-denies when MCP_ALLOWED_STDIO_COMMANDS is unset', () => {
      delete process.env.MCP_ALLOWED_STDIO_COMMANDS;
      expect(() => assertStdioCommandAllowed('node')).toThrow(/disabled/i);
    });

    it('rejects a command not in the allowlist', () => {
      process.env.MCP_ALLOWED_STDIO_COMMANDS = 'node,uvx';
      expect(() => assertStdioCommandAllowed('rm')).toThrow(/not in the .* allowlist/i);
      expect(() => assertStdioCommandAllowed('/usr/bin/rm')).toThrow(/allowlist/i);
    });

    it('allows an exact basename match', () => {
      process.env.MCP_ALLOWED_STDIO_COMMANDS = 'node,uvx';
      expect(() => assertStdioCommandAllowed('node')).not.toThrow();
    });

    it('allows an absolute path whose basename is allowlisted', () => {
      process.env.MCP_ALLOWED_STDIO_COMMANDS = 'node';
      expect(() => assertStdioCommandAllowed('/usr/local/bin/node')).not.toThrow();
    });

    it('allows an exact absolute path allowlist entry', () => {
      process.env.MCP_ALLOWED_STDIO_COMMANDS = '/opt/tools/myserver';
      expect(() => assertStdioCommandAllowed('/opt/tools/myserver')).not.toThrow();
    });
  });

  describe('buildAllowedStdioEnv', () => {
    it('excludes a secret var that is not in the allowlist', () => {
      process.env.PATH = '/usr/bin';
      process.env.HOME = '/home/test';
      process.env.SUPER_SECRET_API_KEY = 'sk-leak-me-EXAMPLE';
      delete process.env.MCP_ALLOWED_ENV;

      const env = buildAllowedStdioEnv();

      expect(env.SUPER_SECRET_API_KEY).toBeUndefined();
      expect(env.PATH).toBe('/usr/bin');
      expect(env.HOME).toBe('/home/test');
    });

    it('includes only explicitly allowlisted vars beyond PATH/HOME', () => {
      process.env.PATH = '/usr/bin';
      process.env.HOME = '/home/test';
      process.env.MCP_FOO = 'foo-value';
      process.env.MCP_BAR = 'bar-value';
      process.env.OTHER_SECRET = 'should-not-pass';
      process.env.MCP_ALLOWED_ENV = 'MCP_FOO, MCP_BAR';

      const env = buildAllowedStdioEnv();

      expect(env.MCP_FOO).toBe('foo-value');
      expect(env.MCP_BAR).toBe('bar-value');
      expect(env.OTHER_SECRET).toBeUndefined();
    });

    it('never returns the full process.env', () => {
      process.env.PATH = '/usr/bin';
      process.env.RANDOM_ENV_KEY_XYZ = 'present-in-process-env';
      delete process.env.MCP_ALLOWED_ENV;

      const env = buildAllowedStdioEnv();

      expect(env.RANDOM_ENV_KEY_XYZ).toBeUndefined();
      expect(Object.keys(env).length).toBeLessThan(Object.keys(process.env).length);
    });
  });
});
