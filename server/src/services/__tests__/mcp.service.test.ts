import { describe, it, expect, beforeEach } from 'vitest';
import { MCPService } from '../mcp.service.js';
import { hasMcpRuntime } from '../../__tests__/helpers/testEnv.js';

describe('MCP Service', () => {
  let mcpService: MCPService;

  beforeEach(() => {
    mcpService = new MCPService();
  });

  // Health checks spawn live MCP server processes / make outbound network calls.
  // Requires RUN_MCP_INFRA_TESTS=1 (see hasMcpRuntime) — skipped otherwise.
  describe.skipIf(!hasMcpRuntime)('Health Checks', () => {
    it('should check E2B server health', async () => {
      const health = await mcpService.checkServerHealth('mcp-sys-1');
      expect(health).toBeDefined();
      expect(health.serverId).toBe('mcp-sys-1');
      expect(['healthy', 'degraded', 'unhealthy', 'unknown', 'not_configured']).toContain(
        health.status
      );
    });

    it('should check knowledge graph server health', async () => {
      const health = await mcpService.checkServerHealth('mcp-sys-2');
      expect(health).toBeDefined();
      expect(health.serverId).toBe('mcp-sys-2');
    });

    it('should check Google Search server health', async () => {
      const health = await mcpService.checkServerHealth('mcp-sys-3');
      expect(health).toBeDefined();
      expect(health.serverId).toBe('mcp-sys-3');
    });

    it('should cache health check results', async () => {
      const serverId = 'mcp-sys-1';
      await mcpService.checkServerHealth(serverId);
      const health2 = await mcpService.checkServerHealth(serverId);

      // Should return cached result if called within 30 seconds
      expect(health2.lastChecked).toBeDefined();
    });
  });

  // Aggregates per-server health, so it has the same live-runtime requirement.
  describe.skipIf(!hasMcpRuntime)('All System Servers Health', () => {
    it('should check all system servers', async () => {
      const healthReports = await mcpService.checkAllSystemServersHealth();
      expect(Array.isArray(healthReports)).toBe(true);
      expect(healthReports.length).toBeGreaterThan(0);
      healthReports.forEach(report => {
        expect(report).toHaveProperty('serverId');
        expect(report).toHaveProperty('status');
        expect(report).toHaveProperty('tools');
      });
    });
  });
});
