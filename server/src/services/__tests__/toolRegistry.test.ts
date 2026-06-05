import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above imports, so spies must be created via vi.hoisted().
const { callTool, handleFunctionCall, find } = vi.hoisted(() => ({
  callTool: vi.fn(),
  handleFunctionCall: vi.fn(),
  find: vi.fn(),
}));

vi.mock('../mcp.service.js', () => ({ mcpService: { callTool } }));
vi.mock('../agentFunctionHandler.service.js', () => ({
  agentFunctionHandler: { handleFunctionCall },
}));
vi.mock('../../models/MCPServer.model.js', () => ({
  // MCPServer.find({...}).lean() -> resolves to the `find` spy's value.
  MCPServer: { find: (...args: any[]) => ({ lean: () => find(...args) }) },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { toolRegistry } from '../toolRegistry.service.js';

const declared = [
  {
    name: 'google_search',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'db_query',
    parameters: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] },
  },
];

beforeEach(() => {
  callTool.mockReset();
  handleFunctionCall.mockReset();
  find.mockReset();
  find.mockResolvedValue([]);
});

describe('toolRegistry.dispatch (WI-4 / WI-5)', () => {
  it('refuses a tool that was not declared to the model (allowlist)', async () => {
    const r = await toolRegistry.dispatch({ name: 'rm_rf', args: {} }, declared, {});
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not declared or allowed/);
    expect(callTool).not.toHaveBeenCalled();
    expect(handleFunctionCall).not.toHaveBeenCalled();
  });

  it('rejects a call missing a required argument', async () => {
    const r = await toolRegistry.dispatch({ name: 'google_search', args: {} }, declared, {});
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Missing required argument "query"/);
    expect(callTool).not.toHaveBeenCalled();
  });

  it('rejects a wrongly-typed argument', async () => {
    const r = await toolRegistry.dispatch(
      { name: 'google_search', args: { query: 123 as any } },
      declared,
      {}
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/must be of type string/);
  });

  it('dispatches google_search to the system MCP server', async () => {
    callTool.mockResolvedValue({ hits: 1 });
    const r = await toolRegistry.dispatch(
      { name: 'google_search', args: { query: 'orbitai' } },
      declared,
      {}
    );
    expect(callTool).toHaveBeenCalledWith('mcp-sys-3', 'google_search', { query: 'orbitai' });
    expect(r.success).toBe(true);
    expect(r.result).toEqual({ hits: 1 });
  });

  it('routes a declared MCP tool to the server that advertises it (WI-5)', async () => {
    find.mockResolvedValue([{ id: 'mcp-user-1', tools: ['db_query'] }]);
    callTool.mockResolvedValue({ rows: [] });
    const r = await toolRegistry.dispatch(
      { name: 'db_query', args: { sql: 'SELECT 1' } },
      declared,
      {}
    );
    expect(callTool).toHaveBeenCalledWith('mcp-user-1', 'db_query', { sql: 'SELECT 1' });
    expect(r.success).toBe(true);
  });
});
