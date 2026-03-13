/**
 * Open-Source Speech API Service
 * Uses Whisper (STT) and OpenAI TTS (based on open-source models)
 */

import { apiRequest } from '@src/services/api.js';

export interface TranscriptionResponse {
  success: boolean;
  text: string;
  language?: string;
  error?: string;
}

export interface SynthesisResponse {
  success: boolean;
  audioUrl?: string;
  audioBlob?: Blob;
  error?: string;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
}

// Request queue with priority and retry logic
interface QueuedRequest {
  audioBlob: Blob;
  resolve: (value: TranscriptionResponse) => void;
  reject: (error: Error) => void;
  retries: number;
  priority: number;
  timestamp: number;
}

class TranscriptionQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private maxRetries = 3;
  private requestTimeout = 30000; // 30 seconds
  // Request deduplication: hash audio blob to detect duplicates
  private pendingRequests = new Map<string, Promise<TranscriptionResponse>>();
  private requestCache = new Map<string, { response: TranscriptionResponse; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute cache for duplicate requests

  // Generate hash for audio blob (for deduplication)
  private async generateBlobHash(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.slice(0, Math.min(1024, blob.size)).arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async add(audioBlob: Blob, priority: number = 0): Promise<TranscriptionResponse> {
    // Check for duplicate requests
    try {
      const blobHash = await this.generateBlobHash(audioBlob);

      // Check cache first
      const cached = this.requestCache.get(blobHash);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.response;
      }

      // Check if same request is already pending
      const pending = this.pendingRequests.get(blobHash);
      if (pending) {
        return pending;
      }

      // Create new request promise
      const requestPromise = new Promise<TranscriptionResponse>((resolve, reject) => {
        this.queue.push({
          audioBlob,
          resolve,
          reject,
          retries: 0,
          priority,
          timestamp: Date.now(),
        });

        // Sort by priority (higher first), then by timestamp
        this.queue.sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority;
          return a.timestamp - b.timestamp;
        });

        this.process(blobHash);
      });

      // Track pending request
      this.pendingRequests.set(blobHash, requestPromise);

      // Clean up after request completes
      requestPromise.finally(() => {
        this.pendingRequests.delete(blobHash);
      });

      return requestPromise;
    } catch (error) {
      // If hashing fails, proceed without deduplication
      return new Promise((resolve, reject) => {
        this.queue.push({
          audioBlob,
          resolve,
          reject,
          retries: 0,
          priority,
          timestamp: Date.now(),
        });
        this.queue.sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority;
          return a.timestamp - b.timestamp;
        });
        this.process();
      });
    }
  }

  private async process(blobHash?: string) {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const request = this.queue.shift()!;

    try {
      const result = await this.transcribeWithRetry(request.audioBlob, request.retries).catch((error) => {
        // Ensure all promise rejections are caught
        throw error;
      });

      // Cache successful result
      if (blobHash && result.success) {
        this.requestCache.set(blobHash, {
          response: result,
          timestamp: Date.now(),
        });

        // Clean old cache entries
        if (this.requestCache.size > 50) {
          const now = Date.now();
          for (const [key, value] of this.requestCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
              this.requestCache.delete(key);
            }
          }
        }
      }

      request.resolve(result);
    } catch (error: any) {
      // Check if error is a network error that won't be fixed by retrying
      const isNetworkError = error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('Network error') ||
        error?.name === 'TypeError';

      // For network errors, limit retries to 1 (fail fast)
      const maxRetriesForNetworkError = 1;
      const shouldRetry = isNetworkError
        ? request.retries < maxRetriesForNetworkError
        : request.retries < this.maxRetries;

      if (shouldRetry) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, request.retries) * 1000;
        request.retries++;

        // Use setTimeout to prevent stack overflow and ensure proper async handling
        setTimeout(() => {
          if (!this.processing && this.queue.length >= 0) {
            this.queue.unshift(request);
            this.processing = false;
            this.process(blobHash);
          } else {
            // Queue is busy, add to end
            this.queue.push(request);
            this.queue.sort((a, b) => {
              if (a.priority !== b.priority) return b.priority - a.priority;
              return a.timestamp - b.timestamp;
            });
            this.processing = false;
          }
        }, delay);
      } else {
        // Max retries reached or network error - RESOLVE with error response instead of rejecting
        // This prevents uncaught promise rejection errors
        const errorMessage = isNetworkError
          ? 'Network error: Unable to connect to transcription service. Please check if the server is running.'
          : (error?.message || 'Failed to transcribe audio');

        // Resolve with error response instead of rejecting to prevent uncaught promise rejection
        request.resolve({
          success: false,
          text: '',
          error: errorMessage,
        });
      }
    } finally {
      this.processing = false;
      // Process next item in queue
      if (this.queue.length > 0) {
        // Use setTimeout to prevent stack overflow
        setTimeout(() => this.process(), 0);
      }
    }
  }

  private async transcribeWithRetry(audioBlob: Blob, retryCount: number): Promise<TranscriptionResponse> {
    const formData = new FormData();
    const blobType = audioBlob.type || 'audio/webm';
    let extension = 'webm';
    if (blobType.includes('wav')) extension = 'wav';
    else if (blobType.includes('mp3') || blobType.includes('mpeg')) extension = 'mp3';
    else if (blobType.includes('ogg')) extension = 'ogg';
    else if (blobType.includes('m4a')) extension = 'm4a';
    else if (blobType.includes('flac')) extension = 'flac';

    formData.append('audio', audioBlob, `audio.${extension}`);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      // Make the transcription request
      // Note: Don't set Content-Type header - browser will set it automatically with boundary for FormData
      // Note: Don't use keepalive: true as it can cause issues with larger file uploads
      if (import.meta.env.DEV) {
        console.log('📤 [Speech API] Sending transcription request...', {
          blobSize: audioBlob.size,
          blobType: audioBlob.type,
          extension,
          formDataEntries: Array.from(formData.entries()).map(([k, v]) => ({
            key: k,
            value: v instanceof File ? `File(${v.name}, ${v.size} bytes, ${v.type})` : v
          }))
        });
      }

      // Use direct backend URL to bypass Vite proxy issues with multipart/form-data
      // In development, the proxy sometimes has issues with file uploads
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const transcribeUrl = `${apiBaseUrl}/api/speech/transcribe`;

      if (import.meta.env.DEV) {
        console.log('📤 [Speech API] Using URL:', transcribeUrl);
      }

      const response = await fetch(transcribeUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
        // Important: Don't set credentials for cross-origin requests to avoid CORS preflight issues
        mode: 'cors',
      });

      // Check if response supports streaming (chunked transfer)
      const contentType = response.headers.get('content-type');
      const isStreaming = contentType?.includes('text/event-stream') ||
        response.headers.get('transfer-encoding') === 'chunked';

      if (isStreaming && response.body) {
        // Handle streaming response (future enhancement)
        // For now, fall through to standard JSON parsing
      }

      clearTimeout(timeoutId);

      if (import.meta.env.DEV) {
        console.log('📡 [Speech API] Transcription response:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          ok: response.ok
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;

        // Detect API configuration errors (503 = service unavailable, usually means API key not configured)
        const isConfigError = response.status === 503 ||
          errorMessage.includes('not configured') ||
          errorMessage.includes('API key') ||
          errorMessage.includes('Admin Console');

        // Detect quota errors (429 = rate limit)
        const isQuotaError = response.status === 429 ||
          errorMessage.includes('quota') ||
          errorMessage.includes('billing') ||
          errorMessage.includes('rate limit');

        if (import.meta.env.DEV) {
          console.error('❌ [Speech API] Transcription failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorMessage,
            isConfigError,
            isQuotaError,
            errorData
          });
        }

        // Create enhanced error with type information
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.isConfigError = isConfigError;
        error.isQuotaError = isQuotaError;

        throw error;
      }

      const data = await response.json();

      if (import.meta.env.DEV) {
        console.log('✅ [Speech API] Transcription response data:', {
          success: data?.success,
          hasText: !!data?.text,
          textLength: data?.text?.length || 0,
          textPreview: data?.text?.substring(0, 100) || '(no text)',
          error: data?.error || '(no error)',
          fullResponse: data
        });
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Transcription request timed out');
      }

      // Enhance error message for network errors
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        const networkError = new Error('Network error: Unable to connect to transcription service. Please check if the server is running.');

        if (import.meta.env.DEV) {
          console.error('🌐 [Speech API] Network error during transcription:', {
            error: error.message,
            name: error.name,
            stack: error.stack
          });
        }

        throw networkError;
      }

      if (import.meta.env.DEV) {
        console.error('❌ [Speech API] Transcription error:', {
          error: error.message,
          name: error.name,
          stack: error.stack
        });
      }

      throw error;
    }
  }
}

const transcriptionQueue = new TranscriptionQueue();

/**
 * Transcribe audio to text using Whisper (open-source)
 * @param audioBlob - Audio file as Blob
 * @param priority - Request priority (higher = processed first)
 * @returns Transcription result
 */
export async function transcribeAudio(audioBlob: Blob, priority: number = 0): Promise<TranscriptionResponse> {
  try {
    // Wrap the queue promise to ensure all rejections are caught
    // Use Promise.resolve().then() to ensure proper error handling
    const queuePromise = transcriptionQueue.add(audioBlob, priority);

    const result = await queuePromise.catch((error: any) => {
      // Catch promise rejections from the queue
      // Only log non-network errors to reduce console noise when server isn't running
      const isNetworkError = error?.message?.includes('Network error') ||
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError';

      // Suppress console errors for network errors (expected when server isn't running)
      // Only log in dev mode for non-network errors
      if (import.meta.env.DEV && !isNetworkError) {
        console.error('[Speech API] Transcription queue promise rejected:', error);
      }

      const errorMessage = isNetworkError
        ? 'Network error: Unable to connect to transcription service. Please check if the server is running.'
        : (error.message || 'Failed to transcribe audio');

      // Return error response instead of throwing - this ensures promise resolves, not rejects
      return {
        success: false,
        text: '',
        error: errorMessage,
      };
    });

    // Ensure we always return a valid response
    return result;
  } catch (error: any) {
    console.error('[Speech API] Transcription error:', error);

    // Check if it's a network error
    const isNetworkError = error?.message?.includes('Network error') ||
      error?.message?.includes('Failed to fetch') ||
      error?.name === 'TypeError';

    const errorMessage = isNetworkError
      ? 'Network error: Unable to connect to transcription service. Please check if the server is running.'
      : (error.message || 'Failed to transcribe audio');

    // Return error response instead of throwing
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Synthesize text to speech using open-source TTS
 * @param text - Text to synthesize
 * @param voice - Voice ID (default: 'alloy')
 * @param language - Language code (default: 'en')
 * @returns Audio blob
 */
export async function synthesizeSpeech(
  text: string,
  voice: string = 'alloy',
  language: string = 'en'
): Promise<SynthesisResponse> {
  try {
    const response = await fetch('/api/speech/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice, language }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Failed to synthesize speech',
      };
    }

    // Get audio as blob
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      success: true,
      audioBlob,
      audioUrl,
    };
  } catch (error: any) {
    console.error('[Speech API] Synthesis error:', error);
    return {
      success: false,
      error: error.message || 'Failed to synthesize speech',
    };
  }
}

/**
 * Get available TTS voices
 * @returns List of available voices
 */
export async function getVoices(): Promise<{ success: boolean; voices?: Voice[]; error?: string }> {
  try {
    const response = await apiRequest<{ success: boolean; voices: Voice[] }>('/api/speech/voices', {
      method: 'GET',
    });

    return response;
  } catch (error: any) {
    console.error('[Speech API] Get voices error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get voices',
    };
  }
}
