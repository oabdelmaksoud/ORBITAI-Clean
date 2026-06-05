/**
 * OrbitAI MCP Server (server-side)
 *
 * This module makes OrbitAI an MCP *server* (it was previously only an MCP
 * client — see `mcp.service.ts`). It exposes a SMALL, SAFE, read-only set of
 * tools over the Model Context Protocol so that external MCP-aware agents can
 * introspect the OrbitAI harness.
 *
 * Design constraints (intentional):
 *   - Read-only tools ONLY. No shell execution, no state mutation, no secrets.
 *   - Nothing auto-starts at import time. Callers must explicitly construct the
 *     server via `createOrbitMcpServer()` and connect a transport themselves.
 *   - Opt-in via the `HARNESS_MCP_SERVER_ENABLED` env flag for any real boot.
 *
 * SDK: @modelcontextprotocol/sdk (installed 1.27.x) — high-level `McpServer`.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Static identity advertised by the OrbitAI MCP server.
 */
export const ORBIT_MCP_SERVER_INFO = {
  name: 'orbitai-harness',
  version: '1.0.0',
} as const;

/**
 * The fixed, read-only list of harness capabilities surfaced by the
 * `list_capabilities` tool. This is deliberately a curated, static, non-secret
 * description of what the harness can do — NOT a live registry dump and NOT a
 * way to invoke anything.
 */
export const HARNESS_CAPABILITIES: readonly string[] = [
  'google_search',
  'vector_recall',
  'knowledge_graph_query',
] as const;

/**
 * Names of the tools this server exposes. Exported so tests and callers can
 * reference them without string drift.
 */
export const ORBIT_MCP_TOOL_NAMES = {
  health: 'health',
  ping: 'ping',
  listCapabilities: 'list_capabilities',
} as const;

/** Process start time, used to compute a non-sensitive uptime value. */
const SERVER_START_MS = Date.now();

function toTextResult(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload),
      },
    ],
  };
}

/**
 * Build (but DO NOT start/connect) an OrbitAI MCP server instance with the
 * safe, read-only tool set registered.
 *
 * The returned `McpServer` has no transport attached. Connect one explicitly
 * (e.g. stdio in production, or an in-memory transport in tests) via
 * `server.connect(transport)`.
 */
export function createOrbitMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: ORBIT_MCP_SERVER_INFO.name,
      version: ORBIT_MCP_SERVER_INFO.version,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        'OrbitAI harness MCP server. Exposes read-only introspection tools ' +
        '(health, ping, list_capabilities). No tool executes shell commands ' +
        'or mutates state.',
    }
  );

  // health: liveness + identity. Zero-argument, read-only.
  server.registerTool(
    ORBIT_MCP_TOOL_NAMES.health,
    {
      title: 'Health',
      description: 'Returns OrbitAI harness liveness, identity, and uptime. Read-only.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      toTextResult({
        status: 'ok',
        name: ORBIT_MCP_SERVER_INFO.name,
        version: ORBIT_MCP_SERVER_INFO.version,
        uptimeSeconds: Math.floor((Date.now() - SERVER_START_MS) / 1000),
      })
  );

  // ping: trivial round-trip check. Zero-argument, read-only.
  server.registerTool(
    ORBIT_MCP_TOOL_NAMES.ping,
    {
      title: 'Ping',
      description: 'Returns "pong" to confirm the MCP transport is alive. Read-only.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => toTextResult({ pong: true })
  );

  // list_capabilities: static, curated description of harness capabilities.
  // Read-only; does NOT invoke or expose anything executable.
  server.registerTool(
    ORBIT_MCP_TOOL_NAMES.listCapabilities,
    {
      title: 'List Capabilities',
      description:
        'Returns a static, read-only list of OrbitAI harness capability names. ' +
        'Does not invoke or expose any executable tool.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => toTextResult({ capabilities: [...HARNESS_CAPABILITIES] })
  );

  return server;
}

/**
 * Whether the harness MCP server is opt-in enabled for a real boot.
 * Defaults to disabled so app boot behavior is never changed destructively.
 */
export function isHarnessMcpServerEnabled(): boolean {
  return process.env.HARNESS_MCP_SERVER_ENABLED === 'true';
}

/**
 * Guarded entrypoint: construct the server and connect it over stdio.
 *
 * This is opt-in and never called at import time. It is intended for running
 * OrbitAI as a standalone MCP server process (e.g. `node dist/.../startStdio`).
 * No-ops (returns null) unless `HARNESS_MCP_SERVER_ENABLED=true`.
 */
export async function startOrbitMcpStdioServer(): Promise<McpServer | null> {
  if (!isHarnessMcpServerEnabled()) {
    return null;
  }
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const server = createOrbitMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
