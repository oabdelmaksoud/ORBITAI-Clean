import express from 'express';
import { authenticateToken, authenticateTokenOptional, AuthRequest } from '../middleware/auth.js';
import { e2bService } from '../services/e2b.service.js';

const router = express.Router();

// Remove global auth to allow optional auth for specific routes
// router.use(authenticateToken);

// Get API configuration status (without exposing keys)
router.get('/status', authenticateToken, async (_req: AuthRequest, res, next) => {
  try {
    const e2bConfigured = await e2bService.isConfigured();
    res.json({
      success: true,
      data: {
        gemini: {
          configured: !!process.env.GEMINI_API_KEY,
          status: process.env.GEMINI_API_KEY ? 'ready' : 'not configured'
        },
        e2b: {
          configured: e2bConfigured,
          status: e2bConfigured ? 'ready' : 'not configured'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Gemini API key for Live API (user's key or platform key)
router.get('/gemini-api-key', authenticateTokenOptional, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const { apiKeyProvider } = await import('../services/apiKeyProvider.service.js');

    // Try user's API key first, then platform key
    let apiKey: string | null = null;

    if (userId) {
      apiKey = await apiKeyProvider.getUserApiKey(userId, 'gemini');
    }

    if (!apiKey) {
      // If no user key (or guest), use system key silently
      // Pass true for silent mode to avoid logging warnings for guests
      apiKey = await apiKeyProvider.getApiKey('gemini', true);
    }

    if (!apiKey) {
      // Fallback to environment variable for development convenience
      apiKey = process.env.GEMINI_API_KEY || null;
      if (apiKey) {
        logger.info('[Config] Using GEMINI_API_KEY from environment variable');
      }
    }

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'Gemini API key not configured. Please add it via Settings → API Keys or set GEMINI_API_KEY in .env'
      });
    }

    res.json({
      success: true,
      apiKey
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;

