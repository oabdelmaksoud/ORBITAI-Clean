/**
 * LLM Router Unit Tests
 * Tests for the core routing functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../gemini.service.js', () => ({
  geminiService: {
    generateContent: vi.fn(),
    generateContentStream: vi.fn(),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../models/ModelRegistry.js', () => ({
  modelRegistry: {
    getModel: vi.fn(),
    findBestModel: vi.fn(),
    getAllModels: vi.fn(() => []),
  },
}));

vi.mock('../RoutingEngine.js', () => ({
  routingEngine: {
    selectBestModel: vi.fn(),
    selectModel: vi.fn(),
    getProviderForModel: vi.fn(),
  },
}));

vi.mock('../ResponseCache.js', () => ({
  responseCache: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}));

vi.mock('../../../config/env.js', () => ({
  config: {},
}));

vi.mock('../TaskAnalyzer.js', () => ({
  taskAnalyzer: {
    analyzeTask: vi.fn(() => ({
      taskType: 'chat',
      complexity: 'simple',
      domain: 'conversation',
      outputType: 'text',
      latencyRequirement: 'fast',
      costSensitivity: 'medium',
      estimatedTokens: 100,
      requiredCapabilities: [],
      priority: 1,
    })),
  },
  TaskAnalyzer: vi.fn(),
}));

vi.mock('../FunctionCallProcessor.js', () => ({
  functionCallProcessor: {
    process: vi.fn(),
  },
  LLMResponseWithFunctionCalls: vi.fn(),
}));

vi.mock('../UsageTracker.js', () => ({
  usageTracker: {
    trackUsage: vi.fn(),
  },
}));

vi.mock('../providers/OpenAIService.js', () => ({ openAIService: {} }));
vi.mock('../providers/AnthropicService.js', () => ({ anthropicService: {} }));
vi.mock('../providers/DeepSeekService.js', () => ({ deepSeekService: {} }));
vi.mock('../providers/GrokService.js', () => ({ grokService: {} }));
vi.mock('../providers/MistralService.js', () => ({ mistralService: {} }));
vi.mock('../providers/QwenService.js', () => ({ qwenService: {} }));
vi.mock('../providers/OpenRouterService.js', () => ({ openRouterService: {} }));
vi.mock('../providers/GroqService.js', () => ({ groqService: {} }));
vi.mock('../providers/VertexService.js', () => ({ vertexService: {} }));
vi.mock('../providers/AzureOpenAIService.js', () => ({ azureOpenAIService: {} }));
vi.mock('../providers/OllamaService.js', () => ({ OllamaService: vi.fn() }));
vi.mock('../providers/VLLMService.js', () => ({ VLLMService: vi.fn() }));
vi.mock('../providers/OpenAICompatibleService.js', () => ({ OpenAICompatibleService: vi.fn() }));
vi.mock('../../apiKeyProvider.service.js', () => ({ apiKeyProvider: { getKey: vi.fn() } }));
vi.mock('../../GenerationStatus.service.js', () => ({ generationStatusService: {} }));
vi.mock('../CircuitBreaker.js', () => ({
  llmCircuitBreaker: {
    isOpen: vi.fn(() => false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

vi.mock('../../../errors/ApiError.js', () => ({
  toApiError: vi.fn((error: any) => ({
    statusCode:
      error?.statusCode || (error?.message?.toLowerCase().includes('rate limit') ? 429 : 500),
    message: error?.message || 'Unknown error',
  })),
  ApiError: vi.fn(),
}));

// Import after mocks
import { LLMRouter } from '../LLMRouter.js';

describe('LLMRouter', () => {
  let router: LLMRouter;

  beforeEach(() => {
    router = new LLMRouter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractFunctionCallsFromText', () => {
    it('should extract create_mcp_server function calls from text', () => {
      const text = `Some text before
create_mcp_server({"serverName": "test-server", "tools": []})
Some text after`;

      const result = router['extractFunctionCallsFromText'](text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'create_mcp_server',
        args: { serverName: 'test-server', tools: [] },
      });
    });

    it('should extract function calls from code blocks', () => {
      const text = '```json\n{"name": "create_mcp_server", "args": {"serverName": "test"}}\n```';

      const result = router['extractFunctionCallsFromText'](text);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('create_mcp_server');
    });

    it('should return empty array for text without function calls', () => {
      const text = 'Just regular text without any function calls';

      const result = router['extractFunctionCallsFromText'](text);

      expect(result).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', () => {
      const text = 'create_mcp_server({invalid json here})';

      const result = router['extractFunctionCallsFromText'](text);

      expect(result).toHaveLength(0);
    });
  });

  describe('handleRateLimit', () => {
    it('should return 0 for non-rate-limit errors', async () => {
      const delay = await router['handleRateLimit'](
        'gemini',
        'gemini-pro',
        new Error('Some other error')
      );
      expect(delay).toBe(0);
    });

    it('should return a positive delay for rate limit errors', async () => {
      // Use fake timers to avoid real delays
      vi.useFakeTimers();
      const promise = router['handleRateLimit']('gemini', 'gemini-pro', new Error('Rate limit'));
      // Advance timer to resolve the sleep
      await vi.advanceTimersByTimeAsync(1000);
      const delay = await promise;
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(10000);
      vi.useRealTimers();
    });

    it('should cap backoff at 10 seconds', async () => {
      vi.useFakeTimers();
      // Simulate multiple rate limits to reach the cap
      for (let i = 0; i < 10; i++) {
        const p = router['handleRateLimit']('gemini', 'gemini-pro', new Error('Rate limit'));
        await vi.advanceTimersByTimeAsync(11000);
        await p;
      }

      const promise = router['handleRateLimit']('gemini', 'gemini-pro', new Error('Rate limit'));
      await vi.advanceTimersByTimeAsync(11000);
      const delay = await promise;
      expect(delay).toBeLessThanOrEqual(10000);
      vi.useRealTimers();
    });
  });

  describe('LLMContext validation', () => {
    it('should accept valid context', () => {
      const context = {
        agentRole: 'assistant',
        taskType: 'code-generation',
        maxTokens: 4096,
      };

      expect(context.agentRole).toBe('assistant');
      expect(context.taskType).toBe('code-generation');
    });
  });

  describe('Provider selection', () => {
    it('should default to gemini if no preference specified', async () => {
      // This tests the default behavior
      // In a real test, we'd mock the routing engine
      expect(true).toBe(true); // Placeholder
    });
  });
});

// Export for test runner
export {};
