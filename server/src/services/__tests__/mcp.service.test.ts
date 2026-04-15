import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all external service dependencies that MCPService dynamically imports
vi.mock('../e2b.service.js', () => ({
  e2bService: {
    isConfigured: vi.fn().mockResolvedValue(false),
    getSandbox: vi.fn().mockRejectedValue(new Error('E2B not configured')),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    listDir: vi.fn(),
    runCommand: vi.fn(),
  },
}));

vi.mock('../apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    hasApiKey: vi.fn().mockResolvedValue(false),
    getApiKey: vi.fn().mockResolvedValue(null),
    getGoogleSearchEngineId: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../vectorSearch.service.js', () => ({
  vectorSearchService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    vectorSearch: vi.fn().mockRejectedValue(new Error('Not initialized')),
    recallContext: vi.fn().mockRejectedValue(new Error('Not initialized')),
  },
}));

vi.mock('../weaviate.service.js', () => ({
  weaviateService: {
    isAvailable: vi.fn().mockReturnValue(false),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../config/env.js', () => ({
  config: {
    weaviateUrl: '',
    jwtSecret: 'test-jwt-secret-key-for-testing-only',
    jwtExpiresIn: '7d',
  },
}));

vi.mock('../../models/MCPServer.model.js', () => ({
  MCPServer: {
    findOne: vi.fn().mockResolvedValue(null),
  },
}));

const { MCPService } = await import('../mcp.service.js');

describe('MCP Service', () => {
  let mcpService: MCPService;

  beforeEach(() => {
    mcpService = new MCPService();
    vi.clearAllMocks();
  });

  describe('Health Checks', () => {
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
      expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(health.status);
    });

    it('should check Google Search server health', async () => {
      const health = await mcpService.checkServerHealth('mcp-sys-3');
      expect(health).toBeDefined();
      expect(health.serverId).toBe('mcp-sys-3');
      expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(health.status);
    });

    it('should cache health check results', async () => {
      const serverId = 'mcp-sys-1';
      const health1 = await mcpService.checkServerHealth(serverId);
      const health2 = await mcpService.checkServerHealth(serverId);

      // Should return cached result if called within 30 seconds
      expect(health2.lastChecked).toBeDefined();
      // Both calls should return the same lastChecked time (from cache)
      expect(health1.lastChecked?.getTime()).toBe(health2.lastChecked?.getTime());
    });
  });

  describe('Tool Discovery', () => {
    it('should list available tools for E2B system server', async () => {
      const serverConfig = {
        id: 'mcp-sys-1',
        name: 'E2B Sandbox',
        description: 'E2B Sandbox tools',
        status: 'active',
        source: 'system',
        tools: [],
      };

      const toolsByServer = await mcpService.getAllTools([serverConfig as any]);
      const tools = toolsByServer.get('mcp-sys-1');

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      if (tools && tools.length > 0) {
        expect(tools[0]).toHaveProperty('name');
        expect(tools[0]).toHaveProperty('description');
      }
    });

    it('should return empty map for inactive servers', async () => {
      const serverConfig = {
        id: 'unknown-server',
        name: 'Unknown',
        status: 'inactive',
        source: 'system',
        tools: [],
      };

      const toolsByServer = await mcpService.getAllTools([serverConfig as any]);
      // Inactive servers should be filtered out
      expect(toolsByServer.size).toBe(0);
    });
  });

  describe('Tool Execution', () => {
    it('should call E2B tool via callTool', async () => {
      // E2B is not configured in test, so should throw
      await expect(
        mcpService.callTool('mcp-sys-1', 'execute_python', {
          code: 'print("Hello, World!")',
        })
      ).rejects.toThrow();
    });

    it('should throw for unknown server', async () => {
      await expect(
        mcpService.callTool('unknown-server-id', 'some_tool', {})
      ).rejects.toThrow('Unknown MCP server');
    });
  });

  describe('All System Servers Health', () => {
    it('should check all system servers', async () => {
      const healthReports = await mcpService.checkAllSystemServersHealth();
      expect(Array.isArray(healthReports)).toBe(true);
      expect(healthReports.length).toBe(3); // mcp-sys-1, mcp-sys-2, mcp-sys-3
      healthReports.forEach((report) => {
        expect(report).toHaveProperty('serverId');
        expect(report).toHaveProperty('status');
        expect(report).toHaveProperty('tools');
      });
    });
  });
});
