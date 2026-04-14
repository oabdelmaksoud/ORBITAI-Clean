/**
 * useStreamingChat Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreamingChat } from '@src/hooks/useStreamingChat';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeStreamResponse(chunks: string[]) {
  let chunkIndex = 0;
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(encoder.encode(chunks[chunkIndex++]));
      } else {
        controller.close();
      }
    },
  });
  return {
    ok: true,
    body: readable,
  };
}

describe('useStreamingChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useStreamingChat());
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamedText).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('provides startStream function', () => {
    const { result } = renderHook(() => useStreamingChat());
    expect(typeof result.current.startStream).toBe('function');
  });

  it('provides stopStream function', () => {
    const { result } = renderHook(() => useStreamingChat());
    expect(typeof result.current.stopStream).toBe('function');
  });

  it('sets isStreaming to true when streaming starts', async () => {
    const chunks = ['data: {"content":"Hello"}\n\n', 'data: [DONE]\n\n'];
    mockFetch.mockResolvedValueOnce(makeStreamResponse(chunks));

    const { result } = renderHook(() => useStreamingChat());

    // Start stream without awaiting to check intermediate state
    act(() => {
      result.current.startStream([{ role: 'user', content: 'Hello' }]);
    });

    expect(result.current.isStreaming).toBe(true);
  });

  it('calls onError when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const onError = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onError }));

    await act(async () => {
      await result.current.startStream([{ role: 'user', content: 'Hello' }]);
    });

    expect(onError).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });

  it('calls onError when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, body: null });

    const onError = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onError }));

    await act(async () => {
      await result.current.startStream([{ role: 'user', content: 'Hello' }]);
    });

    expect(onError).toHaveBeenCalled();
  });

  it('accepts optional systemContext', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, body: null });

    const { result } = renderHook(() => useStreamingChat());

    await act(async () => {
      await result.current.startStream(
        [{ role: 'user', content: 'Hello' }],
        'You are a helpful assistant'
      );
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/llm/chat/stream',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('You are a helpful assistant'),
      })
    );
  });

  it('calls onChunk callback with streamed data', async () => {
    const chunks = ['data: {"content":"Hi"}\n\n', 'data: [DONE]\n\n'];
    mockFetch.mockResolvedValueOnce(makeStreamResponse(chunks));

    const onChunk = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onChunk }));

    await act(async () => {
      await result.current.startStream([{ role: 'user', content: 'Hello' }]);
    });

    expect(onChunk).toHaveBeenCalled();
  });

  it('calls onComplete when stream finishes', async () => {
    const chunks = ['data: {"content":"Done"}\n\n', 'data: [DONE]\n\n'];
    mockFetch.mockResolvedValueOnce(makeStreamResponse(chunks));

    const onComplete = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onComplete }));

    await act(async () => {
      await result.current.startStream([{ role: 'user', content: 'Hello' }]);
    });

    expect(onComplete).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });

  it('stopStream aborts the stream', () => {
    const { result } = renderHook(() => useStreamingChat());
    // Should not throw
    expect(() => act(() => { result.current.stopStream(); })).not.toThrow();
  });
});
