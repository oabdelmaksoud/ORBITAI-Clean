import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Unit / harness test gate (dimension 15).
 *
 * Runs only the deterministic, infrastructure-free suites (mocks only — no MongoDB, e2b, embedding,
 * or other external services). This is the GREEN, trustworthy gate the CI workflow runs.
 *
 * The full suite (vitest.config.ts) additionally pulls in integration tests that require provisioned
 * external services; those have pre-existing failures and are triaged separately, so they are not
 * part of the merge gate.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/services/__tests__/toolRegistry.test.ts',
      'src/services/__tests__/agentMemory.test.ts',
      'src/services/__tests__/budgetGuard.test.ts',
      'src/services/__tests__/contextManager.test.ts',
      'src/services/__tests__/planning.test.ts',
      'src/services/__tests__/agentExecutionEngine.test.ts',
      'src/services/__tests__/executionRecovery.test.ts',
      'src/services/__tests__/mcpStdioSecurity.test.ts',
      'src/services/__tests__/executionCheckpoint.test.ts',
      'src/services/__tests__/approvalGate.test.ts',
      'src/services/__tests__/evaluation.golden.test.ts',
      'src/services/__tests__/mcpServer.service.test.ts',
      'src/services/llm/__tests__/FunctionCallProcessor.loop.test.ts',
      'src/services/llm/__tests__/fallbackSelector.test.ts',
      'src/services/llm/__tests__/CircuitBreaker.test.ts',
      'src/services/llm/__tests__/LLMRouter.test.ts',
      'src/services/llm/__tests__/routing-enhancements.test.ts',
      'src/services/llm/providers/__tests__/AnthropicService.toolcall.test.ts',
      'src/services/llm/providers/__tests__/ILLMProvider.test.ts',
      'src/services/llm/__tests__/routingDecisionRecord.test.ts',
      'src/middleware/__tests__/denyGuests.test.ts',
      'src/utils/__tests__/secretCrypto.test.ts',
      'src/utils/__tests__/requestContext.test.ts',
    ],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
