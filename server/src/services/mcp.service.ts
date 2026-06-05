/**
 * MCP Service - Handles MCP tool discovery and execution
 */

import { MCPServer } from '../../../types.js';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Build the minimal environment passed to spawned stdio MCP processes.
 *
 * NEVER pass the full `process.env` — that leaks every secret into the child.
 * We pass only PATH + HOME plus any variable names explicitly listed in the
 * comma-separated `MCP_ALLOWED_ENV` env var.
 */
export function buildAllowedStdioEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const key of ['PATH', 'HOME']) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  const allowed = (process.env.MCP_ALLOWED_ENV || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const key of allowed) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

/**
 * Reject any stdio command not present in the `MCP_ALLOWED_STDIO_COMMANDS`
 * allowlist (comma-separated absolute paths or basenames). If the env var is
 * unset/empty, stdio execution is DEFAULT-DENIED — it must be opt-in.
 *
 * @throws Error when the command is not allowlisted.
 */
export function assertStdioCommandAllowed(command: string): void {
  const raw = (process.env.MCP_ALLOWED_STDIO_COMMANDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (raw.length === 0) {
    throw new Error(
      'stdio MCP execution is disabled: set MCP_ALLOWED_STDIO_COMMANDS to an allowlist of permitted commands to enable it.'
    );
  }

  if (!command || typeof command !== 'string') {
    throw new Error('stdio MCP command is missing or invalid');
  }

  const commandBasename = path.basename(command);
  const isAllowed = raw.some(
    entry =>
      entry === command || entry === commandBasename || path.basename(entry) === commandBasename
  );

  if (!isAllowed) {
    throw new Error(
      `stdio MCP command "${command}" is not in the MCP_ALLOWED_STDIO_COMMANDS allowlist`
    );
  }
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPServerHealth {
  serverId: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  tools: number;
  message?: string;
  lastChecked?: Date;
  configStatus?: {
    apiKeyConfigured: boolean;
    serviceAvailable: boolean;
  };
}

export class MCPService {
  private healthCache: Map<string, MCPServerHealth> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Check health of a specific MCP server
   */
  async checkServerHealth(serverId: string): Promise<MCPServerHealth> {
    const cached = this.healthCache.get(serverId);
    if (cached && cached.lastChecked) {
      const age = Date.now() - cached.lastChecked.getTime();
      // Use cached result if less than 30 seconds old
      if (age < 30000) {
        return cached;
      }
    }

    let health: MCPServerHealth = {
      serverId,
      name: 'Unknown',
      status: 'unknown',
      tools: 0,
      lastChecked: new Date(),
    };

    try {
      if (serverId === 'mcp-sys-1' || serverId.startsWith('e2b-')) {
        health = await this.checkE2BHealth(serverId);
      } else if (serverId === 'mcp-sys-2' || serverId.startsWith('knowledge-')) {
        health = await this.checkKnowledgeGraphHealth(serverId);
      } else if (serverId === 'mcp-sys-3' || serverId.startsWith('google-')) {
        health = await this.checkGoogleSearchHealth(serverId);
      } else {
        // User-created servers - load from database and check health
        try {
          const { MCPServer: MCPServerModel } = await import('../models/MCPServer.model.js');
          const dbServer = await MCPServerModel.findOne({ id: serverId });

          if (dbServer) {
            health = await this.checkUserServerHealth(serverId, dbServer);
          } else {
            health = {
              serverId,
              name: 'Unknown Server',
              status: 'unhealthy',
              tools: 0,
              message: 'MCP server not found in database',
              lastChecked: new Date(),
            };
          }
        } catch (error: unknown) {
          health = {
            serverId,
            name: 'User Server',
            status: 'unhealthy',
            tools: 0,
            message: `Health check failed: ${error.message}`,
            lastChecked: new Date(),
          };
        }
      }
    } catch (error: unknown) {
      health = {
        serverId,
        name: 'Unknown',
        status: 'unhealthy',
        tools: 0,
        message: `Health check failed: ${error.message}`,
        lastChecked: new Date(),
      };
    }

    this.healthCache.set(serverId, health);
    return health;
  }

  /**
   * Check E2B Sandbox health
   */
  private async checkE2BHealth(serverId: string): Promise<MCPServerHealth> {
    const { e2bService } = await import('./e2b.service.js');
    const { apiKeyProvider } = await import('./apiKeyProvider.service.js');

    // Check database first, then environment variable
    const apiKeyConfigured = await apiKeyProvider.hasApiKey('e2b');
    const serviceAvailable = await e2bService.isConfigured();

    if (!apiKeyConfigured) {
      return {
        serverId,
        name: 'E2B Sandbox',
        status: 'not_configured', // Changed from 'unhealthy' to 'not_configured' - this is optional, not an error
        tools: 4,
        message:
          'E2B_API_KEY not configured. Add it via Admin Console or set E2B_API_KEY environment variable to enable E2B tools. (Optional - other features work without it)',
        lastChecked: new Date(),
        configStatus: {
          apiKeyConfigured: false,
          serviceAvailable: false,
        },
      };
    }

    // Try to verify E2B service is actually working
    try {
      // Quick test: try to get sandbox (this will fail if API key is invalid)
      await e2bService.getSandbox();
      return {
        serverId,
        name: 'E2B Sandbox',
        status: 'healthy',
        tools: 4,
        message: 'E2B Sandbox is operational',
        lastChecked: new Date(),
        configStatus: {
          apiKeyConfigured: true,
          serviceAvailable: true,
        },
      };
    } catch (error: unknown) {
      return {
        serverId,
        name: 'E2B Sandbox',
        status: 'unhealthy',
        tools: 4,
        message: `E2B service error: ${error.message}. Please verify E2B_API_KEY is valid.`,
        lastChecked: new Date(),
        configStatus: {
          apiKeyConfigured: true,
          serviceAvailable: false,
        },
      };
    }
  }

  /**
   * Check Knowledge Graph health
   */
  private async checkKnowledgeGraphHealth(serverId: string): Promise<MCPServerHealth> {
    const { vectorSearchService } = await import('./vectorSearch.service.js');
    const { weaviateService } = await import('./weaviate.service.js');
    const { config } = await import('../config/env.js');

    // Check if Weaviate is available (URL configured and service is connected)
    // For local instances, API key is optional
    const weaviateUrlConfigured = !!config.weaviateUrl;
    const weaviateAvailable = weaviateService.isAvailable();
    const weaviateHealthy = weaviateUrlConfigured && weaviateAvailable;

    try {
      // Initialize vector search service to check if it's working
      await vectorSearchService.initialize();

      // Re-check Weaviate availability after initialization
      await weaviateService.initialize();
      const weaviateNowAvailable = weaviateService.isAvailable();
      const weaviateNowHealthy = weaviateUrlConfigured && weaviateNowAvailable;

      // Try a simple search to verify functionality
      try {
        await vectorSearchService.vectorSearch('test', 1);
        return {
          serverId,
          name: 'Knowledge Graph',
          status: weaviateNowHealthy ? 'healthy' : 'degraded',
          tools: 2,
          message: weaviateNowHealthy
            ? 'Knowledge Graph is operational (Weaviate connected)'
            : weaviateUrlConfigured && !weaviateNowAvailable
              ? 'Knowledge Graph is operational (Weaviate URL configured but not connected - using in-memory fallback)'
              : 'Knowledge Graph is operational (using in-memory storage - works fine, data resets on server restart)',
          lastChecked: new Date(),
          configStatus: {
            apiKeyConfigured: weaviateNowHealthy,
            serviceAvailable: true,
          },
        };
      } catch (searchError: any) {
        return {
          serverId,
          name: 'Knowledge Graph',
          status: 'degraded',
          tools: 2,
          message: `Vector search available but may have limitations: ${searchError.message}`,
          lastChecked: new Date(),
          configStatus: {
            apiKeyConfigured: weaviateHealthy,
            serviceAvailable: true,
          },
        };
      }
    } catch (error: unknown) {
      return {
        serverId,
        name: 'Knowledge Graph',
        status: 'unhealthy',
        tools: 2,
        message: `Knowledge Graph initialization failed: ${error.message}`,
        lastChecked: new Date(),
        configStatus: {
          apiKeyConfigured: weaviateHealthy,
          serviceAvailable: false,
        },
      };
    }
  }

  /**
   * Check Google Search health
   */
  private async checkGoogleSearchHealth(serverId: string): Promise<MCPServerHealth> {
    const { apiKeyProvider } = await import('./apiKeyProvider.service.js');

    const geminiConfigured = await apiKeyProvider.hasApiKey('gemini');
    const engineId = await apiKeyProvider.getGoogleSearchEngineId();
    const customSearchConfigured = (await apiKeyProvider.hasApiKey('google_search')) && !!engineId;

    if (geminiConfigured) {
      return {
        serverId,
        name: 'Google Search',
        status: 'healthy',
        tools: 1,
        message: 'Google Search available via Gemini native grounding (useInternet: true)',
        lastChecked: new Date(),
        configStatus: {
          apiKeyConfigured: true,
          serviceAvailable: true,
        },
      };
    }

    if (customSearchConfigured) {
      // Test the Custom Search API
      try {
        const apiKey = await apiKeyProvider.getApiKey('google_search');
        const testUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=test&num=1`;
        const response = await fetch(testUrl);

        if (response.ok) {
          return {
            serverId,
            name: 'Google Search',
            status: 'healthy',
            tools: 1,
            message: 'Google Search available via Custom Search API',
            lastChecked: new Date(),
            configStatus: {
              apiKeyConfigured: true,
              serviceAvailable: true,
            },
          };
        } else {
          return {
            serverId,
            name: 'Google Search',
            status: 'unhealthy',
            tools: 1,
            message: `Google Custom Search API error: ${response.statusText}. Please verify GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID.`,
            lastChecked: new Date(),
            configStatus: {
              apiKeyConfigured: true,
              serviceAvailable: false,
            },
          };
        }
      } catch (error: unknown) {
        return {
          serverId,
          name: 'Google Search',
          status: 'unhealthy',
          tools: 1,
          message: `Google Custom Search API test failed: ${error.message}`,
          lastChecked: new Date(),
          configStatus: {
            apiKeyConfigured: true,
            serviceAvailable: false,
          },
        };
      }
    }

    return {
      serverId,
      name: 'Google Search',
      status: 'unhealthy',
      tools: 1,
      message:
        'Google Search is not configured. To enable web search: 1) Set GEMINI_API_KEY for native grounding (recommended), or 2) Set GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID for Custom Search API. Get Google Search API key at: https://console.cloud.google.com/apis/credentials',
      lastChecked: new Date(),
      configStatus: {
        apiKeyConfigured: false,
        serviceAvailable: false,
      },
    };
  }

  /**
   * Check health of all system MCP servers
   */
  async checkAllSystemServersHealth(): Promise<MCPServerHealth[]> {
    const systemServers = ['mcp-sys-1', 'mcp-sys-2', 'mcp-sys-3'];
    const healthChecks = await Promise.allSettled(
      systemServers.map(id => this.checkServerHealth(id))
    );

    return healthChecks.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          serverId: systemServers[index],
          name: 'Unknown',
          status: 'unhealthy' as const,
          tools: 0,
          message: `Health check failed: ${result.reason?.message || 'Unknown error'}`,
          lastChecked: new Date(),
        };
      }
    });
  }

  /**
   * Start periodic health checks (optional)
   */
  startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllSystemServersHealth();
    }, intervalMs);

    logger.info(`[MCPService] Started periodic health checks (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('[MCPService] Stopped periodic health checks');
    }
  }

  /**
   * Get all tools from active MCP servers
   * Returns a Map of serverId -> tools array
   */
  async getAllTools(servers: MCPServer[]): Promise<Map<string, MCPTool[]>> {
    const toolsByServer = new Map<string, MCPTool[]>();

    const activeServers = servers.filter(s => s.status === 'active');

    for (const server of activeServers) {
      try {
        const tools = await this.getServerTools(server);
        toolsByServer.set(server.id, tools);
      } catch (error) {
        logger.warn(`Failed to get tools from server ${server.id}:`, error);
        // Continue with other servers even if one fails
        toolsByServer.set(server.id, []);
      }
    }

    return toolsByServer;
  }

  /**
   * Get tools from a specific server
   */
  private async getServerTools(server: MCPServer): Promise<MCPTool[]> {
    // For system servers, return predefined tools based on server ID
    if (server.source === 'system') {
      return this.getSystemServerTools(server);
    }

    // For user-created or agent-created servers, load from database
    if (server.source === 'user' || server.source === 'agent') {
      try {
        const { MCPServer: MCPServerModel } = await import('../models/MCPServer.model.js');
        const dbServer = await MCPServerModel.findOne({ id: server.id });

        if (!dbServer) {
          logger.warn(`MCP server not found in database: ${server.id}`);
          return [];
        }

        // If server has tools defined, return them
        if (dbServer.tools && dbServer.tools.length > 0) {
          // For E2B servers, return predefined tools
          if (dbServer.config.type === 'e2b') {
            return this.getSystemServerTools({
              id: 'mcp-sys-1',
              name: 'E2B Sandbox',
              description: 'E2B Sandbox tools',
              status: 'active',
              source: 'system',
              tools: [],
            });
          }

          // For other server types, construct tool definitions from stored tools
          // This is a simplified version - in production, tools would be stored with full schemas
          return dbServer.tools.map(toolName => ({
            name: toolName,
            description: `Tool: ${toolName}`,
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          }));
        }

        // If no tools defined, try to discover them based on server type
        if (dbServer.config.type === 'e2b') {
          return this.getSystemServerTools({
            id: 'mcp-sys-1',
            name: 'E2B Sandbox',
            description: 'E2B Sandbox tools',
            status: 'active',
            source: 'system',
            tools: [],
          });
        }

        logger.warn(`No tools available for MCP server: ${server.id}`);
        return [];
      } catch (error: unknown) {
        logger.error(`Failed to load MCP server tools from database: ${server.id}`, error);
        return [];
      }
    }

    logger.warn(`Unknown MCP server source: ${server.source}`);
    return [];
  }

  /**
   * Get tools for system servers
   */
  private getSystemServerTools(server: MCPServer): MCPTool[] {
    const tools: MCPTool[] = [];

    // E2B Sandbox tools
    if (server.id === 'mcp-sys-1' || server.name === 'E2B Sandbox') {
      tools.push(
        {
          name: 'write_file',
          description: 'Write content to a file in the E2B sandbox',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'File content' },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'read_file',
          description: 'Read content from a file in the E2B sandbox',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
          },
        },
        {
          name: 'list_directory',
          description: 'List files and directories in the E2B sandbox',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path', default: '/' },
            },
          },
        },
        {
          name: 'run_shell_command',
          description: 'Execute a shell command in the E2B sandbox',
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Shell command to execute' },
            },
            required: ['command'],
          },
        }
      );
    }

    // Knowledge Graph tools
    if (server.id === 'mcp-sys-2' || server.name === 'Knowledge Graph') {
      tools.push(
        {
          name: 'recall_context',
          description: 'Recall relevant context from the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Maximum number of results', default: 5 },
            },
            required: ['query'],
          },
        },
        {
          name: 'vector_search',
          description: 'Perform vector similarity search in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Maximum number of results', default: 5 },
            },
            required: ['query'],
          },
        }
      );
    }

    // Google Search tools
    if (server.id === 'mcp-sys-3' || server.name === 'Google Search') {
      tools.push({
        name: 'google_search',
        description: 'Search the web using Google',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            num_results: { type: 'number', description: 'Number of results', default: 5 },
          },
          required: ['query'],
        },
      });
    }

    return tools;
  }

  /**
   * Call an MCP tool
   */
  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<any> {
    logger.info(`Calling MCP tool: ${toolName} on server: ${serverId}`, args);

    // Route to the appropriate service based on serverId
    // E2B Sandbox tools
    if (serverId === 'mcp-sys-1' || serverId.startsWith('e2b-')) {
      return await this.executeE2BTool(toolName, args);
    }

    // Knowledge Graph / Vector Search tools
    if (serverId === 'mcp-sys-2' || serverId.startsWith('knowledge-')) {
      return await this.executeKnowledgeGraphTool(toolName, args);
    }

    // Google Search tools
    if (serverId === 'mcp-sys-3' || serverId.startsWith('google-')) {
      return await this.executeGoogleSearchTool(toolName, args);
    }

    // User-created MCP servers - try to connect via MCP protocol
    if (serverId.startsWith('mcp-user-')) {
      return await this.executeUserMCPServerTool(serverId, toolName, args);
    }

    throw new Error(`Unknown MCP server: ${serverId}`);
  }

  /**
   * Execute E2B Sandbox tools
   */
  private async executeE2BTool(toolName: string, args: Record<string, any>): Promise<any> {
    const { e2bService } = await import('./e2b.service.js');

    const isConfigured = await e2bService.isConfigured();
    if (!isConfigured) {
      throw new Error(
        'E2B API key is not configured. ' +
          'To enable E2B Sandbox tools (write_file, read_file, list_directory, run_shell_command), ' +
          'please add E2B_API_KEY via Admin Console or set E2B_API_KEY environment variable. ' +
          'Get your API key at: https://e2b.dev'
      );
    }

    try {
      switch (toolName) {
        case 'write_file':
          if (!args.path || !args.content) {
            throw new Error('write_file requires path and content arguments');
          }
          const writeResult = await e2bService.writeFile(args.path, args.content);
          return { success: true, message: writeResult, path: args.path };

        case 'read_file':
          if (!args.path) {
            throw new Error('read_file requires path argument');
          }
          const content = await e2bService.readFile(args.path);
          return { success: true, content, path: args.path };

        case 'list_directory':
        case 'list_dir':
          const entries = await e2bService.listDir(args.path || '/');
          return { success: true, entries, path: args.path || '/' };

        case 'run_shell_command':
        case 'run_command':
          if (!args.command) {
            throw new Error('run_shell_command requires command argument');
          }
          const commandResult = await e2bService.runCommand(args.command);
          return {
            success: true,
            output: commandResult.output,
            error: commandResult.error,
            command: args.command,
          };

        default:
          throw new Error(`Unknown E2B tool: ${toolName}`);
      }
    } catch (error: unknown) {
      logger.error(`E2B tool execution failed: ${toolName}`, error);
      throw new Error(`E2B tool execution failed: ${error.message}`);
    }
  }

  /**
   * Execute Knowledge Graph / Vector Search tools
   */
  private async executeKnowledgeGraphTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const { vectorSearchService } = await import('./vectorSearch.service.js');

    try {
      switch (toolName) {
        case 'recall_context':
          if (!args.query) {
            throw new Error('recall_context requires query argument');
          }
          const context = await vectorSearchService.recallContext(args.query, args.limit || 3);
          return { success: true, context, query: args.query };

        case 'vector_search':
          if (!args.query) {
            throw new Error('vector_search requires query argument');
          }
          const results = await vectorSearchService.vectorSearch(
            args.query,
            args.limit || 5,
            args.filters
          );
          return { success: true, results, query: args.query };

        default:
          throw new Error(`Unknown Knowledge Graph tool: ${toolName}`);
      }
    } catch (error: unknown) {
      logger.error(`Knowledge Graph tool execution failed: ${toolName}`, error);
      throw new Error(`Knowledge Graph tool execution failed: ${error.message}`);
    }
  }

  /**
   * Execute Google Search tools
   * For Gemini: Uses native grounding (handled in gemini.service.ts)
   * For other providers: Uses Google Custom Search API as fallback
   */
  private async executeGoogleSearchTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (toolName !== 'google_search') {
      throw new Error(`Unknown Google Search tool: ${toolName}`);
    }

    if (!args.query) {
      throw new Error('google_search requires a query argument. Provide a search query string.');
    }

    const { apiKeyProvider } = await import('./apiKeyProvider.service.js');

    // Priority 1: Use Google Custom Search API if fully configured (for direct tool calls)
    // This allows MCP tools to work independently of Gemini
    const apiKey = await apiKeyProvider.getApiKey('google_search');
    const engineId = await apiKeyProvider.getGoogleSearchEngineId();

    if (apiKey && engineId && engineId !== 'YOUR_SEARCH_ENGINE_ID_HERE') {
      try {
        const searchResults = await this.performGoogleCustomSearch(
          args.query,
          args.num_results || 5,
          apiKey,
          engineId
        );
        return {
          success: true,
          results: searchResults,
          query: args.query,
          source: 'google_custom_search_api',
        };
      } catch (error: unknown) {
        logger.error('Google Custom Search API failed:', error);
        return {
          success: false,
          message: `Google Custom Search API error: ${error.message}. Verify Google Search API key and Engine ID are configured in Admin Console → Settings → API Keys.`,
          query: args.query,
          error: error.message,
        };
      }
    }

    // Priority 2: If Gemini API is configured, recommend using native grounding
    // (Agents should use Gemini with useInternet=true for better integration)
    const geminiConfigured = await apiKeyProvider.hasApiKey('gemini');
    if (geminiConfigured) {
      logger.info(
        `[MCP Google Search] Using Gemini native grounding recommendation - Custom Search API not fully configured`
      );
      return {
        success: true,
        message:
          "Google Search is available via Gemini native grounding. When agents use Google Search with useInternet=true, it will automatically use Gemini's native grounding which provides better results and automatic link extraction.",
        query: args.query,
        recommendation:
          'Use Gemini models with useInternet=true for best results. Links are automatically extracted from search results.',
        source: 'gemini_native_grounding_recommended',
        note: 'To enable direct Custom Search API calls, add Google Search API key and Engine ID via Admin Console → Settings → API Keys',
      };
    }

    // No configuration available
    return {
      success: false,
      message:
        'Google Search is not configured. Options: 1) Add GEMINI_API_KEY for native grounding (recommended, no Search Engine ID needed), or 2) Configure Google Search API key + Engine ID via Admin Console → Settings → API Keys.',
      query: args.query,
      setupInstructions: {
        gemini:
          'Add GEMINI_API_KEY via Admin Console → Settings → API Keys - enables native grounding automatically',
        customSearch:
          'Get Search Engine ID from https://programmablesearchengine.google.com/ and add Google Search API key + Engine ID via Admin Console → Settings → API Keys',
      },
    };
  }

  /**
   * Perform Google Custom Search using the API
   */
  private async performGoogleCustomSearch(
    query: string,
    numResults: number = 5,
    apiKey?: string,
    engineId?: string
  ): Promise<any[]> {
    // Get from parameters or database
    if (!apiKey || !engineId) {
      const { apiKeyProvider } = await import('./apiKeyProvider.service.js');
      apiKey = apiKey || (await apiKeyProvider.getApiKey('google_search')) || '';
      engineId = engineId || (await apiKeyProvider.getGoogleSearchEngineId()) || '';
    }

    if (!apiKey || !engineId) {
      throw new Error(
        'Google Custom Search API not configured. Add Google Search API key and Engine ID via Admin Console → Settings → API Keys.'
      );
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&num=${Math.min(numResults, 10)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Custom Search API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Format results
    const results = (data.items || []).map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
    }));

    return results;
  }

  /**
   * Execute user-created MCP server tools
   * This connects to external MCP servers via the MCP protocol
   */
  private async executeUserMCPServerTool(
    serverId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    try {
      const { MCPServer: MCPServerModel } = await import('../models/MCPServer.model.js');
      const dbServer = await MCPServerModel.findOne({ id: serverId });

      if (!dbServer) {
        throw new Error(`MCP server not found: ${serverId}`);
      }

      // Update last used timestamp
      dbServer.lastUsed = new Date();
      await dbServer.save();

      // Route based on server type
      switch (dbServer.config.type) {
        case 'e2b':
          // E2B servers use the same execution as system E2B servers
          return await this.executeE2BTool(toolName, args);

        case 'http':
        case 'websocket':
          return await this.executeHTTPWebSocketMCPTool(serverId, toolName, args, dbServer.config);

        case 'stdio':
          return await this.executeStdioMCPTool(serverId, toolName, args, dbServer.config);

        case 'custom':
          // Custom servers - would need custom handler
          throw new Error(`Custom MCP servers require custom implementation. Server: ${serverId}`);

        default:
          throw new Error(`Unknown MCP server type: ${dbServer.config.type}`);
      }
    } catch (error: unknown) {
      logger.error(`User MCP server tool execution failed: ${serverId}/${toolName}`, error);
      throw error;
    }
  }

  /**
   * Execute tool via HTTP/WebSocket MCP protocol
   */
  private async executeHTTPWebSocketMCPTool(
    serverId: string,
    toolName: string,
    args: Record<string, any>,
    config: { type: string; endpoint?: string; headers?: Record<string, string> }
  ): Promise<any> {
    if (!config.endpoint) {
      throw new Error(`MCP server ${serverId} missing endpoint configuration`);
    }

    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');

      // Create MCP client based on protocol
      let client: any;

      if (config.type === 'websocket') {
        // WebSocket MCP client
        const { WebSocketTransport } =
          await import('@modelcontextprotocol/sdk/client/websocket.js');
        const wsUrl = config.endpoint.startsWith('ws')
          ? config.endpoint
          : config.endpoint.replace(/^https?/, 'ws');
        const transport = new WebSocketTransport(wsUrl);
        client = new Client(
          {
            name: 'orbitai-mcp-client',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );
        await client.connect(transport);
      } else {
        // HTTP MCP client
        const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
        const transport = new SSEClientTransport(new URL(config.endpoint), {
          headers: config.headers || {},
        });
        client = new Client(
          {
            name: 'orbitai-mcp-client',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );
        await client.connect(transport);
      }

      try {
        // List available tools
        const tools = await client.listTools();
        const tool = tools.tools.find((t: any) => t.name === toolName);

        if (!tool) {
          throw new Error(`Tool ${toolName} not found on MCP server ${serverId}`);
        }

        // Call the tool
        const result = await client.callTool({
          name: toolName,
          arguments: args,
        });

        return result.content?.[0]?.text || result.content || result;
      } finally {
        // Close connection
        await client.close();
      }
    } catch (error: unknown) {
      logger.error(`HTTP/WebSocket MCP tool execution failed: ${serverId}/${toolName}`, error);
      throw new Error(`MCP tool execution failed: ${error.message}`);
    }
  }

  /**
   * Check health of user-created MCP server
   */
  private async checkUserServerHealth(serverId: string, dbServer: any): Promise<MCPServerHealth> {
    const health: MCPServerHealth = {
      serverId,
      name: dbServer.name,
      status: 'unknown',
      tools: dbServer.tools?.length || 0,
      lastChecked: new Date(),
    };

    try {
      switch (dbServer.config.type) {
        case 'http':
        case 'websocket':
          // Try to connect and list tools
          if (!dbServer.config.endpoint) {
            health.status = 'unhealthy';
            health.message = 'Missing endpoint configuration';
            return health;
          }

          try {
            const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
            let client: any;

            if (dbServer.config.type === 'websocket') {
              const { WebSocketTransport } =
                await import('@modelcontextprotocol/sdk/client/websocket.js');
              const wsUrl = dbServer.config.endpoint.startsWith('ws')
                ? dbServer.config.endpoint
                : dbServer.config.endpoint.replace(/^https?/, 'ws');
              const transport = new WebSocketTransport(wsUrl);
              client = new Client(
                {
                  name: 'orbitai-health-check',
                  version: '1.0.0',
                },
                {
                  capabilities: {},
                }
              );
              await client.connect(transport);
            } else {
              const { SSEClientTransport } =
                await import('@modelcontextprotocol/sdk/client/sse.js');
              const transport = new SSEClientTransport(new URL(dbServer.config.endpoint), {
                headers: dbServer.config.headers || {},
              });
              client = new Client(
                {
                  name: 'orbitai-health-check',
                  version: '1.0.0',
                },
                {
                  capabilities: {},
                }
              );
              await client.connect(transport);
            }

            try {
              const tools = await client.listTools();
              health.status = 'healthy';
              health.tools = tools.tools?.length || 0;
              health.message = 'Server is responding';
            } finally {
              await client.close();
            }
          } catch (error: unknown) {
            health.status = 'unhealthy';
            health.message = `Connection failed: ${error.message}`;
          }
          break;

        case 'stdio':
          // For stdio servers, check if command exists
          if (!dbServer.config.command) {
            health.status = 'unhealthy';
            health.message = 'Missing command configuration';
            return health;
          }

          // Try to spawn process and check if it starts
          try {
            // SECURITY: only allowlisted commands may be spawned, and the child
            // gets a minimal env (never the full process.env with secrets).
            assertStdioCommandAllowed(dbServer.config.command);
            const { spawn } = await import('child_process');
            const childProcess = spawn(dbServer.config.command, dbServer.config.args || [], {
              stdio: ['pipe', 'pipe', 'pipe'],
              env: buildAllowedStdioEnv(),
            });

            // Give it a moment to start, then kill it
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!childProcess.killed) {
              childProcess.kill();
            }

            health.status = 'healthy';
            health.message = 'Command is executable';
          } catch (error: unknown) {
            health.status = 'unhealthy';
            health.message = `Command execution failed: ${error.message}`;
          }
          break;

        case 'e2b':
          // E2B servers use existing health check
          return await this.checkE2BHealth(serverId);

        default:
          health.status = 'unknown';
          health.message = `Unknown server type: ${dbServer.config.type}`;
      }
    } catch (error: unknown) {
      health.status = 'unhealthy';
      health.message = `Health check error: ${error.message}`;
    }

    return health;
  }

  /**
   * Execute tool via stdio MCP protocol
   */
  private async executeStdioMCPTool(
    serverId: string,
    toolName: string,
    args: Record<string, any>,
    config: { type: string; command?: string; args?: string[] }
  ): Promise<any> {
    if (!config.command) {
      throw new Error(`MCP server ${serverId} missing command configuration`);
    }

    // SECURITY: default-deny unless the command is explicitly allowlisted.
    assertStdioCommandAllowed(config.command);

    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

      // Create stdio transport (handles process spawning internally).
      // SECURITY: pass a minimal env allowlist only — never the full process.env.
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: buildAllowedStdioEnv(),
      });

      // Create MCP client
      const client = new Client(
        {
          name: 'orbitai-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);

      try {
        // List available tools
        const tools = await client.listTools();
        const tool = tools.tools.find((t: any) => t.name === toolName);

        if (!tool) {
          throw new Error(`Tool ${toolName} not found on MCP server ${serverId}`);
        }

        // Call the tool
        const result = await client.callTool({
          name: toolName,
          arguments: args,
        });

        return result.content?.[0]?.text || result.content || result;
      } finally {
        // Close connection (transport will handle process cleanup)
        await client.close();
      }
    } catch (error: unknown) {
      logger.error(`Stdio MCP tool execution failed: ${serverId}/${toolName}`, error);
      throw new Error(`MCP tool execution failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const mcpService = new MCPService();
