/**
 * Stub for @trycua/agent package
 * The package is installed but not built (missing dist/).
 * This stub provides the minimum interface needed for tests.
 */

export class AgentClient {
  constructor(_url: string, _options?: any) {}
  async health() { return { status: 'healthy' }; }
  async disconnect() {}
  responses = {
    create: async (_request: any) => ({ output: [], usage: {} }),
  };
}
