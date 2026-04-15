/**
 * Speech Provider Service
 * Supports multiple providers for Speech-to-Text (STT) and Text-to-Speech (TTS)
 * Uses the LLM router's API key management system
 */

import { apiKeyProvider } from './apiKeyProvider.service.js';
import { logger } from '../utils/logger.js';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { createReadStream, readFileSync } from 'fs';
import { createHash } from 'crypto';

export type SpeechProvider = 'openai' | 'google' | 'azure' | 'anthropic';

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
}

export interface SynthesisResult {
  audioBuffer: Buffer;
  mimeType: string;
}

// LRU Cache for transcription results
interface CacheEntry {
  text: string;
  language?: string;
  confidence?: number;
  timestamp: number;
  accessCount: number;
}

class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private accessOrder: K[];

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.set(key, value);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    } else {
      // Add new
      if (this.cache.size >= this.maxSize) {
        // Remove least recently used
        const lruKey = this.accessOrder.shift();
        if (lruKey) {
          this.cache.delete(lruKey);
        }
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}

class SpeechProviderService {
  // Transcription cache (hash-based, LRU)
  private transcriptionCache = new LRUCache<string, CacheEntry>(100);
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Generate hash for audio file (for caching)
   */
  private async generateAudioHash(audioFilePath: string): Promise<string> {
    const audioData = readFileSync(audioFilePath);
    // Use first 1KB + last 1KB + file size for quick hash (similar audio will have similar hash)
    const sampleSize = Math.min(1024, Math.floor(audioData.length / 2));
    const sample = Buffer.concat([
      audioData.slice(0, sampleSize),
      audioData.slice(-sampleSize),
      Buffer.from(audioData.length.toString())
    ]);
    return createHash('sha256').update(sample).digest('hex');
  }

  /**
   * Get cached transcription if available
   */
  private getCachedTranscription(hash: string): TranscriptionResult | null {
    const cached = this.transcriptionCache.get(hash);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.CACHE_TTL) {
        cached.accessCount++;
        logger.info(`[Speech] Cache hit for audio hash ${hash.substring(0, 8)}... (age: ${Math.round(age / 1000)}s)`);
        return {
          text: cached.text,
          language: cached.language,
          confidence: cached.confidence,
        };
      } else {
        // Expired, remove from cache
        this.transcriptionCache.set(hash, cached as any); // Will be removed by LRU
      }
    }
    return null;
  }

  /**
   * Cache transcription result
   */
  private cacheTranscription(hash: string, result: TranscriptionResult): void {
    this.transcriptionCache.set(hash, {
      text: result.text,
      language: result.language,
      confidence: result.confidence,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  /**
   * Get available providers based on configured API keys
   */
  async getAvailableProviders(): Promise<SpeechProvider[]> {
    const providers: SpeechProvider[] = [];

    // Check OpenAI
    const openaiKey = await apiKeyProvider.getApiKey('openai', true);
    if (openaiKey) providers.push('openai');

    // Check Google/Gemini
    const geminiKey = await apiKeyProvider.getApiKey('gemini', true);
    if (geminiKey) providers.push('google');

    // Check Azure
    const azureKey = await apiKeyProvider.getApiKey('azure', true);
    if (azureKey) providers.push('azure');

    return providers;
  }

  /**
   * Get preferred provider (Google/Gemini > OpenAI > Azure)
   * Returns providers that are actually implemented
   * Note: Gemini is preferred when enabled in admin console
   */
  async getPreferredProvider(): Promise<SpeechProvider | null> {
    const providers = await this.getAvailableProviders();
    if (providers.length === 0) return null;

    // Priority: Google/Gemini first (user enabled it), then OpenAI, then Azure
    if (providers.includes('google')) return 'google'; // Gemini 2.5 supports speech - preferred when enabled
    if (providers.includes('openai')) return 'openai';
    if (providers.includes('azure')) return 'azure';

    return providers[0];
  }

  /**
   * Transcribe audio using the best available provider with automatic fallback
   */
  async transcribeAudio(
    audioFilePath: string,
    mimeType: string,
    provider?: SpeechProvider
  ): Promise<TranscriptionResult> {
    // Check cache first
    try {
      const audioHash = await this.generateAudioHash(audioFilePath);
      const cached = this.getCachedTranscription(audioHash);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // If hash generation fails, continue without cache
      logger.warn('[Speech] Failed to generate audio hash for caching:', error);
    }

    const availableProviders = await this.getAvailableProviders();

    // Filter to implemented providers (OpenAI and Google/Gemini)
    const implementedProviders = availableProviders.filter(p => p === 'openai' || p === 'google');

    if (implementedProviders.length === 0) {
      throw new Error('No implemented speech provider available. Please configure OpenAI or Gemini API key via Admin Console → Settings → API Keys.');
    }

    // If provider is specified, try that first (if implemented), otherwise use preferred order
    // Priority: OpenAI first (Whisper is more accurate and less prone to hallucinations), then Gemini as fallback
    const providersToTry = provider && implementedProviders.includes(provider)
      ? [provider, ...implementedProviders.filter(p => p !== provider)]
      : implementedProviders.sort((a, b) => {
          // Prefer OpenAI over Google for transcription (Whisper is more accurate and less hallucinatory)
          if (a === 'openai' && b === 'google') return -1;
          if (a === 'google' && b === 'openai') return 1;
          return 0;
        });

    let lastError: Error | null = null;
    const circuitBreaker = new Map<SpeechProvider, { failures: number; lastFailure: number }>();
    const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 failures
    const CIRCUIT_BREAKER_RESET_TIME = 60000; // Reset after 60 seconds

    // Try each provider until one works
    for (const selectedProvider of providersToTry) {
      // Check circuit breaker
      const breaker = circuitBreaker.get(selectedProvider);
      if (breaker) {
        const timeSinceLastFailure = Date.now() - breaker.lastFailure;
        if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD && timeSinceLastFailure < CIRCUIT_BREAKER_RESET_TIME) {
          logger.warn(`[Speech] Circuit breaker open for ${selectedProvider}, skipping`);
          continue; // Skip this provider
        } else if (timeSinceLastFailure >= CIRCUIT_BREAKER_RESET_TIME) {
          // Reset circuit breaker
          circuitBreaker.delete(selectedProvider);
        }
      }

      try {
        logger.info(`[Speech] Attempting transcription with ${selectedProvider}`);

        // Set timeout for transcription (30 seconds)
        const timeoutPromise = new Promise<TranscriptionResult>((_, reject) => {
          setTimeout(() => reject(new Error('Transcription timeout')), 30000);
        });

        let transcriptionPromise: Promise<TranscriptionResult>;
        switch (selectedProvider) {
          case 'openai':
            transcriptionPromise = this.transcribeWithOpenAI(audioFilePath, mimeType);
            break;
          case 'google':
            transcriptionPromise = this.transcribeWithGoogle(audioFilePath, mimeType);
            break;
          case 'azure':
            // Azure not implemented yet
            throw new Error('Azure Speech Services is not yet implemented. Please use OpenAI.');
          default:
            continue; // Skip unsupported providers
        }

        // Race between transcription and timeout
        const result = await Promise.race([transcriptionPromise, timeoutPromise]);

        // Success - reset circuit breaker and cache result
        circuitBreaker.delete(selectedProvider);

        // Cache the result
        try {
          const audioHash = await this.generateAudioHash(audioFilePath);
          this.cacheTranscription(audioHash, result);
        } catch (error) {
          // Ignore cache errors
        }

        return result;
      } catch (error: unknown) {
        lastError = error;

        // Update circuit breaker
        const breaker = circuitBreaker.get(selectedProvider) || { failures: 0, lastFailure: 0 };
        breaker.failures++;
        breaker.lastFailure = Date.now();
        circuitBreaker.set(selectedProvider, breaker);

        const isQuotaError = error?.status === 429 ||
                            error?.message?.includes('quota') ||
                            error?.message?.includes('billing') ||
                            error?.code === 'rate_limit_exceeded';
        const isTimeoutError = error?.message?.includes('timeout');

        if (isQuotaError) {
          logger.error(`[Speech] ${selectedProvider} quota exceeded: ${error.message}`);
          // For quota errors, try other implemented providers if available
          if (providersToTry.length > 1) {
            logger.info(`[Speech] ${selectedProvider} quota exceeded, trying next provider...`);
            continue; // Try next provider
          } else {
            // No other providers available, throw error
            throw new Error(`${selectedProvider} quota exceeded. Please check your ${selectedProvider} billing or wait for quota reset. Error: ${error.message}`);
          }
        } else if (isTimeoutError) {
          logger.warn(`[Speech] ${selectedProvider} request timed out: ${error.message}`);
          // For timeout errors, try other providers if available
          if (providersToTry.length > 1) {
            continue;
          }
        } else {
          logger.warn(`[Speech] ${selectedProvider} failed: ${error.message}`);
          // For other errors, still try other providers if available
          if (providersToTry.length > 1) {
          continue;
          }
        }
      }
    }

    // All providers failed
    throw lastError || new Error('All speech providers failed. Please check your API keys and quotas.');
  }

  /**
   * Synthesize speech using the best available provider with automatic fallback
   */
  async synthesizeSpeech(
    text: string,
    voice: string = 'alloy',
    language: string = 'en',
    provider?: SpeechProvider
  ): Promise<SynthesisResult> {
    const availableProviders = await this.getAvailableProviders();

    // Filter to implemented providers (OpenAI and Google/Gemini)
    const implementedProviders = availableProviders.filter(p => p === 'openai' || p === 'google');

    if (implementedProviders.length === 0) {
      throw new Error('No implemented speech provider available. Please configure OpenAI or Gemini API key via Admin Console → Settings → API Keys.');
    }

    // If provider is specified, try that first (if implemented), otherwise use preferred order
    // Priority: Gemini first (user enabled it in admin console), then OpenAI as fallback
    const providersToTry = provider && implementedProviders.includes(provider)
      ? [provider, ...implementedProviders.filter(p => p !== provider)]
      : implementedProviders.sort((a, b) => {
          // Prefer Gemini (Google) over OpenAI if both available (user enabled Gemini TTS)
          if (a === 'google' && b === 'openai') return -1;
          if (a === 'openai' && b === 'google') return 1;
          return 0;
        });

    let lastError: Error | null = null;

    // Try each provider until one works
    for (const selectedProvider of providersToTry) {
      try {
        // Map voice to provider-specific voice if needed
        let providerVoice = voice;

        // If voice is a Gemini voice but we're using OpenAI, map it
        const geminiVoices = ['bright', 'upbeat', 'informative', 'youthful', 'warm', 'professional'];
        if (selectedProvider === 'openai' && geminiVoices.includes(voice)) {
          const voiceMap: Record<string, string> = {
            'bright': 'nova',
            'upbeat': 'echo',
            'informative': 'alloy',
            'youthful': 'shimmer',
            'warm': 'fable',
            'professional': 'onyx'
          };
          providerVoice = voiceMap[voice] || 'alloy';
          logger.info(`[Speech] Mapped Gemini voice '${voice}' to OpenAI voice '${providerVoice}'`);
        }
        // If voice is an OpenAI voice but we're using Gemini, map it (handled in synthesizeWithGoogle)

        logger.info(`[Speech] Attempting synthesis with ${selectedProvider} (voice: ${providerVoice})`);

        switch (selectedProvider) {
          case 'openai':
            return await this.synthesizeWithOpenAI(text, providerVoice, language);
          case 'google':
            return await this.synthesizeWithGoogle(text, voice, language); // Google handles mapping internally
          case 'azure':
            // Azure not implemented yet
            throw new Error('Azure Speech Services is not yet implemented. Please use OpenAI.');
          default:
            continue; // Skip unsupported providers
        }
      } catch (error: unknown) {
        lastError = error;
        const isQuotaError = error?.status === 429 ||
                            error?.message?.includes('quota') ||
                            error?.message?.includes('billing') ||
                            error?.code === 'rate_limit_exceeded';

        if (isQuotaError) {
          logger.error(`[Speech] ${selectedProvider} quota exceeded: ${error.message}`);
          // For quota errors, try other implemented providers if available
          if (providersToTry.length > 1) {
            logger.info(`[Speech] ${selectedProvider} quota exceeded, trying next provider...`);
            continue; // Try next provider
          } else {
            // No other providers available, throw error
            throw new Error(`${selectedProvider} quota exceeded. Please check your ${selectedProvider} billing or wait for quota reset. Error: ${error.message}`);
          }
        } else {
          logger.warn(`[Speech] ${selectedProvider} failed: ${error.message}`);
          // For non-quota errors, still try other providers if available
          continue;
        }
      }
    }

    // All providers failed
    throw lastError || new Error('All speech providers failed. Please check your API keys and quotas.');
  }

  /**
   * OpenAI Whisper transcription
   */
  private async transcribeWithOpenAI(audioFilePath: string, mimeType: string): Promise<TranscriptionResult> {
    const apiKey = await apiKeyProvider.getApiKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const openai = new OpenAI({ apiKey });
      const fileStream = createReadStream(audioFilePath);

      // Enhanced prompt with strict rules to prevent hallucinations
      const enhancedPrompt = `You are a speech-to-text transcription service. Your ONLY job is to transcribe the audio exactly as spoken.

CRITICAL RULES:
- ONLY transcribe words that you can clearly hear in the audio
- DO NOT add words, phrases, or sentences that are not in the audio
- DO NOT make assumptions or fill in gaps
- DO NOT add commentary, explanations, or interpretations
- If the audio is unclear or silent, return minimal text or empty string
- If you cannot clearly hear what was said, transcribe only what you are certain about
- DO NOT hallucinate or invent words

This is a live conversation about project ideas, software development, brainstorming, and technical discussions.
The speaker may use technical terms, programming concepts, project management terminology, and casual conversation.
Transcribe ONLY what you actually hear with proper punctuation, capitalization, and formatting.`;

      const transcription = await openai.audio.transcriptions.create({
        file: fileStream as any,
        model: 'whisper-1',
        language: 'en', // Language hint for better accuracy
        response_format: 'verbose_json', // Get detailed response with segments and timestamps
        prompt: enhancedPrompt,
        temperature: 0, // Deterministic, accurate transcriptions
        // Additional parameters for better accuracy
        timestamp_granularities: ['word'], // Get word-level timestamps for better analysis
      });

      // Extract confidence from segments if available
      let confidence: number | undefined;
      if ((transcription as any).segments && Array.isArray((transcription as any).segments)) {
        const segments = (transcription as any).segments;
        const confidences = segments
          .map((s: any) => s.avg_logprob || s.no_speech_prob ? 1 - s.no_speech_prob : undefined)
          .filter((c: any) => c !== undefined);
        if (confidences.length > 0) {
          confidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
        }
      }

      return {
        text: transcription.text,
        language: (transcription as any).language || 'en',
        confidence: confidence,
        segments: (transcription as any).segments?.map((seg: any) => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
          confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined,
        })),
      };
    } catch (error: unknown) {
      // Re-throw with more context
      if (error?.status === 429 || error?.message?.includes('quota')) {
        const enhancedError = new Error(`OpenAI quota exceeded: ${error.message}`);
        (enhancedError as any).status = 429;
        (enhancedError as any).code = 'rate_limit_exceeded';
        throw enhancedError;
      }
      throw error;
    }
  }

  /**
   * OpenAI TTS synthesis
   */
  private async synthesizeWithOpenAI(text: string, voice: string, language: string): Promise<SynthesisResult> {
    const apiKey = await apiKeyProvider.getApiKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const openai = new OpenAI({ apiKey });
      const maxLength = 4000;
      const textToSpeak = text.length > maxLength ? text.substring(0, maxLength) : text;

      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
        input: textToSpeak,
        response_format: 'mp3',
        speed: 1.0,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return {
        audioBuffer: buffer,
        mimeType: 'audio/mpeg',
      };
    } catch (error: unknown) {
      // Re-throw with more context for quota errors
      if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('billing')) {
        const enhancedError = new Error(`OpenAI quota exceeded: ${error.message}`);
        (enhancedError as any).status = 429;
        (enhancedError as any).code = 'rate_limit_exceeded';
        throw enhancedError;
      }
      throw error;
    }
  }

  /**
   * Google Gemini Speech-to-Text transcription
   * Uses Gemini 2.5's native audio transcription capabilities
   */
  private async transcribeWithGoogle(audioFilePath: string, mimeType: string): Promise<TranscriptionResult> {
    const apiKey = await apiKeyProvider.getApiKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const genAI = new GoogleGenAI({ apiKey });

      // Read audio file
      const audioData = readFileSync(audioFilePath);
      const audioBase64 = audioData.toString('base64');

      // Enhanced prompt for Google transcription - strict about only transcribing actual speech
      const enhancedPrompt = `You are a speech-to-text transcription service. Your ONLY job is to transcribe the audio exactly as spoken.

CRITICAL RULES:
- ONLY transcribe words that you can clearly hear in the audio
- DO NOT add words, phrases, or sentences that are not in the audio
- DO NOT make assumptions or fill in gaps
- DO NOT add commentary, explanations, or interpretations
- If the audio is unclear or silent, return an empty string or minimal text
- If you cannot clearly hear what was said, transcribe only what you are certain about
- DO NOT hallucinate or invent words

This is a live conversation about project ideas, software development, brainstorming, and technical discussions.
Transcribe ONLY what you actually hear with proper punctuation and capitalization.`;

      // Normalize MIME type for Gemini (it may be more strict about format)
      // Gemini supports: audio/mp3, audio/mpeg, audio/wav, audio/flac, audio/ogg, audio/webm
      let normalizedMimeType = mimeType;
      if (mimeType === 'audio/webm' || mimeType === 'audio/webm;codecs=opus') {
        // Gemini may not support webm directly, but we'll try
        normalizedMimeType = 'audio/webm';
      } else if (mimeType.includes('webm')) {
        normalizedMimeType = 'audio/webm';
      } else if (mimeType.includes('wav')) {
        normalizedMimeType = 'audio/wav';
      } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
        normalizedMimeType = 'audio/mp3';
      } else if (mimeType.includes('ogg')) {
        normalizedMimeType = 'audio/ogg';
      } else if (mimeType.includes('flac')) {
        normalizedMimeType = 'audio/flac';
      }

      // Use Gemini's audio transcription with inline data
      // Strict prompt to prevent hallucinations
      const strictPrompt = enhancedPrompt + `

Return ONLY the transcribed text. If the audio is unclear, silent, or contains only background noise, return an empty string. Do not invent words or add content that is not in the audio.`;

      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            text: strictPrompt
          },
          {
            inlineData: {
              data: audioBase64,
              mimeType: normalizedMimeType,
            },
          },
        ],
        config: {
          temperature: 0, // Deterministic, accurate transcriptions - lower temperature reduces hallucinations
          topP: 0.8, // Lower topP to reduce randomness
        },
      });

      // Extract text from response - the result should have a .text property directly
      let transcription = '';

      try {
        // The newer SDK returns result.text directly
        if (result.text) {
          transcription = result.text;
        } else if (typeof result === 'string') {
          transcription = result;
        } else {
          // Try to extract from candidates (fallback)
          const candidates = (result as any).candidates;
          if (candidates && candidates.length > 0) {
            const content = candidates[0].content;
            if (content?.parts && content.parts.length > 0) {
              transcription = content.parts.map((p: any) => p.text || '').join(' ');
            } else if (content?.text) {
              transcription = content.text;
            }
          }
        }
      } catch (error: unknown) {
        logger.error('[Speech] Error extracting transcription from Gemini response:', error);
        throw new Error(`Failed to extract transcription from Gemini response: ${error.message}`);
      }

      if (!transcription || transcription.trim().length === 0) {
        // Check if the audio file might be too small or contain only silence
        const audioData = readFileSync(audioFilePath);
        if (audioData.length < 2048) { // Less than 2KB
          logger.warn(`[Speech] Audio file too small (${audioData.length} bytes) - likely contains only silence`);
        }
        throw new Error('Gemini returned empty transcription. The audio may be too short or contain only silence. Please try speaking again.');
      }

      // Extract confidence if available from response metadata
      let confidence: number | undefined;
      try {
        const candidates = (result as any).candidates;
        if (candidates && candidates.length > 0) {
          const finishReason = candidates[0].finishReason;
          // If finish reason is STOP, transcription is likely high confidence
          if (finishReason === 'STOP') {
            confidence = 0.9; // High confidence for successful completion
          }
        }
      } catch (e) {
        // Ignore confidence extraction errors
      }

      return {
        text: transcription.trim(),
        language: 'en', // Gemini auto-detects, but defaulting to English
        confidence: confidence,
      };
    } catch (error: unknown) {
      // Re-throw with more context
      if (error?.status === 429 || error?.message?.includes('quota')) {
        const enhancedError = new Error(`Gemini quota exceeded: ${error.message}`);
        (enhancedError as any).status = 429;
        (enhancedError as any).code = 'rate_limit_exceeded';
        throw enhancedError;
      }
      throw error;
    }
  }

  /**
   * Google Gemini Text-to-Speech synthesis
   * Uses Gemini 2.5's native audio generation capabilities
   */
  private async synthesizeWithGoogle(text: string, voice: string, language: string): Promise<SynthesisResult> {
    const apiKey = await apiKeyProvider.getApiKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const genAI = new GoogleGenAI({ apiKey });

      // Map voice to Gemini voice style if needed
      // Gemini voices: bright, upbeat, informative, youthful, warm, professional
      // If voice is an OpenAI voice, map to closest Gemini equivalent
      let geminiVoiceStyle = voice;
      if (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice)) {
        // Map OpenAI voices to Gemini styles
        const voiceMap: Record<string, string> = {
          'alloy': 'informative',
          'nova': 'bright',
          'echo': 'upbeat',
          'shimmer': 'youthful',
          'onyx': 'professional',
          'fable': 'warm'
        };
        geminiVoiceStyle = voiceMap[voice] || 'informative';
      }

      // Limit text length
      const maxLength = 4000;
      const textToSpeak = text.length > maxLength ? text.substring(0, maxLength) : text;

      // Generate speech - Gemini should return audio directly
      // Note: Voice style can be specified in the prompt for Gemini
      const prompt = geminiVoiceStyle !== 'informative'
        ? `Generate natural speech audio for this text with a ${geminiVoiceStyle} voice style: "${textToSpeak}"`
        : textToSpeak;

      // Use the models API directly (newer SDK pattern)
      // Try TTS-specific model first, fallback to standard model
      let result;
      try {
        result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ text: prompt }],
        });
      } catch {
        // Fallback to standard model with audio response format
        result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ text: prompt }],
          config: {
            responseMimeType: 'audio/mpeg',
          },
        });
      }

      // Gemini 2.5 returns audio as inline data in the response
      // Check different possible response structures
      let audioBuffer: Buffer;

      // Try to extract audio from response
      const response = result.response || result;
      const candidates = (response as any).candidates || (result as any).candidates;

      if (candidates && candidates.length > 0) {
        const parts = candidates[0].content?.parts || candidates[0].parts;
        if (parts && parts.length > 0) {
          const inlineData = parts.find((part: any) => part.inlineData);
          if (inlineData?.inlineData?.data) {
            audioBuffer = Buffer.from(inlineData.inlineData.data, 'base64');
          } else {
            // Fallback: check if response.text exists (might be text if audio not available)
            throw new Error('Gemini returned text instead of audio. Audio generation may not be available in this model version.');
          }
        } else {
          throw new Error('Gemini response format unexpected. Audio generation may not be available.');
        }
      } else {
        throw new Error('Gemini did not return audio data. Please check your API key and model availability.');
      }

      return {
        audioBuffer,
        mimeType: 'audio/mpeg',
      };
    } catch (error: unknown) {
      // Re-throw with more context
      if (error?.status === 429 || error?.message?.includes('quota')) {
        const enhancedError = new Error(`Gemini quota exceeded: ${error.message}`);
        (enhancedError as any).status = 429;
        (enhancedError as any).code = 'rate_limit_exceeded';
        throw enhancedError;
      }
      throw error;
    }
  }

  /**
   * Azure Speech Services transcription
   */
  private async transcribeWithAzure(audioFilePath: string, mimeType: string): Promise<TranscriptionResult> {
    // Azure Speech Services implementation would go here
    throw new Error('Azure Speech Services not yet implemented. Please use OpenAI or Google.');
  }

  /**
   * Azure Speech Services synthesis
   */
  private async synthesizeWithAzure(text: string, voice: string, language: string): Promise<SynthesisResult> {
    // Azure Speech Services implementation would go here
    throw new Error('Azure Speech Services not yet implemented. Please use OpenAI or Google.');
  }

  /**
   * Get available voices for a provider
   */
  async getVoices(provider?: SpeechProvider): Promise<Array<{ id: string; name: string; language: string; gender?: string }>> {
    const selectedProvider = provider || await this.getPreferredProvider();

    if (!selectedProvider) {
      return [];
    }

    switch (selectedProvider) {
      case 'openai':
        return [
          { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral' },
          { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
          { id: 'fable', name: 'Fable', language: 'en', gender: 'neutral' },
          { id: 'onyx', name: 'Onyx', language: 'en', gender: 'male' },
          { id: 'nova', name: 'Nova', language: 'en', gender: 'female' },
          { id: 'shimmer', name: 'Shimmer', language: 'en', gender: 'female' },
        ];
      case 'google':
        // Gemini 2.5 TTS voices (30 available voice styles)
        return [
          { id: 'bright', name: 'Bright', language: 'en', gender: 'neutral' },
          { id: 'upbeat', name: 'Upbeat', language: 'en', gender: 'neutral' },
          { id: 'informative', name: 'Informative', language: 'en', gender: 'neutral' },
          { id: 'youthful', name: 'Youthful', language: 'en', gender: 'neutral' },
          { id: 'warm', name: 'Warm', language: 'en', gender: 'neutral' },
          { id: 'professional', name: 'Professional', language: 'en', gender: 'neutral' },
        ];
      case 'azure':
        // Azure Speech voices would go here
        return [];
      default:
        return [];
    }
  }
}

export const speechProviderService = new SpeechProviderService();
