import { describe, it, expect, vi, beforeEach } from 'vitest';

// Spies created via vi.hoisted so the hoisted vi.mock factories can reference them.
const { dispatch, openaiGen } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  openaiGen: vi.fn(),
}));

vi.mock('../../toolRegistry.service.js', () => ({ toolRegistry: { dispatch } }));
vi.mock('../providers/OpenAIService.js', () => ({ openAIService: { generateContent: openaiGen } }));
vi.mock('../../gemini.service.js', () => ({ geminiService: { generateContent: vi.fn() } }));
vi.mock('../providers/AnthropicService.js', () => ({
  anthropicService: { generateContent: vi.fn() },
}));
vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { functionCallProcessor } from '../FunctionCallProcessor.js';

const tools = [{ functionDeclarations: [{ name: 'google_search', parameters: {} }] }];

beforeEach(() => {
  dispatch.mockReset();
  openaiGen.mockReset();
  // Continuation turn returns a final answer with NO function calls -> loop terminates.
  openaiGen.mockResolvedValue({
    text: 'final answer',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  });
});

describe('FunctionCallProcessor.processWithFunctionCalls', () => {
  it('dispatches the requested tool via the registry and returns the final text', async () => {
    dispatch.mockResolvedValue({ name: 'google_search', success: true, result: { hits: 1 } });

    const initial = {
      text: '',
      functionCalls: [{ name: 'google_search', args: { query: 'x' } }],
      usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
      modelUsed: 'gpt-4o',
      provider: 'openai' as const,
    };

    const result = await functionCallProcessor.processWithFunctionCalls(
      initial,
      'do a search',
      tools,
      'system',
      'Implementation Agent',
      'proj-1',
      'task-1'
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    // Registry receives the declared-tool allowlist derived from `tools`.
    expect(dispatch.mock.calls[0][1]).toEqual([{ name: 'google_search', parameters: {} }]);
    expect(result.finalText).toBe('final answer');
    expect(result.functionCallsExecuted).toHaveLength(1);
    expect(result.functionCallsExecuted[0].name).toBe('google_search');
  });

  it('executes multiple tool calls in one turn (parallel) and ends when none remain', async () => {
    dispatch.mockImplementation(async (fc: any) => ({
      name: fc.name,
      success: true,
      result: 'ok',
    }));

    const initial = {
      text: '',
      functionCalls: [
        { name: 'google_search', args: { query: 'a' } },
        { name: 'google_search', args: { query: 'b' } },
      ],
      usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
      modelUsed: 'gpt-4o',
      provider: 'openai' as const,
    };

    const result = await functionCallProcessor.processWithFunctionCalls(initial, 'p', tools);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(result.functionCallsExecuted).toHaveLength(2);
    expect(openaiGen).toHaveBeenCalledTimes(1); // single continuation turn
    expect(result.finalText).toBe('final answer');
  });
});
