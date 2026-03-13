import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Voice state interface
 */
export interface VoiceState {
    isListening: boolean;
    transcript: string;
    error?: string;
}

// Web Speech API types
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
    onstart: () => void;
}

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export interface UseVoiceRecognitionOptions {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onResult?: (transcript: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
}

/**
 * Hook for voice recognition using Web Speech API
 */
export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
    const {
        language = 'en-US',
        continuous = true,
        interimResults = true,
        onResult,
        onError,
    } = options;

    const [state, setState] = useState<VoiceState>({
        isListening: false,
        transcript: '',
    });

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const isSupported = useRef(false);

    useEffect(() => {
        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            isSupported.current = true;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = continuous;
            recognitionRef.current.interimResults = interimResults;
            recognitionRef.current.lang = language;

            recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript;
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }

                const transcript = finalTranscript || interimTranscript;
                setState(prev => ({ ...prev, transcript }));
                onResult?.(transcript, !!finalTranscript);
            };

            recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
                const errorMessage = event.error || 'Speech recognition error';
                setState(prev => ({ ...prev, error: errorMessage, isListening: false }));
                onError?.(errorMessage);
            };

            recognitionRef.current.onend = () => {
                setState(prev => ({ ...prev, isListening: false }));
            };

            recognitionRef.current.onstart = () => {
                setState(prev => ({ ...prev, isListening: true, error: undefined }));
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [language, continuous, interimResults, onResult, onError]);

    const startListening = useCallback(() => {
        if (!isSupported.current) {
            setState(prev => ({ ...prev, error: 'Speech recognition not supported' }));
            onError?.('Speech recognition not supported');
            return;
        }

        try {
            recognitionRef.current?.start();
        } catch (error) {
            // Already started or error
            console.warn('Speech recognition start error:', error);
        }
    }, [onError]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const toggleListening = useCallback(() => {
        if (state.isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [state.isListening, startListening, stopListening]);

    const resetTranscript = useCallback(() => {
        setState(prev => ({ ...prev, transcript: '' }));
    }, []);

    return {
        ...state,
        isSupported: isSupported.current,
        startListening,
        stopListening,
        toggleListening,
        resetTranscript,
    };
}

/**
 * Text-to-Speech hook for AI responses
 */
export function useTextToSpeech() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const speak = useCallback((text: string, options?: Partial<SpeechSynthesisUtterance>) => {
        if (!('speechSynthesis' in window)) {
            console.warn('Text-to-speech not supported');
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options?.rate ?? 1;
        utterance.pitch = options?.pitch ?? 1;
        utterance.volume = options?.volume ?? 1;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        utteranceRef.current = utterance;
        speechSynthesis.speak(utterance);
    }, []);

    const stop = useCallback(() => {
        speechSynthesis.cancel();
        setIsSpeaking(false);
    }, []);

    const pause = useCallback(() => {
        speechSynthesis.pause();
    }, []);

    const resume = useCallback(() => {
        speechSynthesis.resume();
    }, []);

    return {
        isSpeaking,
        speak,
        stop,
        pause,
        resume,
    };
}
