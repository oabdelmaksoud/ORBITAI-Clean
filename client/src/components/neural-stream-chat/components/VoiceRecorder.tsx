/**
 * VoiceRecorder - Voice input component with waveform visualization
 * Extracted from NeuralStreamChat for maintainability
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';

export interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    className?: string;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
    onTranscription,
    onError,
    disabled = false,
    className = '',
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [audioLevel, setAudioLevel] = useState(0);
    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Check for Speech Recognition support
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        setIsSupported(!!SpeechRecognition);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecording();
        };
    }, []);

    // Audio level visualization
    const startAudioVisualization = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const updateLevel = () => {
                if (!analyserRef.current || !isRecording) return;

                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);

                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setAudioLevel(average / 255);

                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };

            updateLevel();
        } catch (error) {
            console.error('Failed to start audio visualization:', error);
        }
    }, [isRecording]);

    const stopAudioVisualization = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setAudioLevel(0);
    }, []);

    const startRecording = useCallback(() => {
        if (disabled || !isSupported) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            onError?.('Speech recognition is not supported in this browser');
            return;
        }

        try {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            let finalTranscript = '';
            let interimTranscript = '';

            recognitionRef.current.onresult = (event: any) => {
                interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                onError?.(event.error);
                stopRecording();
            };

            recognitionRef.current.onend = () => {
                if (finalTranscript.trim()) {
                    onTranscription(finalTranscript.trim());
                }
                setIsRecording(false);
                stopAudioVisualization();
            };

            recognitionRef.current.start();
            setIsRecording(true);
            startAudioVisualization();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
            onError?.(errorMessage);
        }
    }, [disabled, isSupported, onTranscription, onError, startAudioVisualization, stopAudioVisualization]);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsRecording(false);
        stopAudioVisualization();
    }, [stopAudioVisualization]);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    if (!isSupported) {
        return (
            <button
                type="button"
                disabled
                className={`p-2 rounded-lg text-gray-500 cursor-not-allowed ${className}`}
                title="Voice input not supported in this browser"
            >
                <MicOff className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            {/* Recording indicator */}
            {isRecording && (
                <div
                    className="absolute inset-0 rounded-lg bg-red-500/20 animate-pulse"
                    style={{
                        transform: `scale(${1 + audioLevel * 0.3})`,
                        transition: 'transform 0.1s ease-out'
                    }}
                />
            )}

            <button
                type="button"
                onClick={toggleRecording}
                disabled={disabled}
                className={`
          relative p-2 rounded-lg transition-all duration-200
          ${isRecording
                        ? 'text-red-400 bg-red-500/20 hover:bg-red-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
                {isRecording ? (
                    <Square className="w-5 h-5" />
                ) : (
                    <Mic className="w-5 h-5" />
                )}
            </button>

            {/* Waveform visualization */}
            {isRecording && (
                <div className="flex items-center gap-0.5 ml-2">
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-red-400 rounded-full transition-all duration-100"
                            style={{
                                height: `${8 + audioLevel * 16 * Math.sin((i + 1) * 0.5)}px`,
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default VoiceRecorder;
