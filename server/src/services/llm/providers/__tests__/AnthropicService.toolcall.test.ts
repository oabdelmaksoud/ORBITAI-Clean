import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hold a handle to the mocked messages.create so each test can set its return value.
const mockCreate = vi.fn();

// Mock the Anthropic SDK: it is a default class export, constructed with `new`.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

// Mock the API key provider so getClient() does not throw before messages.create.
vi.mock('../../../apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    getApiKey: vi.fn().mockResolvedValue('test-key'),
  },
}));

import { AnthropicService } from '../AnthropicService.js';

const USAGE = { input_tokens: 10, output_tokens: 5 };

describe('AnthropicService tool use', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('parses tool_use blocks into functionCalls when tools are provided', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'get_weather', input: { city: 'Cairo' } }],
      usage: USAGE,
    });

    const service = new AnthropicService();
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'get_weather',
            description: 'Get the weather',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        ],
      },
    ];

    const result = await service.generateContent('hi', 'claude-3-5-sonnet', {
      tools,
    });

    expect(result.functionCalls).toEqual([{ name: 'get_weather', args: { city: 'Cairo' } }]);

    // Tools were converted to Anthropic input_schema format at the call site.
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Get the weather',
        input_schema: {
          type: 'object',
          properties: { city: { type: 'string' } },
        },
      },
    ]);
  });

  it('returns text with no functionCalls and tools=undefined on the no-tools path', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello there' }],
      usage: USAGE,
    });

    const service = new AnthropicService();
    const result = await service.generateContent('hi', 'claude-3-5-sonnet');

    expect(result.text).toBe('Hello there');
    expect(result.functionCalls).toBeUndefined();
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });

    // Backward compat: no tools => tools is undefined at the call site.
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.tools).toBeUndefined();
  });
});
