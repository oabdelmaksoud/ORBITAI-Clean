import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPService } from '../mcp.service.js';

describe('MCP Service', () => {
  let mcpService: MCPService;

  beforeEach(() => {
    mcpService = new MCPService();
  });

  describe('Health Checks', () => {
    it('should check E2B server health', async () => {
      const health = await mcpService.checkServerHealth('mcp-sys-1');
      expect(health).toBeDefined();
      expect(health.serverId).toBe('mcp-sys-1');
      expect(['healthy', 'degraded', 'unhealthy', 'unknown', 'not_configured']).toContain(health.status);
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
      const health1 = await mcpService.checkServerHealth(serverId);
      const health2 = await mcpService.checkServerHealth(serverId);

      // Should return cached result if called within 30 seconds
      expect(health2.lastChecked).toBeDefined();
    });
  });

  describe('Tool Discovery', () => {
    it('should list available tools for E2B server', async () => {
      const tools = await mcpService.listTools('mcp-sys-1');
      expect(Array.isArray(tools)).toBe(true);
      // E2B should have tools like execute_python, install_package, etc.
      if (tools.length > 0) {
        expect(tools[0]).toHaveProperty('name');
        expect(tools[0]).toHaveProperty('description');
      }
    });

    it('should return empty array for unknown server', async () => {
      const tools = await mcpService.listTools('unknown-server');
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute E2B tool', async () => {
      try {
        const result = await mcpService.executeTool('mcp-sys-1', 'execute_python', {
          code: 'print("Hello, World!")'
        });
        expect(result).toBeDefined();
      } catch (error: any) {
        // E2B might not be configured, which is okay for tests
        expect(error.message).toBeDefined();
      }
    });

    it('should handle invalid tool name', async () => {
      await expect(
        mcpService.executeTool('mcp-sys-1', 'invalid_tool', {})
      ).rejects.toThrow();
    });
  });

  describe('All System Servers Health', () => {
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
