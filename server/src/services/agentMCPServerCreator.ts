/**
 * Agent MCP Server Creator Service
 * Allows AI agents to create and save MCP servers for specific tasks
 */

import { logger } from '../utils/logger.js';
import { MCPServer } from '../models/MCPServer.model.js';
import { MCPServer as MCPServerType } from '../../../types.js';

export interface CreateMCPServerRequest {
  name: string;
  description: string;
  config: {
    type: 'e2b' | 'http' | 'stdio' | 'websocket' | 'custom';
    endpoint?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
    apiKey?: string;
  };
  tools?: string[];
  metadata?: {
    createdFor?: string; // Project ID or task ID
    tags?: string[];
    notes?: string;
  };
}

export class AgentMCPServerCreator {
  /**
   * Create an MCP server for an agent task
   * This is called by agents during task execution when they need a new server
   */
  async createServerForAgent(
    request: CreateMCPServerRequest,
    agentRole: string,
    projectId?: string,
    taskId?: string
  ): Promise<MCPServerType> {
    try {
      // Generate unique ID
      const id = `mcp-agent-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Discover tools if not provided
      let serverTools = request.tools || [];
      if (serverTools.length === 0 && request.config.type === 'e2b') {
        // E2B servers have predefined tools
        serverTools = ['write_file', 'read_file', 'list_directory', 'run_shell_command'];
      }

      // Create server in database
      const server = new MCPServer({
        id,
        name: request.name,
        description: request.description || `Created by ${agentRole} for task execution`,
        status: 'active',
        source: 'agent',
        tools: serverTools,
        config: {
          type: request.config.type,
          endpoint: request.config.endpoint,
          command: request.config.command,
          args: request.config.args,
          headers: request.config.headers,
          apiKey: request.config.apiKey // Should be encrypted in production
        },
        metadata: {
          createdBy: agentRole, // Store agent role instead of user ID
          createdFor: request.metadata?.createdFor || projectId || taskId,
          tags: request.metadata?.tags || [agentRole, 'agent-created'],
          notes: request.metadata?.notes || `Created automatically by ${agentRole} agent`
        }
      });

      await server.save();

      logger.info(`Agent ${agentRole} created MCP server: ${id} for ${projectId || taskId || 'task'}`);

      // Return in MCPServer format
      return {
        id: server.id,
        name: server.name,
        description: server.description,
        status: server.status,
        source: server.source,
        tools: server.tools
      };
    } catch (error: unknown) {
      logger.error(`Failed to create MCP server for agent ${agentRole}:`, error);
      throw new Error(`Failed to create MCP server: ${error.message}`);
    }
  }

  /**
   * Find existing MCP server for a task/project
   * Agents can reuse existing servers instead of creating new ones
   */
  async findServerForTask(
    projectId?: string,
    taskId?: string,
    agentRole?: string
  ): Promise<MCPServerType | null> {
    try {
      const query: any = {
        source: 'agent',
        status: 'active'
      };

      if (projectId) {
        query['metadata.createdFor'] = projectId;
      }
      if (taskId) {
        query['metadata.createdFor'] = taskId;
      }
      if (agentRole) {
        query['metadata.tags'] = agentRole;
      }

      const server = await MCPServer.findOne(query).sort({ createdAt: -1 });

      if (!server) {
        return null;
      }

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        status: server.status,
        source: server.source,
        tools: server.tools
      };
    } catch (error: unknown) {
      logger.error('Failed to find MCP server for task:', error);
      return null;
    }
  }

  /**
   * List all agent-created servers for a project
   */
  async listAgentServers(projectId: string): Promise<MCPServerType[]> {
    try {
      const servers = await MCPServer.find({
        source: 'agent',
        'metadata.createdFor': projectId,
        status: 'active'
      }).sort({ createdAt: -1 });

      return servers.map(server => ({
        id: server.id,
        name: server.name,
        description: server.description,
        status: server.status,
        source: server.source,
        tools: server.tools
      }));
    } catch (error: unknown) {
      logger.error('Failed to list agent servers:', error);
      return [];
    }
  }
}

export const agentMCPServerCreator = new AgentMCPServerCreator();
