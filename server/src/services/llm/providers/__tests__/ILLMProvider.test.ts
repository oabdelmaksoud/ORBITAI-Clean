import { describe, it, expect, vi } from 'vitest';
import type { ILLMProvider } from '../ILLMProvider.js';

// Mock the API key provider so constructing/using providers does not throw.
vi.mock('../../../apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    getApiKey: vi.fn().mockResolvedValue('test-key'),
  },
}));

import { DeepSeekService, deepSeekService } from '../DeepSeekService.js';

describe('ILLMProvider shared interface', () => {
  it('is structurally satisfied by a representative standard provider', () => {
    // Compile-time conformance check: if DeepSeekService drifts from the
    // shared interface, this assignment fails to type-check (caught by tsc).
    const provider: ILLMProvider = deepSeekService;

    // Runtime sanity: the three interface methods exist and are callable.
    expect(typeof provider.generateContent).toBe('function');
    expect(typeof provider.generateContentStream).toBe('function');
    expect(typeof provider.isAvailable).toBe('function');
  });

  it('yields content via generateContentStream for a previously-non-streaming provider', async () => {
    const service = new DeepSeekService();

    // Mock the underlying non-streaming call so no real SDK/network is hit.
    vi.spyOn(service, 'generateContent').mockResolvedValue({
      text: 'hello world',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });

    const chunks: string[] = [];
    for await (const chunk of service.generateContentStream('hi', 'deepseek-chat')) {
      chunks.push(chunk);
    }

    // The single-yield fallback emits the full text exactly once.
    expect(chunks).toEqual(['hello world']);
    expect(service.generateContent).toHaveBeenCalledOnce();
  });

  it('emits no chunks when generateContent returns empty text', async () => {
    const service = new DeepSeekService();

    vi.spyOn(service, 'generateContent').mockResolvedValue({
      text: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });

    const chunks: string[] = [];
    for await (const chunk of service.generateContentStream('hi', 'deepseek-chat')) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([]);
  });
});
