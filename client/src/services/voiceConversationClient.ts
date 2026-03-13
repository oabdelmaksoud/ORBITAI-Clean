/**
 * Voice Conversation Client
 * WebSocket client for real-time voice conversations
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
// Convert HTTP/HTTPS to WS/WSS
const WS_BASE_URL = API_BASE_URL.replace(/^https?/, (match) => match === 'https' ? 'wss' : 'ws');

export type VoiceState = 'inactive' | 'connecting' | 'active' | 'recording' | 'processing' | 'error';

export interface VoiceClientCallbacks {
  onStateChange?: (state: VoiceState) => void;
  onTranscription?: (text: string, interim: boolean) => void;
  onAIResponse?: (text: string) => void;
  onAudioReceived?: (audioData: ArrayBuffer, mimeType: string) => void;
  onError?: (error: string) => void;
}

export class VoiceConversationClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private state: VoiceState = 'inactive';
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null; // Store the stream to reuse
  private audioChunks: Blob[] = [];
  private callbacks: VoiceClientCallbacks = {};
  private userId: string | null = null;
  private conversationId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(callbacks: VoiceClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Get current state
   */
  getState(): VoiceState {
    return this.state;
  }

  /**
   * Start voice session
   */
  async startSession(userId?: string, conversationId?: string): Promise<void> {
    if (this.state === 'active' || this.state === 'connecting') {
      throw new Error('Voice session already active');
    }

    this.userId = userId || null;
    this.conversationId = conversationId || null;
    this.setState('connecting');

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      // Store the stream for reuse
      this.mediaStream = stream;

      // Create initial MediaRecorder
      this.createMediaRecorder(stream);

      // Connect WebSocket
      await this.connectWebSocket();

      this.setState('active');
    } catch (error: any) {
      this.setState('error');
      const errorMessage = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
        ? 'Microphone access denied. Please allow microphone access and try again.'
        : error.message || 'Failed to start voice session';
      this.callbacks.onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Connect WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Generate session ID
      this.sessionId = crypto.randomUUID();

      // Build WebSocket URL
      const params = new URLSearchParams();
      if (this.sessionId) params.append('sessionId', this.sessionId);
      if (this.userId) params.append('userId', this.userId);
      if (this.conversationId) params.append('conversationId', this.conversationId);

      const wsUrl = `${WS_BASE_URL}/ws/voice?${params.toString()}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error('[VoiceClient] WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.warn('[VoiceClient] WebSocket closed:', event.code, event.reason);
        // Only attempt reconnect if we're in an active state and it wasn't a normal closure
        if ((this.state === 'active' || this.state === 'recording' || this.state === 'processing') && event.code !== 1000) {
          // Attempt to reconnect
          this.attemptReconnect();
        } else if (event.code === 1000) {
          // Normal closure - reset state
          this.setState('inactive');
        }
      };
    });
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('error');
      this.callbacks.onError?.('Connection lost. Please try starting a new session.');
      // Clean up resources
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      this.mediaRecorder = null;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`[VoiceClient] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      // Only reconnect if we're still in an active state and have a media stream
      if (this.state !== 'inactive' && this.state !== 'error' && this.mediaStream) {
        this.connectWebSocket().catch((error) => {
          console.error('[VoiceClient] Reconnection failed:', error);
          this.attemptReconnect();
        });
      } else {
        // Can't reconnect - clean up
        this.setState('error');
        this.callbacks.onError?.('Connection lost. Please try starting a new session.');
      }
    }, delay);
  }

  /**
   * Handle WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Check if it's binary (audio) or text (JSON)
      if (event.data instanceof ArrayBuffer) {
        // Binary audio data
        this.callbacks.onAudioReceived?.(event.data, 'audio/mpeg');
        this.playAudio(event.data);
      } else {
        // JSON message
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'connected':
            console.log('[VoiceClient] Connected:', message.sessionId);
            break;

          case 'recording_started':
            this.setState('recording');
            break;

          case 'recording_stopped':
            this.setState('active');
            break;

          case 'transcription':
            this.callbacks.onTranscription?.(message.text, message.interim || false);
            break;

          case 'ai_text':
            this.callbacks.onAIResponse?.(message.text);
            // Note: Don't set state to active here - wait for ai_audio
            // If ai_audio fails, the error handler will set state
            break;

          case 'ai_audio':
            // Decode base64 audio
            const audioData = this.base64ToArrayBuffer(message.audio);
            this.callbacks.onAudioReceived?.(audioData, message.mimeType || 'audio/mpeg');
            this.playAudio(audioData);
            // Return to active state after receiving audio response
            this.setState('active');
            break;

          case 'processing':
            this.setState('processing');
            break;

          case 'error':
            this.setState('error');
            this.callbacks.onError?.(message.message || 'An error occurred');
            break;

          case 'pong':
            // Heartbeat response
            break;

          case 'audio_received':
            // Server acknowledgment of received audio chunk - no action needed
            break;

          case 'response_complete':
            // Server finished processing - return to active state
            this.setState('active');
            break;

          default:
            console.warn('[VoiceClient] Unknown message type:', message.type);
        }
      }
    } catch (error: any) {
      console.error('[VoiceClient] Error handling message:', error);
    }
  }

  /**
   * Create a new MediaRecorder instance
   */
  private createMediaRecorder(stream: MediaStream): void {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 128000 // 128kbps for better quality
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.sendAudioChunk(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      console.log('[VoiceClient] MediaRecorder stopped.');
      this.audioChunks = [];
    };
  }

  /**
   * Start recording
   */
  startRecording(): void {
    if (!this.mediaStream || this.state !== 'active') {
      throw new Error('Voice session not active');
    }

    // Check WebSocket connection
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not open');
    }

    // Create a new MediaRecorder if needed (after previous stop)
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.createMediaRecorder(this.mediaStream);
    }

    this.audioChunks = [];
    this.mediaRecorder.start(100); // Collect data every 100ms
    this.sendControlMessage({ type: 'start_recording' });
    this.setState('recording');
  }

  /**
   * Stop recording and process
   */
  stopRecording(): void {
    if (!this.mediaRecorder) {
      return;
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    this.sendControlMessage({ type: 'end_speech' });
    this.setState('processing');
  }

  /**
   * Send audio chunk
   */
  private sendAudioChunk(audioBlob: Blob): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Convert blob to array buffer and send as binary
    audioBlob.arrayBuffer().then((buffer) => {
      this.ws?.send(buffer);
    });
  }

  /**
   * Send control message
   */
  private sendControlMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Play audio response
   */
  private playAudio(audioData: ArrayBuffer): void {
    // Use HTML5 Audio as primary method (more reliable for MP3)
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onloadeddata = () => {
      audio.play().catch((err) => {
        console.error('[VoiceClient] Error playing audio:', err);
        // Fallback to Web Audio API if HTML5 Audio fails
        this.playAudioWithWebAudio(audioData);
      });
    };

    audio.onended = () => {
      URL.revokeObjectURL(url);
    };

    audio.onerror = (error) => {
      console.error('[VoiceClient] Audio element error:', error);
      URL.revokeObjectURL(url);
      // Fallback to Web Audio API
      this.playAudioWithWebAudio(audioData);
    };
  }

  /**
   * Fallback: Play audio using Web Audio API
   */
  private playAudioWithWebAudio(audioData: ArrayBuffer): void {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContext.decodeAudioData(audioData.slice(0))
      .then((buffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
      })
      .catch((error) => {
        console.error('[VoiceClient] Web Audio API also failed:', error);
      });
  }

  /**
   * Set state and notify callbacks
   */
  private setState(state: VoiceState): void {
    if (this.state !== state) {
      this.state = state;
      this.callbacks.onStateChange?.(state);
    }
  }

  /**
   * Stop voice session
   */
  async stopSession(): Promise<void> {
    if (this.state === 'inactive') {
      return;
    }

    // Stop recording if active
    if (this.mediaRecorder && this.state === 'recording') {
      this.mediaRecorder.stop();
    }

    // Stop media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.mediaRecorder = null;

    // Close WebSocket with normal closure
    if (this.ws) {
      this.ws.close(1000, 'Session ended by user');
      this.ws = null;
    }

    this.setState('inactive');
    this.sessionId = null;
    this.audioChunks = [];
    this.reconnectAttempts = 0; // Reset reconnect attempts
    this.reconnectAttempts = 0;
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Send ping for keepalive
   */
  ping(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendControlMessage({ type: 'ping' });
    }
  }
}

