/**
 * Agent Function Handler Service
 * Handles function calls from agents during task execution
 */

import { logger } from '../utils/logger.js';
import { agentMCPServerCreator } from './agentMCPServerCreator.js';
import { MCPServer } from '../models/MCPServer.model.js';

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionCallResult {
  success: boolean;
  result?: any;
  error?: string;
  serverCreated?: MCPServer;
}

export class AgentFunctionHandler {
  /**
   * Handle a function call from an agent
   */
  async handleFunctionCall(
    functionCall: FunctionCall,
    agentRole: string,
    projectId?: string,
    taskId?: string
  ): Promise<FunctionCallResult> {
    try {
      logger.info(`[AgentFunctionHandler] Processing function call: ${functionCall.name} from ${agentRole}`);

      switch (functionCall.name) {
        case 'create_mcp_server':
          return await this.handleCreateMCPServer(
            functionCall.args,
            agentRole,
            projectId,
            taskId
          );

        default:
          logger.warn(`[AgentFunctionHandler] Unknown function: ${functionCall.name}`);
          return {
            success: false,
            error: `Unknown function: ${functionCall.name}`
          };
      }
    } catch (error: any) {
      logger.error(`[AgentFunctionHandler] Error handling function call:`, error);
      return {
        success: false,
        error: error.message || 'Failed to execute function call'
      };
    }
  }

  /**
   * Handle create_mcp_server function call
   */
  private async handleCreateMCPServer(
    args: Record<string, any>,
    agentRole: string,
    projectId?: string,
    taskId?: string
  ): Promise<FunctionCallResult> {
    try {
      const { name, description, serverType, endpoint, tools, reason } = args;

      if (!name || !description || !serverType) {
        return {
          success: false,
          error: 'Missing required parameters: name, description, serverType'
        };
      }

      logger.info(`[AgentFunctionHandler] Creating MCP server: ${name} (${serverType}) for ${agentRole}. Reason: ${reason || 'Not provided'}`);

      // Map serverType to config type
      const configType = serverType as 'e2b' | 'http' | 'stdio' | 'websocket' | 'custom';

      // Build config based on server type
      const config: any = {
        type: configType
      };

      if (endpoint) {
        if (configType === 'http' || configType === 'websocket') {
          config.endpoint = endpoint;
        } else if (configType === 'stdio') {
          config.command = endpoint;
        }
      }

      // Create the server
      const server = await agentMCPServerCreator.createServerForAgent(
        {
          name,
          description: `${description} (Created by ${agentRole} agent${reason ? `: ${reason}` : ''})`,
          config,
          tools: Array.isArray(tools) ? tools : [],
          metadata: {
            createdFor: projectId || taskId,
            tags: [agentRole, 'agent-created', 'auto-created'],
            notes: reason || `Created automatically by ${agentRole} agent`
          }
        },
        agentRole,
        projectId,
        taskId
      );

      logger.info(`[AgentFunctionHandler] Successfully created MCP server: ${server.id}`);

      return {
        success: true,
        result: {
          serverId: server.id,
          name: server.name,
          tools: server.tools,
          message: `MCP server "${server.name}" created successfully with ${server.tools.length} tool(s). The server is now active and tools are available for use.`
        },
        serverCreated: server
      };
    } catch (error: any) {
      logger.error(`[AgentFunctionHandler] Failed to create MCP server:`, error);
      return {
        success: false,
        error: error.message || 'Failed to create MCP server'
      };
    }
  }
}

export const agentFunctionHandler = new AgentFunctionHandler();

