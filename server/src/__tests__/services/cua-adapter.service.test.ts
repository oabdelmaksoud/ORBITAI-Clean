/**
 * CUA Adapter Service Tests
 * Tests for the CUA adapter bridging local Playwright and @trycua/agent SDK
 *
 * @module __tests__/services/cua-adapter.service
 *
 * NOTE: cua-adapter.service.ts statically imports the @trycua/agent SDK, which
 * ships no built dist/ in this environment — vite cannot resolve its entry, and
 * the failure happens at module resolution (before vi.mock can intercept). So we
 * load the service via DYNAMIC import inside a describe gated on hasCuaCloud; when
 * CUA cloud is unconfigured (the default test env) the suite skips and the
 * unresolvable package is never touched. Set CUA_CLOUD_URL + CUA_API_KEY (and
 * build @trycua/agent) to run these.
 */

import { describe, it, expect, beforeEach, beforeAll, vi, Mock } from 'vitest';
import { cuaService } from '../../services/cua.service.js';
import { hasCuaCloud } from '../helpers/testEnv.js';

// Mock dependencies
vi.mock('../../services/cua.service.js', () => ({
  cuaService: {
    testPrototypeLive: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

vi.mock('../../services/websocket.service.js', () => ({
  webSocketService: {
    getIO: vi.fn(() => ({ emit: vi.fn() })),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe.skipIf(!hasCuaCloud)('CUA Adapter Service', () => {
  let cuaAdapterService: (typeof import('../../services/cua-adapter.service.js'))['cuaAdapterService'];

  beforeAll(async () => {
    // Dynamic import keeps @trycua/agent out of the module graph until needed.
    ({ cuaAdapterService } = await import('../../services/cua-adapter.service.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convertToCUAFormat', () => {
    it('should convert local test results to CUA response format', () => {
      const mockResult = {
        sessionId: 'test-session-123',
        status: 'passed' as const,
        scenarios: [
          {
            id: 'scenario-1',
            type: 'click' as const,
            target: 'Button: "Submit"',
            selector: '#submit-btn',
            description: 'Click submit button',
            expectedResult: 'Form submits',
            status: 'passed' as const,
            duration: 500,
          },
        ],
        summary: '✓ All 1 tests passed!',
        screenshot: 'data:image/png;base64,abc123',
        passedCount: 1,
        failedCount: 0,
        totalDuration: 1000,
      };

      const response = cuaAdapterService.convertToCUAFormat(mockResult);

      expect(response.status).toBe('completed');
      expect(response.output).toBeInstanceOf(Array);
      expect(response.output.length).toBeGreaterThan(0);

      const reasoningMsg = response.output.find(m => m.type === 'reasoning');
      expect(reasoningMsg).toBeDefined();

      const computerCallMsg = response.output.find(m => m.type === 'computer_call');
      expect(computerCallMsg).toBeDefined();

      const assistantMsg = response.output.find(m => m.type === 'message');
      expect(assistantMsg).toBeDefined();

      expect(response.usage).toBeDefined();
      expect(response.usage.total_tokens).toBe(0);
    });

    it('should handle failed test results', () => {
      const mockResult = {
        sessionId: 'test-session-456',
        status: 'failed' as const,
        scenarios: [
          {
            id: 'scenario-1',
            type: 'click' as const,
            target: 'Button: "Submit"',
            description: 'Click submit button',
            status: 'failed' as const,
            error: 'Element not found',
          },
        ],
        summary: '✗ 0/1 tests passed, 1 failed',
        error: 'Test execution failed',
        passedCount: 0,
        failedCount: 1,
      };

      const response = cuaAdapterService.convertToCUAFormat(mockResult);

      expect(response.status).toBe('failed');
      expect(response.error).toBe('Test execution failed');
    });
  });

  describe('executeLocal', () => {
    it('should execute test using local Playwright service', async () => {
      const mockResult = {
        sessionId: 'local-test-123',
        status: 'passed' as const,
        scenarios: [],
        summary: 'Test passed',
        passedCount: 0,
        failedCount: 0,
      };

      (cuaService.testPrototypeLive as Mock).mockResolvedValue(mockResult);

      const response = await cuaAdapterService.executeLocal('<html></html>', 'local-test-123');

      expect(cuaService.testPrototypeLive).toHaveBeenCalledWith('<html></html>', 'local-test-123');
      expect(response.status).toBe('completed');
    });

    it('should handle local execution errors', async () => {
      (cuaService.testPrototypeLive as Mock).mockRejectedValue(new Error('Browser crash'));

      const response = await cuaAdapterService.executeLocal('<html></html>', 'error-test');

      expect(response.status).toBe('failed');
      expect(response.error).toBe('Browser crash');
    });
  });

  describe('test', () => {
    it('should use local mode by default', async () => {
      const mockResult = {
        sessionId: 'test-session',
        status: 'passed' as const,
        scenarios: [],
        summary: 'OK',
        passedCount: 0,
        failedCount: 0,
      };

      (cuaService.testPrototypeLive as Mock).mockResolvedValue(mockResult);

      await cuaAdapterService.test('<html></html>', 'test-session');

      expect(cuaService.testPrototypeLive).toHaveBeenCalled();
    });

    it('should accept mode option', async () => {
      const mockResult = {
        sessionId: 'test-session',
        status: 'passed' as const,
        scenarios: [],
        summary: 'OK',
        passedCount: 0,
        failedCount: 0,
      };

      (cuaService.testPrototypeLive as Mock).mockResolvedValue(mockResult);

      await cuaAdapterService.test('<html></html>', 'test-session', { mode: 'local' });

      expect(cuaService.testPrototypeLive).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return health status for local service', async () => {
      (cuaService.healthCheck as Mock).mockResolvedValue(true);

      const health = await cuaAdapterService.healthCheck();

      expect(health.local).toBe(true);
      expect(health.cloud).toBeNull();
    });

    it('should handle unhealthy local service', async () => {
      (cuaService.healthCheck as Mock).mockResolvedValue(false);

      const health = await cuaAdapterService.healthCheck();

      expect(health.local).toBe(false);
    });
  });

  describe('isCloudAvailable', () => {
    it('should reflect cloud configuration', () => {
      expect(typeof cuaAdapterService.isCloudAvailable()).toBe('boolean');
    });
  });
});
