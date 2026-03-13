import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeBase64, decodeAudioData, INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from '@src/services/audioUtils';
import { apiRequest } from '@src/services/api';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LiveSessionConfig {
  voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  systemInstruction?: string;
  apiKey?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  hasExistingMessages?: boolean; // Whether there are existing messages in the conversation
  initialWelcomeMessage?: string; // The welcome message to read when starting the conversation
  onVoiceChange?: (voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr') => void; // Callback when voice should change
  conversationId?: string; // Optional: Conversation ID to link transcriptions
  roomId?: string; // Optional: Room ID if in brainstorming room
}

export interface UseLiveSessionCallbacks {
  onTranscription?: (text: string) => void;
  onAIResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (status: ConnectionStatus) => void;
}

export const useLiveSession = (
  config: LiveSessionConfig = {},
  callbacks: UseLiveSessionCallbacks = {}
) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentVoiceRef = useRef<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'>(config.voiceName || 'Puck');

  // Update voice when config changes (but only if disconnected, as we can't change mid-session)
  useEffect(() => {
    if (config.voiceName && status === 'disconnected') {
      currentVoiceRef.current = config.voiceName;
    }
  }, [config.voiceName, status]);

  // Audio Contexts and Nodes
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Session Refs
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sessionRef = useRef<any>(null); // Store resolved session for sending text
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const initialGreetingSentRef = useRef<boolean>(false); // Track if initial greeting was sent
  const pendingTranscriptionRef = useRef<string>(''); // Accumulate transcription until turn complete
  const pendingAIResponseRef = useRef<string>(''); // Accumulate AI response until turn complete
  const lastAIResponseIdRef = useRef<string | null>(null); // Track last AI response ID to prevent duplicates
  const transcriptionsRef = useRef<Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date }>>([]); // Track all transcriptions

  const cleanup = useCallback(async () => {
    // Save transcriptions before cleanup if we have any and conversationId
    if (transcriptionsRef.current.length > 0 && config.conversationId) {
      try {
        const { apiRequest } = await import('@src/services/api');
        // Save transcriptions to conversation
        await apiRequest(`/api/transcriptions/conversations/${config.conversationId}`, {
          method: 'POST',
          body: JSON.stringify({
            transcriptions: transcriptionsRef.current.map(t => ({
              userText: t.role === 'user' ? t.text : undefined,
              aiText: t.role === 'assistant' ? t.text : undefined,
              timestamp: t.timestamp
            }))
          })
        });
        console.log('[LiveSession] Saved transcriptions to conversation');
      } catch (error) {
        console.error('[LiveSession] Error saving transcriptions:', error);
      }
    }

    // Stop all playing sources
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    audioSourcesRef.current.clear();

    // Clear session reference
    sessionRef.current = null;

    // Close session if possible (using the promise if resolved)
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
        try { session.close(); } catch (e) { console.error("Error closing session", e); }
      }).catch(() => { }); // Ignore error if session wasn't established
      sessionPromiseRef.current = null;
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Disconnect processor
    if (processorRef.current && inputContextRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close Audio Contexts
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    // Clear transcriptions
    transcriptionsRef.current = [];

    setStatus('disconnected');
    setIsMicOn(false);
    nextStartTimeRef.current = 0;
  }, [config.conversationId]);

  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      callbacks.onStateChange?.('connecting');

      // Get API key from config, environment, or fetch from backend
      let apiKey = config.apiKey || import.meta.env.VITE_GEMINI_API_KEY;

      // If no API key provided, try to fetch from backend (database)
      if (!apiKey) {
        try {
          const response = await apiRequest<{ success: boolean; apiKey?: string; message?: string }>('/api/config/gemini-api-key', {
            skipThrottle: true, // Skip throttling for API key fetch
            suppressAuthErrors: true // Suppress 401/403 errors (expected for guests)
          });

          if (response.success && response.apiKey) {
            apiKey = response.apiKey;
          } else {
            throw new Error(response.message || 'Gemini API key not found in database');
          }
        } catch (e: any) {
          console.error('Failed to fetch API key from backend:', e);
          throw new Error(e.message || 'Gemini API key is required. Please configure it in Settings → API Keys.');
        }
      }

      if (!apiKey) {
        throw new Error('Gemini API key is required. Please configure it in Settings → API Keys or set VITE_GEMINI_API_KEY environment variable.');
      }

      // Initialize Audio Contexts
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const inputCtx = new InputContextClass({ sampleRate: INPUT_SAMPLE_RATE });
      const outputCtx = new InputContextClass({ sampleRate: OUTPUT_SAMPLE_RATE });

      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      // Setup Analysers for visualization
      inputAnalyserRef.current = inputCtx.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current = outputCtx.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;

      // Connect output analyser to destination
      // We will route the audio sources through this analyser later
      const outputGain = outputCtx.createGain();
      outputGain.connect(outputAnalyserRef.current);
      outputAnalyserRef.current.connect(outputCtx.destination);

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;

      // Setup Input Chain
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(inputAnalyserRef.current);
      inputAnalyserRef.current.connect(processor);
      processor.connect(inputCtx.destination);

      const ai = new GoogleGenAI({ apiKey });

      // Setup Processor Callback
      processor.onaudioprocess = (e) => {
        if (!sessionPromiseRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);

        sessionPromiseRef.current.then((session) => {
          try {
            session.sendRealtimeInput({ media: pcmBlob });
          } catch (e) {
            console.error("Error sending input", e);
          }
        });
      };

      // Connect to Gemini Live
      // Build a strong system instruction that ensures AI speaks first
      const systemInstruction = config.systemInstruction || "You are a helpful, concise, and friendly AI assistant. When the session starts, you MUST speak first and greet the user.";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoiceRef.current } },
          },
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: async () => {
            console.log("Session Opened");
            setStatus('connected');
            setIsMicOn(true);
            setIsAISpeaking(false);
            nextStartTimeRef.current = outputCtx.currentTime;
            callbacks.onStateChange?.('connected');

            // Session setup logic moved to sessionPromise.then() to avoid race conditions
            if (import.meta.env.DEV) {
              console.log('[LiveSession] onopen fired - session setup managed by promise resolution');
            }

            // Note: Conversation history is included in systemInstruction
            // The system instruction already includes the brainstorming context and recent conversation
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle interruptions - user can interrupt AI while it's speaking
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              if (import.meta.env.DEV) {
                console.log("[LiveSession] User interrupted AI - stopping audio playback");
              }
              // Stop all currently playing audio sources
              audioSourcesRef.current.forEach(src => {
                try { src.stop(); } catch (e) { }
              });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = outputCtx.currentTime;
              // Note: Don't return here - continue processing as there might be user input to handle
              // The interruption means the user started speaking, so we should listen to them
            }

            // Handle user transcription - Gemini Live API sends it in inputTranscription.text
            // Accumulate transcription as user speaks, then send when turn is complete
            const inputTranscript = (message.serverContent as any)?.inputTranscription?.text;
            const userTurnComplete = (message.serverContent as any)?.turnComplete;

            if (inputTranscript && inputTranscript.trim()) {
              // Accumulate transcription (user might still be speaking)
              pendingTranscriptionRef.current = inputTranscript;

              if (import.meta.env.DEV) {
                console.log('[LiveSession] User transcription (partial):', inputTranscript);
              }
            }

            // When turn is complete, send the final transcription
            if (userTurnComplete && pendingTranscriptionRef.current.trim()) {
              const finalTranscription = pendingTranscriptionRef.current;
              pendingTranscriptionRef.current = ''; // Clear after sending

              if (import.meta.env.DEV) {
                console.log('[LiveSession] Turn complete, sending final transcription:', finalTranscription);
              }

              // Only send transcription if it's not the initial greeting we sent
              // The initial greeting triggers AI response but shouldn't be saved as user message
              if (initialGreetingSentRef.current) {
                // Check if this transcription matches our greeting (ignore it)
                const greetingMessages = [
                  "I'm ready to continue our conversation. What would you like to discuss?",
                  "Hello! I'm here to help you brainstorm and develop your project ideas. What would you like to work on today?"
                ];

                const isGreeting = greetingMessages.some(greeting =>
                  finalTranscription.toLowerCase().includes(greeting.toLowerCase().substring(0, 20))
                );

                if (!isGreeting) {
                  callbacks.onTranscription?.(finalTranscription);
                } else {
                  if (import.meta.env.DEV) {
                    console.log('[LiveSession] Ignoring initial greeting transcription');
                  }
                }
              } else {
                // Normal user transcription
                callbacks.onTranscription?.(finalTranscription);
              }
            }

            // Handle AI text responses (from modelTurn)
            // Accumulate AI responses as they come in, then send complete response when turn is complete
            const modelTurnParts = message.serverContent?.modelTurn?.parts?.filter(part => part.text);
            const aiTurnComplete = (message.serverContent as any)?.turnComplete;

            if (modelTurnParts && modelTurnParts.length > 0) {
              const aiText = modelTurnParts.map(part => part.text).join(' ');
              if (aiText.trim()) {
                // Accumulate AI response (might come in chunks)
                if (pendingAIResponseRef.current) {
                  // Append to existing response if it's a continuation
                  pendingAIResponseRef.current += ' ' + aiText;
                } else {
                  // Start new response
                  pendingAIResponseRef.current = aiText;
                }

                if (import.meta.env.DEV) {
                  console.log('[LiveSession] AI text response (partial):', aiText.substring(0, 50));
                }
              }
            }

            // When turn is complete, send the accumulated AI response
            if (aiTurnComplete && pendingAIResponseRef.current.trim()) {
              const finalAIResponse = pendingAIResponseRef.current.trim();
              pendingAIResponseRef.current = ''; // Clear after sending

              // Generate a unique ID for this response to prevent duplicates
              const responseId = `ai-response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

              // Only send if it's a new response (not a duplicate)
              if (lastAIResponseIdRef.current !== responseId) {
                lastAIResponseIdRef.current = responseId;

                if (import.meta.env.DEV) {
                  console.log('[LiveSession] Turn complete, sending final AI response:', finalAIResponse.substring(0, 100));
                }

                callbacks.onAIResponse?.(finalAIResponse);
              } else {
                if (import.meta.env.DEV) {
                  console.log('[LiveSession] Duplicate AI response detected, skipping');
                }
              }
            }

            // Debug: Log message structure to understand what we're receiving
            if (import.meta.env.DEV && message.serverContent) {
              const hasInputTranscription = !!(message.serverContent as any)?.inputTranscription;
              const hasModelTurn = !!message.serverContent?.modelTurn;
              if (hasInputTranscription || hasModelTurn) {
                console.log('[LiveSession] Message structure:', {
                  hasInputTranscription,
                  inputTranscript: hasInputTranscription ? (message.serverContent as any).inputTranscription?.text : null,
                  turnComplete: !!(message.serverContent as any)?.turnComplete,
                  hasModelTurn,
                  modelTurnParts: hasModelTurn ? message.serverContent.modelTurn?.parts?.length : 0
                });
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              try {
                const audioData = decodeBase64(base64Audio);
                // Ensure output context is running (mobile browsers suspend it)
                if (outputCtx.state === 'suspended') {
                  await outputCtx.resume();
                }

                // Ensure nextStartTime is at least current time
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);

                const audioBuffer = await decodeAudioData(audioData, outputCtx, OUTPUT_SAMPLE_RATE, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputGain); // Connect to gain/analyser chain

                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                  if (audioSourcesRef.current.size === 0) {
                    setIsAISpeaking(false);
                  }
                });

                source.start(nextStartTimeRef.current);
                audioSourcesRef.current.add(source);
                setIsAISpeaking(true);

                nextStartTimeRef.current += audioBuffer.duration;
              } catch (e) {
                console.error("Error processing audio message", e);
              }
            }
          },
          onclose: () => {
            console.log("Session Closed");
            cleanup();
            callbacks.onStateChange?.('disconnected');
          },
          onerror: (err) => {
            console.error("Session Error", err);
            const errorMsg = "Connection error occurred.";
            setError(errorMsg);
            callbacks.onError?.(errorMsg);
            cleanup();
            callbacks.onStateChange?.('error');
          }
        }
      });

      // Store the session promise BEFORE onopen fires
      sessionPromiseRef.current = sessionPromise;

      // Also try to store the session when it resolves
      sessionPromise.then((session) => {
        if (session) { // Don't check !sessionRef.current, always update/trigger
          sessionRef.current = session;
          if (import.meta.env.DEV) {
            console.log('[LiveSession] Session stored from promise resolution');
          }

          // Trigger initial greeting logic here (Safe place after connection)
          initialGreetingSentRef.current = false;

          try {
            if (config.initialWelcomeMessage && !config.hasExistingMessages) {
              // New conversation - Explicitly trigger AI to speak "Hello"
              // Use a neutral greeting with explicit instruction to wait
              if (typeof session.sendClientContent === 'function') {
                session.sendClientContent({
                  turns: [{ role: 'user', parts: [{ text: "Hello. Please greet me briefly and ask what I want to do. Do not generate any long lists or ideas yet." }] }],
                  turnComplete: true
                });
                if (import.meta.env.DEV) {
                  console.log('[LiveSession] ✅ Sent explicit neutral trigger (New Conversation)');
                }
                initialGreetingSentRef.current = true;
              } else {
                console.warn('[LiveSession] sendClientContent missing on session');
              }
            } else {
              // Existing conversation or no welcome asked
              if (!config.hasExistingMessages) {
                // If no existing messages but welcome disabled? Still good to start.
                // Assume generic start.
                if (typeof session.sendClientContent === 'function') {
                  session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: "Hello. Please greet me briefly." }] }],
                    turnComplete: true
                  });
                  if (import.meta.env.DEV) {
                    console.log('[LiveSession] ✅ Sent explicit "Hello" trigger (Generic Start)');
                  }
                  initialGreetingSentRef.current = true;
                }
              } else {
                if (import.meta.env.DEV) {
                  console.log('[LiveSession] Existing conversation detected - skipping welcome trigger');
                }
              }
            }
          } catch (e) {
            console.error('[LiveSession] Error sending initial trigger:', e);
          }
        }
      }).catch((err) => {
        console.warn('[LiveSession] Session promise rejected:', err);
      });

    } catch (err: any) {
      console.error("Failed to connect", err);
      const errorMsg = err.message || "Failed to start session";
      setError(errorMsg);
      callbacks.onError?.(errorMsg);
      cleanup();
      callbacks.onStateChange?.('error');
    }
  }, [cleanup, config, callbacks]);

  const disconnect = useCallback(() => {
    cleanup();
    callbacks.onStateChange?.('disconnected');
  }, [cleanup, callbacks]);

  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getAudioTracks();
      tracks.forEach(track => track.enabled = !track.enabled);
      setIsMicOn(prev => !prev);
    }
  }, []);

  const interrupt = useCallback(() => {
    if (audioSourcesRef.current.size > 0) {
      audioSourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) { }
      });
      audioSourcesRef.current.clear();
      setIsAISpeaking(false);
      nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;
      console.log('[LiveSession] Audio playback interrupted');
    }
  }, []);

  // Send text message to active voice session
  const sendText = useCallback(async (text: string) => {
    if (status !== 'connected') {
      console.warn('[LiveSession] Cannot send text - session not connected');
      return;
    }

    try {
      // Wait for session if it's still resolving
      let session = sessionRef.current;
      if (!session && sessionPromiseRef.current) {
        session = await sessionPromiseRef.current;
        sessionRef.current = session;
      }

      if (session) {
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: text }] }],
          turnComplete: true
        });
        if (import.meta.env.DEV) {
          console.log('[LiveSession] Sent text message:', text);
        }
      } else {
        console.warn('[LiveSession] Session not available for sending text');
      }
    } catch (error: any) {
      console.error('[LiveSession] Failed to send text to voice session:', error);
      callbacks.onError?.(error.message || 'Failed to send text to voice session');
    }
  }, [status, callbacks]);

  return {
    connect,
    disconnect,
    toggleMic,
    interrupt,
    sendText,
    status,
    isMicOn,
    isAISpeaking,
    error,
    inputAnalyser: inputAnalyserRef.current,
    outputAnalyser: outputAnalyserRef.current
  };
};

