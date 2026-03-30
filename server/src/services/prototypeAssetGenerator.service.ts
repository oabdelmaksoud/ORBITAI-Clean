/**
 * Prototype Asset Generator Service
 * Generates custom images for prototypes using AI image generation
 */

import { imageGenerationService, ImageProvider } from './imageGeneration.service.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PrototypeAsset {
    type: 'logo' | 'hero' | 'icon' | 'avatar' | 'background' | 'illustration' | 'audio' | 'video';
    name: string;
    prompt: string;
    dataUrl?: string;
    fallbackUrl?: string;
}

export interface AssetGenerationResult {
    assets: PrototypeAsset[];
    generatedCount: number;
    fallbackCount: number;
    errors: string[];
}

class PrototypeAssetGenerator {
    private readonly DEFAULT_PROVIDER: ImageProvider = 'nano-banana';
    private readonly FALLBACK_PROVIDER: ImageProvider = 'gemini';

    /**
     * Analyze project requirements and determine what assets are needed
     */
    analyzeRequiredAssets(
        projectName: string,
        projectType: string,
        userGoal: string,
        features: string[]
    ): PrototypeAsset[] {
        const assets: PrototypeAsset[] = [];

        // Always need a logo
        assets.push({
            type: 'logo',
            name: 'app-logo',
            prompt: `A modern, minimalist app logo for "${projectName}". ${this.getStyleForProjectType(projectType)}. Clean design, suitable for app icon and header. No text, just an icon/symbol.`,
            fallbackUrl: 'https://picsum.photos/100/100?random=logo'
        });

        // Hero image based on project type
        if (projectType === 'web' || projectType === 'mobile') {
            assets.push({
                type: 'hero',
                name: 'hero-image',
                prompt: `A high-quality hero image for "${userGoal}". ${this.getContextFromGoal(userGoal)}. Modern, professional, visually striking.`,
                fallbackUrl: 'https://picsum.photos/1200/600?random=hero'
            });
        }

        // Feature-specific illustrations
        const featureKeywords = this.extractFeatureKeywords(features);
        if (featureKeywords.length > 0) {
            assets.push({
                type: 'illustration',
                name: 'feature-illustration',
                prompt: `A modern illustration representing: ${featureKeywords.slice(0, 3).join(', ')}. Clean, flat design style with vibrant colors.`,
                fallbackUrl: 'https://picsum.photos/600/400?random=feature'
            });
        }

        // Background pattern for premium feel
        if (projectType !== 'api') {
            assets.push({
                type: 'background',
                name: 'subtle-pattern',
                prompt: `A subtle, seamless background pattern for a ${projectType} application. Geometric, minimal, works well with dark and light themes.`,
                fallbackUrl: 'https://picsum.photos/200/200?random=bg'
            });
        }

        // Game-specific assets
        if (projectType === 'game') {
            assets.push({
                type: 'illustration',
                name: 'game-character',
                prompt: `A game character or mascot for a ${this.getGameType(userGoal)} game. Cartoon style, friendly, vibrant colors.`,
                fallbackUrl: 'https://picsum.photos/300/300?random=character'
            });
        }

        // Audio asset (if music/audio app)
        if (projectType === 'web' && (userGoal.toLowerCase().includes('music') || userGoal.toLowerCase().includes('audio') || userGoal.toLowerCase().includes('podcast'))) {
            assets.push({
                type: 'audio',
                name: 'demo-track',
                prompt: 'Upbeat demo track',
                fallbackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
            });
        }

        // Video asset (if video app)
        if (projectType === 'web' && (userGoal.toLowerCase().includes('video') || userGoal.toLowerCase().includes('stream') || userGoal.toLowerCase().includes('movie'))) {
            assets.push({
                type: 'video',
                name: 'demo-video',
                prompt: 'Demo video content',
                fallbackUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
            });
        }

        return assets;
    }

    /**
     * Generate all required assets for a prototype
     */
    async generateAssets(
        assets: PrototypeAsset[],
        maxConcurrent: number = 2,
        timeoutMs: number = 30000
    ): Promise<AssetGenerationResult> {
        const result: AssetGenerationResult = {
            assets: [],
            generatedCount: 0,
            fallbackCount: 0,
            errors: []
        };

        // Process assets in batches to avoid rate limits
        for (let i = 0; i < assets.length; i += maxConcurrent) {
            const batch = assets.slice(i, i + maxConcurrent);
            const batchPromises = batch.map(asset => this.generateSingleAsset(asset, timeoutMs));

            const batchResults = await Promise.allSettled(batchPromises);

            for (let j = 0; j < batchResults.length; j++) {
                const batchResult = batchResults[j];
                const originalAsset = batch[j];

                if (batchResult.status === 'fulfilled' && batchResult.value.dataUrl) {
                    result.assets.push(batchResult.value);
                    result.generatedCount++;
                } else {
                    // Use fallback
                    result.assets.push({
                        ...originalAsset,
                        dataUrl: originalAsset.fallbackUrl
                    });
                    result.fallbackCount++;
                    if (batchResult.status === 'rejected') {
                        result.errors.push(`${originalAsset.name}: ${batchResult.reason}`);
                    }
                }
            }
        }

        logger.info(`[AssetGenerator] Generated ${result.generatedCount} assets, ${result.fallbackCount} fallbacks, ${result.errors.length} errors`);
        return result;
    }

    /**
     * Generate a single asset with timeout and fallback
     */
    private async generateSingleAsset(
        asset: PrototypeAsset,
        timeoutMs: number
    ): Promise<PrototypeAsset> {
        const startTime = Date.now();

        try {
            // Create a timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), timeoutMs);
            });

            // Try primary provider (Imagen)
            const generatePromise = this.tryGenerateWithProvider(asset, this.DEFAULT_PROVIDER);

            const response = await Promise.race([generatePromise, timeoutPromise]);

            if (response.success && response.images.length > 0) {
                logger.info(`[AssetGenerator] Generated ${asset.name} with ${this.DEFAULT_PROVIDER} in ${Date.now() - startTime}ms`);
                return {
                    ...asset,
                    dataUrl: response.images[0].url
                };
            }

            // Try fallback provider (Gemini)
            const fallbackResponse = await this.tryGenerateWithProvider(asset, this.FALLBACK_PROVIDER);

            if (fallbackResponse.success && fallbackResponse.images.length > 0) {
                logger.info(`[AssetGenerator] Generated ${asset.name} with ${this.FALLBACK_PROVIDER} (fallback) in ${Date.now() - startTime}ms`);
                return {
                    ...asset,
                    dataUrl: fallbackResponse.images[0].url
                };
            }

            throw new Error('All providers failed');
        } catch (error: any) {
            logger.warn(`[AssetGenerator] Failed to generate ${asset.name}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Try generating with a specific provider
     */
    private async tryGenerateWithProvider(asset: PrototypeAsset, provider: ImageProvider) {
        return await imageGenerationService.generateImage({
            prompt: asset.prompt,
            provider,
            n: 1
        });
    }

    /**
     * Get style description based on project type
     */
    private getStyleForProjectType(projectType: string): string {
        switch (projectType) {
            case 'game':
                return 'Gaming aesthetic, vibrant colors, playful design';
            case 'mobile':
                return 'Mobile app style, rounded corners, gradient colors';
            case 'web':
                return 'Professional web design, clean lines, modern aesthetic';
            case 'api':
                return 'Tech/developer focused, minimalist, monochrome';
            default:
                return 'Modern, professional, clean design';
        }
    }

    /**
     * Extract context from user goal for better prompts
     */
    private getContextFromGoal(userGoal: string): string {
        const lowerGoal = userGoal.toLowerCase();

        if (lowerGoal.includes('game')) return 'Gaming theme, action-oriented';
        if (lowerGoal.includes('ecommerce') || lowerGoal.includes('shop')) return 'E-commerce, products, shopping';
        if (lowerGoal.includes('social')) return 'Social media, community, connections';
        if (lowerGoal.includes('fitness') || lowerGoal.includes('health')) return 'Fitness, wellness, active lifestyle';
        if (lowerGoal.includes('education') || lowerGoal.includes('learn')) return 'Education, learning, knowledge';
        if (lowerGoal.includes('finance') || lowerGoal.includes('banking')) return 'Finance, money, trust, security';
        if (lowerGoal.includes('travel')) return 'Travel, adventure, destinations';
        if (lowerGoal.includes('food') || lowerGoal.includes('restaurant')) return 'Food, dining, culinary';

        return 'Professional, modern, technology';
    }

    /**
     * Extract feature keywords for illustration prompts
     */
    private extractFeatureKeywords(features: string[]): string[] {
        const keywords: string[] = [];
        const keywordMap: Record<string, string> = {
            'dashboard': 'data visualization',
            'analytics': 'charts and graphs',
            'user': 'user profiles',
            'chat': 'messaging and communication',
            'payment': 'financial transactions',
            'search': 'search and discovery',
            'map': 'location and navigation',
            'video': 'video streaming',
            'music': 'audio and music',
            'photo': 'photography and images'
        };

        for (const feature of features) {
            const lower = feature.toLowerCase();
            for (const [key, value] of Object.entries(keywordMap)) {
                if (lower.includes(key)) {
                    keywords.push(value);
                    break;
                }
            }
        }

        return [...new Set(keywords)];
    }

    /**
     * Determine game type from goal
     */
    private getGameType(userGoal: string): string {
        const lowerGoal = userGoal.toLowerCase();

        if (lowerGoal.includes('mario') || lowerGoal.includes('platformer')) return 'platformer';
        if (lowerGoal.includes('puzzle')) return 'puzzle';
        if (lowerGoal.includes('rpg') || lowerGoal.includes('adventure')) return 'RPG adventure';
        if (lowerGoal.includes('racing')) return 'racing';
        if (lowerGoal.includes('shooting') || lowerGoal.includes('fps')) return 'action shooter';

        return 'casual';
    }

    /**
     * Create an HTML snippet with embedded assets
     */
    createAssetVariables(assets: PrototypeAsset[]): string {
        const variables: string[] = [
            '<!-- AI-Generated Assets -->',
            '<script>',
            '  const PROTOTYPE_ASSETS = {'
        ];

        for (const asset of assets) {
            const url = asset.dataUrl || asset.fallbackUrl || '';
            variables.push(`    '${asset.name}': '${url}',`);
        }

        variables.push('  };');
        variables.push('</script>');

        return variables.join('\n');
    }

    /**
     * Save generated assets to local disk
     */
    async saveAssetsToDisk(assets: PrototypeAsset[], projectId: string): Promise<PrototypeAsset[]> {
        // Target director: ../../../public/projects/{projectId}/assets
        // Start from server/src/services -> up to root -> public
        const publicDir = path.resolve(__dirname, '../../../public');
        const projectAssetsDir = path.resolve(publicDir, 'projects', projectId, 'assets');

        // Ensure directory exists
        if (!fs.existsSync(projectAssetsDir)) {
            try {
                fs.mkdirSync(projectAssetsDir, { recursive: true });
            } catch (err) {
                logger.error(`[AssetGenerator] Failed to create assets directory: ${projectAssetsDir}`, err);
                return assets; // Return original assets with data URLs if save fails
            }
        }

        const updatedAssets: PrototypeAsset[] = [];

        for (const asset of assets) {
            try {
                // If it's an audio/video that wasn't generated but has fallback, keeping fallback is fine
                // But if we generated an image, it has a dataUrl we want to save
                if (asset.dataUrl && asset.dataUrl.startsWith('data:image/')) {
                    // Extract base64 data
                    const matches = asset.dataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);

                    if (matches && matches.length === 3) {
                        const extension = matches[1] === 'svg+xml' ? 'svg' : matches[1];
                        const base64Data = matches[2];
                        const buffer = Buffer.from(base64Data, 'base64');

                        // Sanitize filename
                        const safeName = asset.name.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
                        const filename = `${safeName}.${extension}`;
                        const filePath = path.join(projectAssetsDir, filename);

                        // Write file
                        fs.writeFileSync(filePath, buffer);

                        // Update asset with public URL
                        updatedAssets.push({
                            ...asset,
                            dataUrl: `/projects/${projectId}/assets/${filename}`
                        });

                        logger.info(`[AssetGenerator] Saved asset to disk: ${filename}`);
                        continue;
                    }
                }

                // Keep original if not saved or not an image
                updatedAssets.push(asset);

            } catch (err: any) {
                logger.warn(`[AssetGenerator] Failed to save asset ${asset.name}: ${err.message}`);
                updatedAssets.push(asset);
            }
        }

        return updatedAssets;
    }
}

export const prototypeAssetGenerator = new PrototypeAssetGenerator();
