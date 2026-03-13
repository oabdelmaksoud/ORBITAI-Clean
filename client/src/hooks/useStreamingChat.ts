import { useState, useCallback, useRef } from 'react';

/**
 * Options for streaming chat hook
 */
export interface UseStreamingChatOptions {
    onChunk?: (chunk: string, fullText: string) => void;
    onComplete?: (fullText: string) => void;
    onError?: (error: Error) => void;
}

/**
 * Hook for handling streaming chat responses
 * Uses async generator pattern for processing SSE streams
 */
export function useStreamingChat(options: UseStreamingChatOptions = {}) {
    const { onChunk, onComplete, onError } = options;

    const [isStreaming, setIsStreaming] = useState(false);
    const [streamedText, setStreamedText] = useState('');
    const [error, setError] = useState<Error | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const startStream = useCallback(async (
        messages: Array<{ role: string; content: string }>,
        systemContext?: string
    ) => {
        setIsStreaming(true);
        setStreamedText('');
        setError(null);

        let fullText = '';

        try {
            // Stream from the backend
            const response = await fetch('/api/llm/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, systemContext }),
            });

            if (!response.ok) {
                throw new Error('Failed to start streaming');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            onComplete?.(fullText);
                            setIsStreaming(false);
                            return fullText;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullText += parsed.content;
                                setStreamedText(fullText);
                                onChunk?.(parsed.content, fullText);
                            }
                        } catch {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            onComplete?.(fullText);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Streaming failed');
            setError(error);
            onError?.(error);
        } finally {
            setIsStreaming(false);
        }

        return fullText;
    }, [onChunk, onComplete, onError]);

    const stopStream = useCallback(() => {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
    }, []);

    const resetStream = useCallback(() => {
        setStreamedText('');
        setError(null);
    }, []);

    return {
        isStreaming,
        streamedText,
        error,
        startStream,
        stopStream,
        resetStream,
    };
}
