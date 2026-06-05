/**
 * Tests for the OrbitAI MCP *server* (mcpServer.service.ts).
 *
 * These tests exercise the real MCP round-trip: a linked in-memory transport
 * pair connects a real SDK `Client` to the OrbitAI `McpServer`, then lists
 * tools and calls them through the protocol. Nothing meaningful is mocked.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  createOrbitMcpServer,
  isHarnessMcpServerEnabled,
  ORBIT_MCP_SERVER_INFO,
  ORBIT_MCP_TOOL_NAMES,
  HARNESS_CAPABILITIES,
} from '../mcpServer.service.js';

async function connectClient() {
  const server = createOrbitMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '0.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { server, client };
}

function parseText(result: { content: Array<{ type: string; text?: string }> }) {
  const textPart = result.content.find(c => c.type === 'text');
  expect(textPart?.text).toBeDefined();
  return JSON.parse(textPart!.text!);
}

describe('OrbitAI MCP Server', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('lists the safe read-only tool set', async () => {
    const { server, client } = await connectClient();
    cleanup = async () => {
      await client.close();
      await server.close();
    };

    const { tools } = await client.listTools();
    const names = tools.map(t => t.name).sort();

    expect(names).toEqual(
      [
        ORBIT_MCP_TOOL_NAMES.health,
        ORBIT_MCP_TOOL_NAMES.listCapabilities,
        ORBIT_MCP_TOOL_NAMES.ping,
      ].sort()
    );

    // Every exposed tool must advertise itself as read-only.
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('answers the health tool over the protocol', async () => {
    const { server, client } = await connectClient();
    cleanup = async () => {
      await client.close();
      await server.close();
    };

    const result = (await client.callTool({
      name: ORBIT_MCP_TOOL_NAMES.health,
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBeFalsy();
    const payload = parseText(result);
    expect(payload.status).toBe('ok');
    expect(payload.name).toBe(ORBIT_MCP_SERVER_INFO.name);
    expect(payload.version).toBe(ORBIT_MCP_SERVER_INFO.version);
    expect(typeof payload.uptimeSeconds).toBe('number');
  });

  it('answers the ping tool over the protocol', async () => {
    const { server, client } = await connectClient();
    cleanup = async () => {
      await client.close();
      await server.close();
    };

    const result = (await client.callTool({
      name: ORBIT_MCP_TOOL_NAMES.ping,
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBeFalsy();
    expect(parseText(result).pong).toBe(true);
  });

  it('returns the static capability list', async () => {
    const { server, client } = await connectClient();
    cleanup = async () => {
      await client.close();
      await server.close();
    };

    const result = (await client.callTool({
      name: ORBIT_MCP_TOOL_NAMES.listCapabilities,
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBeFalsy();
    expect(parseText(result).capabilities).toEqual([...HARNESS_CAPABILITIES]);
  });

  it('is opt-in disabled by default', () => {
    const prev = process.env.HARNESS_MCP_SERVER_ENABLED;
    delete process.env.HARNESS_MCP_SERVER_ENABLED;
    expect(isHarnessMcpServerEnabled()).toBe(false);
    if (prev !== undefined) {
      process.env.HARNESS_MCP_SERVER_ENABLED = prev;
    }
  });
});
