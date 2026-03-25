/**
 * Open-Source Speech Recognition and Text-to-Speech Routes
 * Uses Whisper (open-source) for STT and lightweight TTS solutions
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { speechProviderService } from '../services/speechProvider.service.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for audio file uploads
const upload = multer({
  dest: 'uploads/audio/',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper supports up to 25MB)
  },
  fileFilter: (req, file, cb) => {
    // Accept audio formats
    const allowedMimes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/ogg',
      'audio/m4a',
      'audio/x-m4a',
      'audio/flac',
      'audio/x-flac',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type. Supported: webm, wav, mp3, ogg, m4a, flac'));
    }
  },
});

/**
 * POST /api/speech/transcribe
 * Transcribe audio to text using Whisper (open-source)
 * 
 * @body {File} audio - Audio file (webm, wav, mp3, etc.)
 * @returns {Object} { text: string, language?: string }
 */
router.post('/transcribe', upload.single('audio'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      });
    }

    logger.info(`[Speech] Transcribing audio file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Transcribe using available provider (OpenAI, Google, Azure, etc.) with automatic fallback
    let transcription;
    try {
      transcription = await speechProviderService.transcribeAudio(
        req.file.path,
        req.file.mimetype
      );
    } catch (error: any) {
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      
      // Provide helpful error message
      const errorMessage = error.message || 'Speech recognition service not configured.';
      const isQuotaError = error?.status === 429 || error?.message?.includes('quota');
      
      logger.error(`[Speech] Transcription failed: ${errorMessage}`);
      
      return res.status(isQuotaError ? 429 : 503).json({
        success: false,
        error: isQuotaError 
          ? 'All speech providers have exceeded their quota. Please check your API key billing or configure additional providers via Admin Console → Settings → API Keys.'
          : errorMessage + ' Please configure at least one provider (OpenAI, Google, or Azure) via Admin Console → Settings → API Keys.',
      });
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {
      logger.warn(`[Speech] Failed to delete temp file: ${req.file.path}`);
    });

    logger.info(`[Speech] Transcription successful: ${transcription.text.substring(0, 50)}...`);

    res.json({
      success: true,
      text: transcription.text,
      language: transcription.language || 'en',
    });
  } catch (error: any) {
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    logger.error('[Speech] Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio',
    });
  }
});

/**
 * POST /api/speech/synthesize
 * Convert text to speech using open-source TTS
 * 
 * @body {Object} { text: string, voice?: string, language?: string }
 * @returns {Buffer} Audio file (MP3 or WAV)
 * 
 * Note: For now, we'll use OpenAI's TTS API which uses open-source models.
 * In the future, this can be replaced with fully local solutions like Coqui TTS.
 */
router.post('/synthesize', async (req: AuthRequest, res) => {
  try {
    const { text, voice = 'alloy', language = 'en' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    // Limit text length to prevent abuse
    const maxLength = 4000;
    const textToSpeak = text.length > maxLength ? text.substring(0, maxLength) : text;

    logger.info(`[Speech] Synthesizing text (${textToSpeak.length} chars) with voice: ${voice}`);

    // Synthesize using available provider (OpenAI, Google, Azure, etc.) with automatic fallback
    let synthesisResult;
    try {
      synthesisResult = await speechProviderService.synthesizeSpeech(
        textToSpeak,
        voice,
        language
      );
    } catch (error: any) {
      // Provide helpful error message
      const errorMessage = error.message || 'Text-to-speech service not configured.';
      const isQuotaError = error?.status === 429 || error?.message?.includes('quota');
      
      logger.error(`[Speech] Synthesis failed: ${errorMessage}`);
      
      return res.status(isQuotaError ? 429 : 503).json({
        success: false,
        error: isQuotaError 
          ? 'All speech providers have exceeded their quota. Please check your API key billing or configure additional providers via Admin Console → Settings → API Keys.'
          : errorMessage + ' Please configure at least one provider (OpenAI, Google, or Azure) via Admin Console → Settings → API Keys.',
      });
    }

    logger.info(`[Speech] Speech generated successfully (${synthesisResult.audioBuffer.length} bytes)`);

    // Set headers for audio response
    res.setHeader('Content-Type', synthesisResult.mimeType);
    res.setHeader('Content-Length', synthesisResult.audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    res.send(synthesisResult.audioBuffer);
  } catch (error: any) {
    logger.error('[Speech] Synthesis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to synthesize speech',
    });
  }
});

/**
 * GET /api/speech/voices
 * Get available TTS voices
 * 
 * @returns {Object} { voices: Array<{id: string, name: string, language: string}> }
 */
router.get('/voices', async (req: AuthRequest, res) => {
  try {
    // Get voices from available provider
    const voices = await speechProviderService.getVoices();
    
    if (voices.length === 0) {
      return res.status(503).json({
        success: false,
        error: 'No speech provider available. Please configure at least one provider (OpenAI, Google, or Azure) via Admin Console → Settings → API Keys.',
      });
    }

    res.json({
      success: true,
      voices,
    });
  } catch (error: any) {
    logger.error('[Speech] Error getting voices:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get voices',
    });
  }
});

/**
 * GET /api/speech/providers
 * Get available speech providers
 */
router.get('/providers', async (req: AuthRequest, res) => {
  try {
    const providers = await speechProviderService.getAvailableProviders();
    const preferred = await speechProviderService.getPreferredProvider();

    res.json({
      success: true,
      providers,
      preferred,
    });
  } catch (error: any) {
    logger.error('[Speech] Error getting providers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get providers',
    });
  }
});

export default router;



