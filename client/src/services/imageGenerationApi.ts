/**
 * Image Generation API Service
 * Frontend API for AI image generation
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export type ImageProvider = 'dalle' | 'stability' | 'midjourney';
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
  n?: number;
}

export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
  provider: ImageProvider;
  model: string;
  size: string;
  createdAt: string;
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

export interface ImageModel {
  provider: ImageProvider;
  models: string[];
  available: boolean;
}

export interface ImagePricing {
  success: boolean;
  pricing: Record<string, Record<string, number>>;
  currency: string;
  note: string;
}

export interface ImageServiceStatus {
  success: boolean;
  status: Record<string, {
    available: boolean;
    provider: string;
    models: string[];
    note?: string;
  }>;
}

let authToken: string | null = null;

export function setImageGenerationToken(token: string) {
  authToken = token;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate images from text prompt
 */
export async function generateImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  return apiRequest<ImageGenerationResponse>('/api/images/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get available image generation models
 */
export async function getImageModels(): Promise<{ success: boolean; models: ImageModel[] }> {
  return apiRequest('/api/images/models');
}

/**
 * Get image generation pricing
 */
export async function getImagePricing(): Promise<ImagePricing> {
  return apiRequest('/api/images/pricing');
}

/**
 * Check image generation service status
 */
export async function getImageServiceStatus(): Promise<ImageServiceStatus> {
  return apiRequest('/api/images/status');
}

/**
 * Helper to download generated image
 */
export async function downloadImage(url: string, filename?: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Failed to download image:', error);
    throw error;
  }
}




