/**
 * Image Generation Service
 * Supports DALL-E (OpenAI), Gemini, Imagen, and can be extended for other providers
 * Part of Agentic AI - Multimodal Generation capability
 */

import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { logger } from '../utils/logger.js';

export type ImageProvider = 'dalle' | 'gemini' | 'imagen' | 'nano-banana' | 'stability' | 'midjourney';
export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';
export type ImageQuality = 'standard' | 'hd';
export type ImageStyle = 'vivid' | 'natural';

export interface ImageGenerationRequest {
  prompt: string;
  provider?: ImageProvider;
  model?: string;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number; // Number of images to generate
  userId?: string;
  projectId?: string;
}

export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
  provider: ImageProvider;
  model: string;
  size: string;
  createdAt: Date;
}

export interface ImageGenerationResponse {
  success: boolean;
  images: GeneratedImage[];
  usage?: {
    provider: ImageProvider;
    model: string;
    imagesGenerated: number;
    estimatedCost: number;
  };
  error?: string;
}

export interface ImageEditRequest {
  image: Buffer | string; // Base64 or file path
  mask?: Buffer | string; // Optional mask for inpainting
  prompt: string;
  provider?: ImageProvider;
  model?: string;
  size?: ImageSize;
  n?: number;
}

export interface ImageVariationRequest {
  image: Buffer | string;
  provider?: ImageProvider;
  model?: string;
  size?: ImageSize;
  n?: number;
}

// Cost estimates per image (USD)
const IMAGE_COSTS: Record<string, Record<string, number>> = {
  'dall-e-3': {
    '1024x1024': 0.040,
    '1024x1792': 0.080,
    '1792x1024': 0.080,
    'hd-1024x1024': 0.080,
    'hd-1024x1792': 0.120,
    'hd-1792x1024': 0.120,
  },
  'dall-e-2': {
    '256x256': 0.016,
    '512x512': 0.018,
    '1024x1024': 0.020,
  },
  // Gemini Imagen 3 costs (estimated)
  'imagen-3': {
    '1024x1024': 0.020,
    '1024x1792': 0.040,
    '1792x1024': 0.040,
  },
  'gemini-2.0-flash': {
    '1024x1024': 0.010, // Gemini native image generation (lower cost)
  }
};

class ImageGenerationService {
  private openaiClient: OpenAI | null = null;
  private geminiClient: GoogleGenAI | null = null;

  /**
   * Get OpenAI client for DALL-E
   */
  private async getOpenAIClient(): Promise<OpenAI> {
    if (this.openaiClient) {
      return this.openaiClient;
    }

    const apiKey = await apiKeyProvider.getApiKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Add it via Admin Console → Settings → API Keys');
    }

    this.openaiClient = new OpenAI({ apiKey });
    return this.openaiClient;
  }

  /**
   * Check if image generation is available
   */
  async isAvailable(provider: ImageProvider = 'dalle'): Promise<boolean> {
    try {
      if (provider === 'dalle') {
        const apiKey = await apiKeyProvider.getApiKey('openai');
        return !!apiKey && apiKey.trim().length > 0;
      }
      if (provider === 'gemini' || provider === 'imagen') {
        const apiKey = await apiKeyProvider.getApiKey('gemini');
        return !!apiKey && apiKey.trim().length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get Gemini client for Imagen/Gemini image generation
   */
  private async getGeminiClient(): Promise<GoogleGenAI> {
    if (this.geminiClient) {
      return this.geminiClient;
    }

    const apiKey = await apiKeyProvider.getApiKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Add it via Admin Console → Settings → API Keys');
    }

    this.geminiClient = new GoogleGenAI({ apiKey });
    return this.geminiClient;
  }

  /**
   * Generate images from text prompt
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const provider = request.provider || 'dalle';

    try {
      switch (provider) {
        case 'dalle':
          return await this.generateWithDALLE(request);
        case 'gemini':
          return await this.generateWithGemini(request);
        case 'imagen':
          return await this.generateWithImagen(request);
        case 'nano-banana':
          return await this.generateWithNanoBanana(request);
        case 'stability':
          return await this.generateWithStability(request);
        default:
          throw new Error(`Unsupported image provider: ${provider}`);
      }
    } catch (error: unknown) {
      logger.error('Image generation failed:', error);
      return {
        success: false,
        images: [],
        error: error.message || 'Image generation failed'
      };
    }
  }

  /**
   * Generate images using DALL-E
   */
  private async generateWithDALLE(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const client = await this.getOpenAIClient();

    const model = request.model || 'dall-e-3';
    const size = request.size || '1024x1024';
    const quality = request.quality || 'standard';
    const style = request.style || 'vivid';
    const n = model === 'dall-e-3' ? 1 : (request.n || 1); // DALL-E 3 only supports n=1

    logger.info(`[ImageGeneration] Generating image with DALL-E: model=${model}, size=${size}, quality=${quality}`);

    const response = await client.images.generate({
      model,
      prompt: request.prompt,
      n,
      size: size as any,
      quality: model === 'dall-e-3' ? quality : undefined,
      style: model === 'dall-e-3' ? style : undefined,
      response_format: 'url'
    });

    const images: GeneratedImage[] = (response.data || []).map(img => ({
      url: img.url!,
      revisedPrompt: img.revised_prompt,
      provider: 'dalle' as ImageProvider,
      model,
      size,
      createdAt: new Date()
    }));

    // Calculate cost
    const costKey = quality === 'hd' ? `hd-${size}` : size;
    const costPerImage = IMAGE_COSTS[model]?.[costKey] || IMAGE_COSTS[model]?.[size] || 0.04;
    const estimatedCost = costPerImage * images.length;

    logger.info(`[ImageGeneration] Generated ${images.length} image(s), estimated cost: $${estimatedCost.toFixed(4)}`);

    return {
      success: true,
      images,
      usage: {
        provider: 'dalle',
        model,
        imagesGenerated: images.length,
        estimatedCost
      }
    };
  }

  /**
   * Generate images using Gemini 2.0 Flash (native image generation)
   */
  private async generateWithGemini(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const client = await this.getGeminiClient();

    const model = request.model || 'gemini-2.0-flash-exp';
    // Note: request.n for multi-image generation not yet supported by Gemini

    logger.info(`[ImageGeneration] Generating image with Gemini: model=${model}`);

    try {
      // Gemini 2.0 Flash supports native image generation
      const response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          responseModalities: ['image', 'text'],
        }
      });

      const images: GeneratedImage[] = [];

      // Extract images from response parts
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            // Convert base64 to data URL
            const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            images.push({
              url: dataUrl,
              provider: 'gemini' as ImageProvider,
              model,
              size: '1024x1024',
              createdAt: new Date()
            });
          }
        }
      }

      if (images.length === 0) {
        throw new Error('Gemini did not return any images. Try a different prompt.');
      }

      const estimatedCost = 0.01 * images.length;

      logger.info(`[ImageGeneration] Gemini generated ${images.length} image(s)`);

      return {
        success: true,
        images,
        usage: {
          provider: 'gemini',
          model,
          imagesGenerated: images.length,
          estimatedCost
        }
      };
    } catch (error: unknown) {
      logger.error('[ImageGeneration] Gemini image generation failed:', error);
      throw new Error(`Gemini image generation failed: ${error.message}`);
    }
  }

  /**
   * Generate images using Imagen 3 (Google's dedicated image generation model)
   */
  private async generateWithImagen(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const client = await this.getGeminiClient();

    const model = request.model || 'imagen-3.0-generate-001';
    const n = request.n || 1;

    logger.info(`[ImageGeneration] Generating image with Imagen: model=${model}, count=${n}`);

    try {
      // Imagen 3 API for dedicated image generation
      const response = await client.models.generateImages({
        model,
        prompt: request.prompt,
        config: {
          numberOfImages: n,
          aspectRatio: '1:1', // Can be '16:9', '9:16', '4:3', '3:4'
          outputMimeType: 'image/png',
        }
      });

      const images: GeneratedImage[] = [];

      // Extract generated images
      if (response.generatedImages) {
        for (const img of response.generatedImages) {
          if (img.image?.imageBytes) {
            const dataUrl = `data:image/png;base64,${img.image.imageBytes}`;
            images.push({
              url: dataUrl,
              provider: 'imagen' as ImageProvider,
              model,
              size: '1024x1024',
              createdAt: new Date()
            });
          }
        }
      }

      if (images.length === 0) {
        throw new Error('Imagen did not return any images. The prompt may have been blocked by safety filters.');
      }

      const estimatedCost = 0.02 * images.length;

      logger.info(`[ImageGeneration] Imagen generated ${images.length} image(s)`);

      return {
        success: true,
        images,
        usage: {
          provider: 'imagen',
          model,
          imagesGenerated: images.length,
          estimatedCost
        }
      };
    } catch (error: unknown) {
      logger.error('[ImageGeneration] Imagen generation failed:', error);
      throw new Error(`Imagen generation failed: ${error.message}`);
    }
  }

  /**
   * Generate images using Nano Banana (Gemini's experimental image model)
   */
  private async generateWithNanoBanana(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const client = await this.getGeminiClient();

    // Use the nano-banana-pro-preview model
    const model = request.model || 'gemini-nano-banana-pro-preview';

    logger.info(`[ImageGeneration] Generating image with Nano Banana: model=${model}`);

    try {
      // Nano Banana uses the same API as Gemini with image output
      const response = await client.models.generateContent({
        model,
        contents: `Generate an image: ${request.prompt}`,
        config: {
          responseModalities: ['image', 'text'],
        }
      });

      const images: GeneratedImage[] = [];

      // Extract images from response parts
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            images.push({
              url: dataUrl,
              provider: 'nano-banana' as ImageProvider,
              model,
              size: '1024x1024',
              createdAt: new Date()
            });
          }
        }
      }

      if (images.length === 0) {
        throw new Error('Nano Banana did not return any images. Try a different prompt.');
      }

      const estimatedCost = 0.005 * images.length; // Lower cost for experimental model

      logger.info(`[ImageGeneration] Nano Banana generated ${images.length} image(s)`);

      return {
        success: true,
        images,
        usage: {
          provider: 'nano-banana',
          model,
          imagesGenerated: images.length,
          estimatedCost
        }
      };
    } catch (error: unknown) {
      logger.error('[ImageGeneration] Nano Banana generation failed:', error);
      throw new Error(`Nano Banana generation failed: ${error.message}`);
    }
  }

  /**
   * Generate images using Stability AI (placeholder for future implementation)
   */
  private async generateWithStability(_request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    // Placeholder for Stability AI integration
    throw new Error('Stability AI integration not yet implemented. Please use DALL-E, Gemini, Imagen, or Nano Banana.');
  }

  /**
   * Edit an existing image (inpainting)
   */
  async editImage(request: ImageEditRequest): Promise<ImageGenerationResponse> {
    const provider = request.provider || 'dalle';

    if (provider !== 'dalle') {
      throw new Error('Image editing is currently only supported with DALL-E');
    }

    try {
      const client = await this.getOpenAIClient();

      // Note: DALL-E 2 is used for edits
      const response = await client.images.edit({
        model: 'dall-e-2',
        image: request.image as any,
        mask: request.mask as any,
        prompt: request.prompt,
        n: request.n || 1,
        size: (request.size || '1024x1024') as any,
        response_format: 'url'
      });

      const images: GeneratedImage[] = (response.data || []).map(img => ({
        url: img.url!,
        provider: 'dalle' as ImageProvider,
        model: 'dall-e-2',
        size: request.size || '1024x1024',
        createdAt: new Date()
      }));

      return {
        success: true,
        images,
        usage: {
          provider: 'dalle',
          model: 'dall-e-2',
          imagesGenerated: images.length,
          estimatedCost: 0.02 * images.length
        }
      };
    } catch (error: unknown) {
      logger.error('Image editing failed:', error);
      return {
        success: false,
        images: [],
        error: error.message || 'Image editing failed'
      };
    }
  }

  /**
   * Create variations of an existing image
   */
  async createVariation(request: ImageVariationRequest): Promise<ImageGenerationResponse> {
    const provider = request.provider || 'dalle';

    if (provider !== 'dalle') {
      throw new Error('Image variations are currently only supported with DALL-E');
    }

    try {
      const client = await this.getOpenAIClient();

      const response = await client.images.createVariation({
        model: 'dall-e-2',
        image: request.image as any,
        n: request.n || 1,
        size: (request.size || '1024x1024') as any,
        response_format: 'url'
      });

      const images: GeneratedImage[] = (response.data || []).map(img => ({
        url: img.url!,
        provider: 'dalle' as ImageProvider,
        model: 'dall-e-2',
        size: request.size || '1024x1024',
        createdAt: new Date()
      }));

      return {
        success: true,
        images,
        usage: {
          provider: 'dalle',
          model: 'dall-e-2',
          imagesGenerated: images.length,
          estimatedCost: 0.02 * images.length
        }
      };
    } catch (error: unknown) {
      logger.error('Image variation failed:', error);
      return {
        success: false,
        images: [],
        error: error.message || 'Image variation failed'
      };
    }
  }

  /**
   * Get available image models
   */
  async getAvailableModels(): Promise<{ provider: ImageProvider; models: string[]; available: boolean }[]> {
    const dalleAvailable = await this.isAvailable('dalle');
    const geminiAvailable = await this.isAvailable('gemini');

    return [
      {
        provider: 'dalle',
        models: ['dall-e-3', 'dall-e-2'],
        available: dalleAvailable
      },
      {
        provider: 'gemini',
        models: ['gemini-2.0-flash-exp'],
        available: geminiAvailable
      },
      {
        provider: 'imagen',
        models: ['imagen-3.0-generate-001', 'imagen-3.0-fast-generate-001'],
        available: geminiAvailable // Uses same API key as Gemini
      },
      {
        provider: 'nano-banana',
        models: ['gemini-nano-banana-pro-preview'],
        available: geminiAvailable // Uses same API key as Gemini
      },
      {
        provider: 'stability',
        models: ['stable-diffusion-xl', 'stable-diffusion-3'],
        available: false // Not yet implemented
      },
      {
        provider: 'midjourney',
        models: ['midjourney-v6'],
        available: false // Not yet implemented
      }
    ];
  }

  /**
   * Get pricing information
   */
  getPricing(): Record<string, Record<string, number>> {
    return IMAGE_COSTS;
  }
}

export const imageGenerationService = new ImageGenerationService();




