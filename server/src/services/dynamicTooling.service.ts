/**
 * Dynamic Tooling Service
 * Enables runtime tool discovery, registration, and management
 * Part of Agentic AI - Dynamic Tooling capability
 * 
 * This service extends MCP capabilities with:
 * - Runtime tool discovery from external sources
 * - Dynamic function registration
 * - Tool capability matching
 * - Tool versioning and lifecycle management
 */

import { logger } from '../utils/logger.js';
import { MCPServer } from '../models/MCPServer.model.js';
import { agentMCPServerCreator } from './agentMCPServerCreator.js';

export interface DynamicTool {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  capabilities: string[];
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  provider: ToolProvider;
  status: 'active' | 'deprecated' | 'experimental';
  metadata: {
    author?: string;
    documentation?: string;
    examples?: string[];
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
  };
}

export type ToolCategory = 
  | 'code_execution'
  | 'file_management'
  | 'web_search'
  | 'data_processing'
  | 'api_integration'
  | 'image_generation'
  | 'text_analysis'
  | 'database'
  | 'communication'
  | 'utility'
  | 'custom';

export interface ToolProvider {
  type: 'mcp' | 'function' | 'http' | 'plugin';
  source: string; // MCP server ID, function name, or HTTP endpoint
  config?: Record<string, any>;
}

export interface ToolDiscoverySource {
  id: string;
  name: string;
  type: 'registry' | 'mcp_server' | 'plugin_directory' | 'custom';
  endpoint?: string;
  enabled: boolean;
}

export interface ToolMatchCriteria {
  categories?: ToolCategory[];
  capabilities?: string[];
  tags?: string[];
  minVersion?: string;
}

export interface ToolExecutionContext {
  userId?: string;
  projectId?: string;
  agentRole?: string;
  taskId?: string;
}

class DynamicToolingService {
  private registeredTools: Map<string, DynamicTool> = new Map();
  private discoverySources: Map<string, ToolDiscoverySource> = new Map();
  private toolExecutors: Map<string, (input: any, context: ToolExecutionContext) => Promise<any>> = new Map();

  constructor() {
    // Register built-in discovery sources
    this.registerDiscoverySource({
      id: 'mcp-system',
      name: 'System MCP Servers',
      type: 'mcp_server',
      enabled: true
    });
    
    // Initialize built-in tools
    this.initializeBuiltInTools();
  }

  /**
   * Initialize built-in tools that are always available
   */
  private initializeBuiltInTools(): void {
    // Code execution tool (via E2B)
    this.registerTool({
      id: 'code-execute',
      name: 'Execute Code',
      description: 'Execute code in a sandboxed environment',
      version: '1.0.0',
      category: 'code_execution',
      capabilities: ['python', 'javascript', 'shell', 'sandbox'],
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code to execute' },
          language: { type: 'string', enum: ['python', 'javascript', 'shell'] },
          timeout: { type: 'number', default: 30000 }
        },
        required: ['code', 'language']
      },
      provider: {
        type: 'mcp',
        source: 'mcp-sys-1' // E2B server
      },
      status: 'active',
      metadata: {
        author: 'OrbitAI',
        documentation: 'Execute code in E2B sandbox',
        tags: ['code', 'execution', 'sandbox'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Web search tool
    this.registerTool({
      id: 'web-search',
      name: 'Web Search',
      description: 'Search the web for information',
      version: '1.0.0',
      category: 'web_search',
      capabilities: ['search', 'internet', 'information_retrieval'],
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          maxResults: { type: 'number', default: 10 }
        },
        required: ['query']
      },
      provider: {
        type: 'mcp',
        source: 'mcp-sys-3' // Google Search server
      },
      status: 'active',
      metadata: {
        author: 'OrbitAI',
        documentation: 'Search the web using Google Search API',
        tags: ['search', 'web', 'google'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // File management tool
    this.registerTool({
      id: 'file-manage',
      name: 'File Management',
      description: 'Read, write, and manage files',
      version: '1.0.0',
      category: 'file_management',
      capabilities: ['read', 'write', 'list', 'delete'],
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['read', 'write', 'list', 'delete'] },
          path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['operation', 'path']
      },
      provider: {
        type: 'mcp',
        source: 'mcp-sys-1'
      },
      status: 'active',
      metadata: {
        author: 'OrbitAI',
        documentation: 'File operations in sandbox',
        tags: ['file', 'storage', 'management'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Image generation tool
    this.registerTool({
      id: 'image-generate',
      name: 'Image Generation',
      description: 'Generate images from text descriptions',
      version: '1.0.0',
      category: 'image_generation',
      capabilities: ['dalle', 'text-to-image', 'ai-art'],
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Image description' },
          size: { type: 'string', enum: ['256x256', '512x512', '1024x1024'] },
          style: { type: 'string', enum: ['vivid', 'natural'] }
        },
        required: ['prompt']
      },
      provider: {
        type: 'http',
        source: '/api/images/generate'
      },
      status: 'active',
      metadata: {
        author: 'OrbitAI',
        documentation: 'Generate images using DALL-E',
        tags: ['image', 'generation', 'ai', 'dalle'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    logger.info(`[DynamicTooling] Initialized ${this.registeredTools.size} built-in tools`);
  }

  /**
   * Register a new tool
   */
  registerTool(tool: DynamicTool): void {
    this.registeredTools.set(tool.id, tool);
    logger.info(`[DynamicTooling] Registered tool: ${tool.name} (${tool.id})`);
  }

  /**
   * Register a tool executor function
   */
  registerExecutor(
    toolId: string,
    executor: (input: any, context: ToolExecutionContext) => Promise<any>
  ): void {
    this.toolExecutors.set(toolId, executor);
    logger.info(`[DynamicTooling] Registered executor for tool: ${toolId}`);
  }

  /**
   * Register a discovery source
   */
  registerDiscoverySource(source: ToolDiscoverySource): void {
    this.discoverySources.set(source.id, source);
    logger.info(`[DynamicTooling] Registered discovery source: ${source.name}`);
  }

  /**
   * Discover tools from all enabled sources
   */
  async discoverTools(): Promise<DynamicTool[]> {
    const discoveredTools: DynamicTool[] = [];

    for (const [id, source] of this.discoverySources) {
      if (!source.enabled) continue;

      try {
        const tools = await this.discoverFromSource(source);
        discoveredTools.push(...tools);
        logger.info(`[DynamicTooling] Discovered ${tools.length} tools from ${source.name}`);
      } catch (error: unknown) {
        logger.warn(`[DynamicTooling] Failed to discover tools from ${source.name}: ${error.message}`);
      }
    }

    // Register discovered tools
    for (const tool of discoveredTools) {
      if (!this.registeredTools.has(tool.id)) {
        this.registerTool(tool);
      }
    }

    return discoveredTools;
  }

  /**
   * Discover tools from a specific source
   */
  private async discoverFromSource(source: ToolDiscoverySource): Promise<DynamicTool[]> {
    switch (source.type) {
      case 'mcp_server':
        return this.discoverFromMCPServers();
      case 'registry':
        return this.discoverFromRegistry(source.endpoint!);
      default:
        return [];
    }
  }

  /**
   * Discover tools from MCP servers
   */
  private async discoverFromMCPServers(): Promise<DynamicTool[]> {
    const tools: DynamicTool[] = [];
    
    try {
      const mcpServers = await MCPServer.find({ status: 'active' });
      
      for (const server of mcpServers) {
        for (const toolName of server.tools || []) {
          const toolId = `mcp-${server.id}-${toolName}`;
          
          if (!this.registeredTools.has(toolId)) {
            tools.push({
              id: toolId,
              name: toolName,
              description: `Tool from ${server.name}`,
              version: '1.0.0',
              category: this.inferCategory(toolName),
              capabilities: [toolName],
              inputSchema: {},
              provider: {
                type: 'mcp',
                source: server.id
              },
              status: 'active',
              metadata: {
                author: server.metadata?.createdBy,
                tags: server.metadata?.tags || [],
                createdAt: server.createdAt || new Date(),
                updatedAt: server.updatedAt || new Date()
              }
            });
          }
        }
      }
    } catch (error: unknown) {
      logger.error('[DynamicTooling] Failed to discover MCP tools:', error);
    }

    return tools;
  }

  /**
   * Discover tools from external registry (placeholder)
   */
  private async discoverFromRegistry(endpoint: string): Promise<DynamicTool[]> {
    // Placeholder for external registry integration
    logger.info(`[DynamicTooling] Registry discovery from ${endpoint} not yet implemented`);
    return [];
  }

  /**
   * Infer tool category from name
   */
  private inferCategory(toolName: string): ToolCategory {
    const name = toolName.toLowerCase();
    
    if (name.includes('code') || name.includes('execute') || name.includes('run')) {
      return 'code_execution';
    }
    if (name.includes('file') || name.includes('read') || name.includes('write')) {
      return 'file_management';
    }
    if (name.includes('search') || name.includes('web') || name.includes('browse')) {
      return 'web_search';
    }
    if (name.includes('image') || name.includes('generate') || name.includes('create')) {
      return 'image_generation';
    }
    if (name.includes('api') || name.includes('http') || name.includes('request')) {
      return 'api_integration';
    }
    if (name.includes('data') || name.includes('process') || name.includes('transform')) {
      return 'data_processing';
    }
    
    return 'utility';
  }

  /**
   * Find tools matching criteria
   */
  findTools(criteria: ToolMatchCriteria): DynamicTool[] {
    return Array.from(this.registeredTools.values()).filter(tool => {
      if (criteria.categories && !criteria.categories.includes(tool.category)) {
        return false;
      }
      if (criteria.capabilities) {
        const hasCapability = criteria.capabilities.some(cap => 
          tool.capabilities.includes(cap)
        );
        if (!hasCapability) return false;
      }
      if (criteria.tags) {
        const hasTag = criteria.tags.some(tag => 
          tool.metadata.tags?.includes(tag)
        );
        if (!hasTag) return false;
      }
      return true;
    });
  }

  /**
   * Get a specific tool by ID
   */
  getTool(toolId: string): DynamicTool | undefined {
    return this.registeredTools.get(toolId);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): DynamicTool[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): DynamicTool[] {
    return this.findTools({ categories: [category] });
  }

  /**
   * Create a dynamic tool at runtime
   */
  async createDynamicTool(
    name: string,
    description: string,
    category: ToolCategory,
    capabilities: string[],
    inputSchema: Record<string, any>,
    executor: (input: any, context: ToolExecutionContext) => Promise<any>,
    metadata?: Partial<DynamicTool['metadata']>
  ): Promise<DynamicTool> {
    const toolId = `dynamic-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const tool: DynamicTool = {
      id: toolId,
      name,
      description,
      version: '1.0.0',
      category,
      capabilities,
      inputSchema,
      provider: {
        type: 'function',
        source: toolId
      },
      status: 'active',
      metadata: {
        author: metadata?.author || 'dynamic',
        documentation: metadata?.documentation,
        examples: metadata?.examples,
        tags: metadata?.tags || ['dynamic', 'runtime'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    this.registerTool(tool);
    this.registerExecutor(toolId, executor);

    logger.info(`[DynamicTooling] Created dynamic tool: ${name} (${toolId})`);
    return tool;
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolId: string,
    input: any,
    context: ToolExecutionContext
  ): Promise<any> {
    const tool = this.getTool(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const executor = this.toolExecutors.get(toolId);
    if (executor) {
      return executor(input, context);
    }

    // For MCP tools, delegate to MCP service
    if (tool.provider.type === 'mcp') {
      // This would integrate with the MCP service
      throw new Error(`MCP tool execution should go through MCP service: ${toolId}`);
    }

    throw new Error(`No executor registered for tool: ${toolId}`);
  }

  /**
   * Get tool statistics
   */
  getStatistics(): {
    totalTools: number;
    byCategory: Record<ToolCategory, number>;
    byStatus: Record<string, number>;
    byProvider: Record<string, number>;
  } {
    const tools = this.getAllTools();
    
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const tool of tools) {
      byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
      byStatus[tool.status] = (byStatus[tool.status] || 0) + 1;
      byProvider[tool.provider.type] = (byProvider[tool.provider.type] || 0) + 1;
    }

    return {
      totalTools: tools.length,
      byCategory: byCategory as Record<ToolCategory, number>,
      byStatus,
      byProvider
    };
  }
}

export const dynamicToolingService = new DynamicToolingService();




