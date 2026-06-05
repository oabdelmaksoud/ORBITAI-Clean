/**
 * Tool Registry (WI-4 / WI-5)
 *
 * A single, validated, permissioned dispatch surface for the agent loop. It replaces the ad-hoc
 * "if google_search ... else create_mcp_server" branching in FunctionCallProcessor with:
 *   - an ALLOWLIST: only tools that were declared to the model this request may execute;
 *   - lightweight ARGUMENT VALIDATION against each tool's declared JSON-schema `parameters`;
 *   - DISPATCH to the right backend: create_mcp_server (agent handler), google_search (system MCP),
 *     or any user/agent MCP server that advertises the tool (WI-5 — real MCP tools become reachable).
 *
 * Security note: the actual execution of stdio MCP servers is gated/sandboxed in mcp.service.ts
 * (WI-2). This registry only decides *whether* and *where* to dispatch.
 */

import { logger } from '../utils/logger.js';
import { MCPServer } from '../models/MCPServer.model.js';
import { agentFunctionHandler, FunctionCall } from './agentFunctionHandler.service.js';

export interface DeclaredTool {
  name: string;
  description?: string;
  parameters?: { type?: string; properties?: Record<string, any>; required?: string[] } | any;
}

export interface ToolDispatchContext {
  agentRole?: string;
  projectId?: string;
  taskId?: string;
}

export interface ToolDispatchResult {
  name: string;
  success: boolean;
  result?: any;
  error?: string;
}

const MCP_MAP_TTL_MS = 10_000;

class ToolRegistry {
  private mcpMapCache?: { map: Map<string, string>; at: number };

  /** Build (and briefly cache) a tool-name -> serverId map from active MCP servers. */
  private async buildMcpToolMap(): Promise<Map<string, string>> {
    const fresh = this.mcpMapCache && Date.now() - this.mcpMapCache.at < MCP_MAP_TTL_MS;
    if (fresh) return this.mcpMapCache!.map;

    const map = new Map<string, string>();
    try {
      const servers = await MCPServer.find({ status: 'active' }).lean();
      for (const server of servers) {
        for (const toolName of server.tools || []) {
          // First server to advertise a tool name wins; qualify by serverId to avoid collisions.
          if (!map.has(toolName)) map.set(toolName, server.id);
        }
      }
    } catch (error) {
      logger.warn('[ToolRegistry] Failed to load MCP servers for tool map:', error);
    }
    this.mcpMapCache = { map, at: Date.now() };
    return map;
  }

  /**
   * Validate args against a declared JSON-schema-style `parameters` object.
   * Intentionally lightweight (required-presence + primitive type checks) — enough to feed a
   * structured error back into the loop without pulling a full JSON-schema engine.
   */
  private validateArgs(name: string, args: Record<string, any>, parameters?: any): string | null {
    if (!parameters || typeof parameters !== 'object') return null;

    const required: string[] = Array.isArray(parameters.required) ? parameters.required : [];
    for (const key of required) {
      if (args[key] === undefined || args[key] === null) {
        return `Missing required argument "${key}" for tool "${name}"`;
      }
    }

    const props: Record<string, any> = parameters.properties || {};
    for (const [key, value] of Object.entries(args)) {
      if (!props[key]) continue;
      const err = this.validateValue(value, props[key], `Argument "${key}" for tool "${name}"`);
      if (err) return err;
    }
    return null;
  }

  /**
   * Recursive JSON-schema-style validation: type, enum, nested object properties + required,
   * and array item types (dim 2 → 5 — fuller than the original primitive-only check).
   */
  private validateValue(value: any, spec: any, label: string): string | null {
    if (!spec || typeof spec !== 'object') return null;

    if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
      return `${label} must be one of: ${spec.enum.join(', ')}`;
    }

    const type = spec.type;
    if (type === 'object') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return `${label} must be an object`;
      }
      for (const key of Array.isArray(spec.required) ? spec.required : []) {
        if (value[key] === undefined || value[key] === null) {
          return `${label} is missing required property "${key}"`;
        }
      }
      const props: Record<string, any> = spec.properties || {};
      for (const [key, v] of Object.entries(value)) {
        if (props[key]) {
          const err = this.validateValue(v, props[key], `${label}.${key}`);
          if (err) return err;
        }
      }
      return null;
    }

    if (type === 'array') {
      if (!Array.isArray(value)) return `${label} must be an array`;
      if (spec.items) {
        for (let i = 0; i < value.length; i++) {
          const err = this.validateValue(value[i], spec.items, `${label}[${i}]`);
          if (err) return err;
        }
      }
      return null;
    }

    const ok =
      type === 'string'
        ? typeof value === 'string'
        : type === 'number' || type === 'integer'
          ? typeof value === 'number'
          : type === 'boolean'
            ? typeof value === 'boolean'
            : true;
    return ok ? null : `${label} must be of type ${type}`;
  }

  /**
   * Dispatch a single model-requested tool call.
   * `declaredTools` is the set of tools shown to the model this request (the allowlist + schemas).
   */
  async dispatch(
    functionCall: FunctionCall,
    declaredTools: DeclaredTool[],
    ctx: ToolDispatchContext
  ): Promise<ToolDispatchResult> {
    const { name } = functionCall;
    const args = functionCall.args || {};

    // ALLOWLIST: never execute a tool that wasn't offered to the model this request.
    const declared = declaredTools.find(d => d.name === name);
    if (!declared) {
      logger.warn(`[ToolRegistry] Refusing undeclared/contraband tool: ${name}`);
      return {
        name,
        success: false,
        error: `Tool "${name}" was not declared or allowed for this request`,
      };
    }

    // VALIDATION.
    const validationError = this.validateArgs(name, args, declared.parameters);
    if (validationError) {
      logger.warn(`[ToolRegistry] ${validationError}`);
      return { name, success: false, error: validationError };
    }

    // DISPATCH.
    try {
      if (name === 'create_mcp_server') {
        const result = await agentFunctionHandler.handleFunctionCall(
          functionCall,
          ctx.agentRole || 'unknown',
          ctx.projectId,
          ctx.taskId
        );
        return { name, success: result.success, result: result.result, error: result.error };
      }

      const { mcpService } = await import('./mcp.service.js');

      if (name === 'google_search') {
        const result = await mcpService.callTool('mcp-sys-3', 'google_search', args);
        return { name, success: true, result };
      }

      // WI-5: route to the MCP server that advertises this tool.
      const mcpMap = await this.buildMcpToolMap();
      const serverId = mcpMap.get(name);
      if (serverId) {
        const result = await mcpService.callTool(serverId, name, args);
        return { name, success: true, result };
      }

      return { name, success: false, error: `No handler or MCP server found for tool "${name}"` };
    } catch (error: any) {
      logger.error(`[ToolRegistry] Tool "${name}" execution failed:`, error);
      return { name, success: false, error: error?.message || 'Tool execution failed' };
    }
  }
}

export const toolRegistry = new ToolRegistry();
