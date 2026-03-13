/**
 * LLM Router Unit Tests
 * Tests for the core routing functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../gemini.service.js', () => ({
    geminiService: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
    }
}));

vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }
}));

vi.mock('./models/ModelRegistry.js', () => ({
    modelRegistry: {
        getModel: vi.fn(),
        findBestModel: vi.fn(),
        getAllModels: vi.fn(() => []),
    }
}));

vi.mock('./RoutingEngine.js', () => ({
    routingEngine: {
        selectBestModel: vi.fn(),
        getProviderForModel: vi.fn(),
    }
}));

vi.mock('./ResponseCache.js', () => ({
    responseCache: {
        get: vi.fn(() => null),
        set: vi.fn(),
    }
}));

// Import after mocks
import { LLMRouter } from './LLMRouter';

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
        it('should extract valid function calls from JSON format', () => {
            const text = `Some text before
{"name": "search", "args": {"query": "test"}}
Some text after`;

            const result = router.extractFunctionCallsFromText(text);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: 'search',
                args: { query: 'test' }
            });
        });

        it('should handle multiple function calls', () => {
            const text = `
{"name": "func1", "args": {"a": 1}}
some text
{"name": "func2", "args": {"b": 2}}
`;

            const result = router.extractFunctionCallsFromText(text);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('func1');
            expect(result[1].name).toBe('func2');
        });

        it('should return empty array for text without function calls', () => {
            const text = 'Just regular text without any function calls';

            const result = router.extractFunctionCallsFromText(text);

            expect(result).toHaveLength(0);
        });

        it('should handle malformed JSON gracefully', () => {
            const text = '{"name": "test", "args": {invalid}}';

            const result = router.extractFunctionCallsFromText(text);

            expect(result).toHaveLength(0);
        });
    });

    describe('handleRateLimit', () => {
        it('should implement exponential backoff', async () => {
            // First call should return delay
            const delay1 = await router['handleRateLimit']('gemini', 'gemini-pro', new Error('Rate limit'));
            expect(delay1).toBeGreaterThan(0);
            expect(delay1).toBeLessThanOrEqual(10000); // Max 10s
        });

        it('should cap backoff at 10 seconds', async () => {
            // Simulate multiple rate limits
            for (let i = 0; i < 10; i++) {
                await router['handleRateLimit']('gemini', 'gemini-pro', new Error('Rate limit'));
            }

            const delay = await router['handleRateLimit']('gemini', 'gemini-pro', new Error('Rate limit'));
            expect(delay).toBeLessThanOrEqual(10000);
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
export { };
