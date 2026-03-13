// useAISuggestions Hook
// Extracted from NeuralStreamChat.tsx for managing AI-powered input suggestions

import { useState, useEffect, useRef, useCallback } from 'react';

interface AISuggestion {
    id: string;
    text: string;
}

interface UseAISuggestionsOptions {
    /** Current input text */
    input: string;
    /** Whether user has already sent a message */
    hasUserMessage: boolean;
    /** Minimum input length before fetching suggestions */
    minInputLength?: number;
    /** Debounce delay in milliseconds */
    debounceMs?: number;
}

interface UseAISuggestionsReturn {
    suggestions: AISuggestion[];
    isLoading: boolean;
    clearSuggestions: () => void;
    refreshSuggestions: () => void;
}

/**
 * Custom hook for fetching AI-powered input suggestions
 * Provides real-time completion suggestions as user types
 */
export const useAISuggestions = ({
    input,
    hasUserMessage,
    minInputLength = 3,
    debounceMs = 500
}: UseAISuggestionsOptions): UseAISuggestionsReturn => {
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const fetchIdRef = useRef<number>(0);

    /**
     * Clear all suggestions
     */
    const clearSuggestions = useCallback(() => {
        setSuggestions([]);
    }, []);

    /**
     * Fetch suggestions for a given prefix
     */
    const fetchSuggestionForPrefix = useCallback(async (
        inputText: string,
        prefix: string,
        fetchId: number
    ) => {
        try {
            const response = await fetch('/api/llm/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Idea: "${inputText}"
Generate ONE short phrase (max 4 words) starting with "${prefix}" to enhance this idea.
Output ONLY the phrase string. No JSON.`,
                    history: [],
                    contextType: 'wizard',
                    preferFastModel: true,
                    maxTokens: 50
                })
            });

            const data = await response.json();

            // Check if this response corresponds to the latest keystroke
            if (fetchIdRef.current !== fetchId) return;

            if (data.success && data.response) {
                const text = data.response.trim().replace(/^["']|["']$/g, '');
                if (text && text.toLowerCase().startsWith(prefix)) {
                    setSuggestions(prev => {
                        // Avoid duplicates
                        if (prev.some(s => s.text === text)) return prev;
                        return [...prev, {
                            id: `ai-${Date.now()}-${Math.random()}`,
                            text: text
                        }];
                    });
                }
            }
        } catch (err) {
            // Ignore errors for individual suggestions
        }
    }, []);

    /**
     * Refresh suggestions for current input
     */
    const refreshSuggestions = useCallback(() => {
        if (!input || input.length < minInputLength || hasUserMessage) {
            clearSuggestions();
            return;
        }

        setIsLoading(true);
        setSuggestions([]);

        const fetchId = Date.now();
        fetchIdRef.current = fetchId;

        const prefixes = ['with', 'for', 'that'];

        // Fire 3 parallel requests
        prefixes.forEach(prefix => {
            fetchSuggestionForPrefix(input, prefix, fetchId);
        });

        // Turn off the spinner after a short timeout
        setTimeout(() => setIsLoading(false), 800);
    }, [input, minInputLength, hasUserMessage, clearSuggestions, fetchSuggestionForPrefix]);

    // Debounced effect for fetching suggestions
    useEffect(() => {
        // Only fetch suggestions before first message and when input has content
        if (hasUserMessage || !input || input.length < minInputLength) {
            clearSuggestions();
            return;
        }

        // Clear existing timeout
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Debounce the API call
        debounceRef.current = setTimeout(() => {
            refreshSuggestions();
        }, debounceMs);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [input, hasUserMessage, minInputLength, debounceMs, clearSuggestions, refreshSuggestions]);

    return {
        suggestions,
        isLoading,
        clearSuggestions,
        refreshSuggestions,
    };
};

export default useAISuggestions;
