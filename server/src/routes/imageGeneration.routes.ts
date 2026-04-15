/**
 * Image Generation Routes
 * API endpoints for AI image generation (DALL-E, etc.)
 */

import { Router, Request, Response } from 'express';
import { imageGenerationService } from '../services/imageGeneration.service.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * @swagger
 * /api/images/generate:
 *   post:
 *     summary: Generate images from text prompt
 *     tags: [Image Generation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: Text description of the image to generate
 *               provider:
 *                 type: string
 *                 enum: [dalle, stability]
 *                 default: dalle
 *               model:
 *                 type: string
 *                 enum: [dall-e-3, dall-e-2]
 *                 default: dall-e-3
 *               size:
 *                 type: string
 *                 enum: [256x256, 512x512, 1024x1024, 1024x1792, 1792x1024]
 *                 default: 1024x1024
 *               quality:
 *                 type: string
 *                 enum: [standard, hd]
 *                 default: standard
 *               style:
 *                 type: string
 *                 enum: [vivid, natural]
 *                 default: vivid
 *               n:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *                 default: 1
 *     responses:
 *       200:
 *         description: Images generated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prompt, provider, model, size, quality, style, n } = req.body;
    const userId = (req as any).user?.id;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a non-empty string'
      });
      return;
    }

    // Check if service is available
    const isAvailable = await imageGenerationService.isAvailable(provider || 'dalle');
    if (!isAvailable) {
      res.status(503).json({
        success: false,
        error: 'Image generation service is not available. Please configure the API key in Admin Console.'
      });
      return;
    }

    logger.info(`[ImageGeneration] User ${userId} requesting image generation: "${prompt.substring(0, 50)}..."`);

    const result = await imageGenerationService.generateImage({
      prompt: prompt.trim(),
      provider,
      model,
      size,
      quality,
      style,
      n,
      userId
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error('Image generation route error:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Failed to generate image'
    });
  }
});

/**
 * @swagger
 * /api/images/models:
 *   get:
 *     summary: Get available image generation models
 *     tags: [Image Generation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available models
 */
router.get('/models', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const models = await imageGenerationService.getAvailableModels();
    res.json({
      success: true,
      models
    });
  } catch (error: unknown) {
    logger.error('Get models error:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Failed to get models'
    });
  }
});

/**
 * @swagger
 * /api/images/pricing:
 *   get:
 *     summary: Get image generation pricing
 *     tags: [Image Generation]
 *     responses:
 *       200:
 *         description: Pricing information
 */
router.get('/pricing', (_req: Request, res: Response) => {
  try {
    const pricing = imageGenerationService.getPricing();
    res.json({
      success: true,
      pricing,
      currency: 'USD',
      note: 'Prices are per image generated'
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Failed to get pricing'
    });
  }
});

/**
 * @swagger
 * /api/images/status:
 *   get:
 *     summary: Check image generation service status
 *     tags: [Image Generation]
 *     responses:
 *       200:
 *         description: Service status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const dalleAvailable = await imageGenerationService.isAvailable('dalle');
    
    res.json({
      success: true,
      status: {
        dalle: {
          available: dalleAvailable,
          provider: 'OpenAI',
          models: ['dall-e-3', 'dall-e-2']
        },
        stability: {
          available: false,
          provider: 'Stability AI',
          models: ['stable-diffusion-xl'],
          note: 'Coming soon'
        }
      }
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Failed to get status'
    });
  }
});

export default router;




