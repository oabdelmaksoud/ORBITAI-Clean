/**
 * Game Asset Service
 * AI-powered 2D/3D game asset generation using Tripo AI, FLUX.1, and Sloyd API
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { GameAsset, IGameAsset } from '../models/GameAsset.model.js';
import { AssetGenerationJob, IAssetGenerationJob } from '../models/AssetGenerationJob.model.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';

// Environment configuration
const ASSET_STORAGE_PATH = process.env.ASSET_STORAGE_PATH || '/tmp/game-assets';
const TRIPO_API_URL = 'https://api.tripo3d.ai/v1';
const FLUX_API_URL = process.env.FLUX_API_URL || 'https://api.bfl.ml/v1';

interface GenerateAssetRequest {
    projectId: string;
    userId: string;
    gameType: '2D' | '3D';
    genre: string;
    theme: string;
    assetList?: Array<{
        type: '2D' | '3D';
        category: 'character' | 'prop' | 'environment' | 'ui';
        description: string;
    }>;
}

interface Asset3DResult {
    assetId: string;
    fileUrl: string;
    thumbnailUrl: string;
    metadata: any;
}

interface Asset2DResult {
    assetId: string;
    fileUrl: string;
    metadata: any;
}

class GameAssetService {
    /**
     * Initialize storage directory
     */
    async initialize(): Promise<void> {
        try {
            await fs.mkdir(ASSET_STORAGE_PATH, { recursive: true });
            logger.info(`[GameAssetService] Initialized storage at ${ASSET_STORAGE_PATH}`);
        } catch (error) {
            logger.error('[GameAssetService] Failed to initialize storage:', error);
            throw error;
        }
    }

    /**
     * Generate complete game asset pack
     */
    async generateGameAssetPack(request: GenerateAssetRequest): Promise<IAssetGenerationJob> {
        logger.info(`[GameAssetService] Starting asset generation for project ${request.projectId}`);

        // Determine asset list if not provided
        const assetList = request.assetList || this.determineAssetList(request.gameType, request.genre, request.theme);

        // Create generation job
        const job = new AssetGenerationJob({
            projectId: request.projectId,
            userId: request.userId,
            gameType: request.gameType,
            genre: request.genre,
            theme: request.theme,
            assetList,
            totalAssets: assetList.length,
            status: 'pending'
        });

        await job.save();

        // Start generation asynchronously (don't await)
        this.processGenerationJob(job._id.toString()).catch(error => {
            logger.error(`[GameAssetService] Job ${job._id} failed:`, error);
        });

        return job;
    }

    /**
     * Process asset generation job
     */
    private async processGenerationJob(jobId: string): Promise<void> {
        const job = await AssetGenerationJob.findById(jobId);
        if (!job) {
            logger.error(`[GameAssetService] Job ${jobId} not found`);
            return;
        }

        try {
            job.status = 'processing';
            job.startedAt = new Date();
            await job.save();

            // Emit WebSocket event: generation started
            this.emitGenerationEvent('started', job);

            // Generate each asset
            for (let i = 0; i < job.assetList.length; i++) {
                const assetSpec = job.assetList[i];

                try {
                    logger.info(`[GameAssetService] Generating asset ${i + 1}/${job.totalAssets}: ${assetSpec.description}`);

                    // Emit progress update
                    job.progress = Math.round(((i) / job.totalAssets) * 100);
                    await job.save();
                    this.emitGenerationEvent('progress', job, {
                        currentAsset: assetSpec.description,
                        currentIndex: i + 1
                    });

                    // Generate asset based on type
                    let result;
                    if (assetSpec.type === '3D') {
                        result = await this.generate3DAsset(
                            this.buildPrompt(assetSpec, job.theme, job.genre),
                            assetSpec.category,
                            job.projectId,
                            job.userId,
                            jobId
                        );
                    } else {
                        result = await this.generate2DAsset(
                            this.buildPrompt(assetSpec, job.theme, job.genre),
                            job.theme,
                            assetSpec.category,
                            job.projectId,
                            job.userId,
                            jobId
                        );
                    }

                    job.results.push(result.assetId);
                    job.completedAssets++;

                    // Emit asset complete event
                    this.emitGenerationEvent('assetComplete', job, { asset: result });

                } catch (error: unknown) {
                    logger.error(`[GameAssetService] Failed to generate asset: ${assetSpec.description}`, error);

                    job.failedAssets++;
                    job.errors.push({
                        asset: assetSpec.description,
                        error: error.message,
                        timestamp: new Date()
                    });

                    // Emit error event
                    this.emitGenerationEvent('error', job, {
                        asset: assetSpec.description,
                        error: error.message
                    });
                }

                await job.save();
            }

            // Job complete
            job.status = job.failedAssets === job.totalAssets ? 'failed' : 'completed';
            job.completedAt = new Date();
            job.progress = 100;
            await job.save();

            this.emitGenerationEvent('complete', job);

            logger.info(`[GameAssetService] Job ${jobId} completed: ${job.completedAssets}/${job.totalAssets} successful`);

        } catch (error: unknown) {
            logger.error(`[GameAssetService] Job ${jobId} processing failed:`, error);

            job.status = 'failed';
            job.completedAt = new Date();
            job.errors.push({
                asset: 'Job',
                error: error.message,
                timestamp: new Date()
            });
            await job.save();

            this.emitGenerationEvent('error', job, { error: error.message });
        }
    }

    /**
     * Generate 3D asset using Tripo AI
     */
    async generate3DAsset(
        prompt: string,
        category: string,
        projectId: string,
        userId: string,
        jobId?: string
    ): Promise<Asset3DResult> {
        logger.info(`[GameAssetService] Generating 3D asset: ${prompt}`);

        try {
            const apiKey = await apiKeyProvider.getApiKey('tripo');
            if (!apiKey) {
                throw new Error('Tripo AI API key not configured');
            }

            // Call Tripo AI API
            const response = await axios.post(
                `${TRIPO_API_URL}/text-to-model`,
                {
                    prompt,
                    model_type: 'game_asset',
                    style: 'low_poly', // Optimized for games
                    format: 'glb'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000 // 2 minute timeout
                }
            );

            const taskId = response.data.task_id;

            // Poll for completion
            const modelData = await this.pollTripoTask(taskId, apiKey);

            // Download the model file
            const filename = `${projectId}_${category}_${Date.now()}.glb`;
            const fileUrl = await this.downloadAndSaveFile(modelData.model_url, filename);

            // Generate thumbnail
            const thumbnailUrl = await this.generateThumbnail(fileUrl, 'GLB');

            // Extract metadata
            const metadata = {
                polyCount: modelData.poly_count || 0,
                vertexCount: modelData.vertex_count || 0,
                triangleCount: modelData.triangle_count || 0,
                fileSize: modelData.file_size || 0,
                textures: modelData.textures || [],
                dimensions: modelData.dimensions || { width: 1, height: 1, depth: 1 }
            };

            // Create database record
            const asset = new GameAsset({
                projectId,
                userId,
                assetType: '3D',
                category,
                prompt,
                fileUrl,
                thumbnailUrl,
                format: 'GLB',
                status: 'ready',
                metadata,
                generationJobId: jobId,
                provider: 'tripo'
            });

            await asset.save();

            logger.info(`[GameAssetService] 3D asset generated: ${asset._id}`);

            return {
                assetId: asset._id.toString(),
                fileUrl,
                thumbnailUrl,
                metadata
            };

        } catch (error: unknown) {
            logger.error('[GameAssetService] 3D generation failed:', error);

            // Try fallback to Sloyd API
            if (error.response?.status === 429 || error.code === 'ECONNABORTED') {
                logger.info('[GameAssetService] Trying Sloyd API as fallback...');
                return this.generate3DAssetWithSloyd(prompt, category, projectId, userId, jobId);
            }

            throw new Error(`3D asset generation failed: ${error.message}`);
        }
    }

    /**
     * Generate 2D asset using FLUX.1
     */
    async generate2DAsset(
        prompt: string,
        style: string,
        category: string,
        projectId: string,
        userId: string,
        jobId?: string
    ): Promise<Asset2DResult> {
        logger.info(`[GameAssetService] Generating 2D asset: ${prompt}`);

        try {
            const apiKey = await apiKeyProvider.getApiKey('flux');
            if (!apiKey) {
                throw new Error('FLUX API key not configured');
            }

            // Call FLUX.1 API
            const response = await axios.post(
                `${FLUX_API_URL}/flux-pro`,
                {
                    prompt: `${prompt}, ${style} art style, game asset, transparent background, high quality`,
                    width: 1024,
                    height: 1024,
                    steps: 25,
                    guidance: 3.5,
                    output_format: 'png'
                },
                {
                    headers: {
                        'x-key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            const imageUrl = response.data.result?.sample || response.data.image;

            if (!imageUrl) {
                throw new Error('No image URL in FLUX response');
            }

            // Download and save
            const filename = `${projectId}_${category}_${Date.now()}.png`;
            const fileUrl = await this.downloadAndSaveFile(imageUrl, filename);

            // Get file stats
            const stats = await fs.stat(fileUrl);

            const metadata = {
                width: 1024,
                height: 1024,
                fileSize: stats.size,
                hasTransparency: true,
                colorDepth: 32
            };

            // Create database record
            const asset = new GameAsset({
                projectId,
                userId,
                assetType: '2D',
                category,
                prompt,
                fileUrl,
                format: 'PNG',
                status: 'ready',
                metadata,
                generationJobId: jobId,
                provider: 'flux'
            });

            await asset.save();

            logger.info(`[GameAssetService] 2D asset generated: ${asset._id}`);

            return {
                assetId: asset._id.toString(),
                fileUrl,
                metadata
            };

        } catch (error: unknown) {
            logger.error('[GameAssetService] 2D generation failed:', error);
            throw new Error(`2D asset generation failed: ${error.message}`);
        }
    }

    /**
     * Fallback: Generate 3D asset using Sloyd API
     */
    private async generate3DAssetWithSloyd(
        prompt: string,
        category: string,
        projectId: string,
        userId: string,
        jobId?: string
    ): Promise<Asset3DResult> {
        logger.info(`[GameAssetService] Generating 3D asset with Sloyd: ${prompt}`);

        try {
            const apiKey = await apiKeyProvider.getApiKey('sloyd');
            if (!apiKey) {
                throw new Error('Sloyd API key not configured');
            }

            // Sloyd API implementation (placeholder - adjust based on actual API)
            // This is a simplified version - actual implementation will depend on Sloyd's API
            const response = await axios.post(
                'https://api.sloyd.ai/v1/generate',
                {
                    prompt,
                    format: 'glb'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const modelUrl = response.data.model_url;
            const filename = `${projectId}_${category}_${Date.now()}_sloyd.glb`;
            const fileUrl = await this.downloadAndSaveFile(modelUrl, filename);
            const thumbnailUrl = await this.generateThumbnail(fileUrl, 'GLB');

            const metadata = {
                polyCount: response.data.poly_count || 5000,
                fileSize: response.data.file_size || 0,
                dimensions: { width: 1, height: 1, depth: 1 }
            };

            const asset = new GameAsset({
                projectId,
                userId,
                assetType: '3D',
                category,
                prompt,
                fileUrl,
                thumbnailUrl,
                format: 'GLB',
                status: 'ready',
                metadata,
                generationJobId: jobId,
                provider: 'sloyd'
            });

            await asset.save();

            return {
                assetId: asset._id.toString(),
                fileUrl,
                thumbnailUrl,
                metadata
            };

        } catch (error: unknown) {
            logger.error('[GameAssetService] Sloyd generation failed:', error);
            throw error;
        }
    }

    /**
     * Poll Tripo AI task until complete
     */
    private async pollTripoTask(taskId: string, apiKey: string, maxAttempts = 60): Promise<any> {
        for (let i = 0; i < maxAttempts; i++) {
            const response = await axios.get(
                `${TRIPO_API_URL}/task/${taskId}`,
                {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                }
            );

            const status = response.data.status;

            if (status === 'success') {
                return response.data.result;
            } else if (status === 'failed') {
                throw new Error(`Tripo task failed: ${response.data.error}`);
            }

            // Wait 2 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Tripo task timeout');
    }

    /**
     * Download file from URL and save to storage
     */
    private async downloadAndSaveFile(url: string, filename: string): Promise<string> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const filePath = path.join(ASSET_STORAGE_PATH, filename);

        await fs.writeFile(filePath, Buffer.from(response.data));

        return filePath;
    }

    /**
     * Generate thumbnail for 3D asset
     */
    private async generateThumbnail(assetPath: string, format: string): Promise<string> {
        // TODO: Implement 3D thumbnail generation using headless renderer
        // For now, return placeholder or skip
        logger.info('[GameAssetService] Thumbnail generation not yet implemented');
        return '';
    }

    /**
     * Determine asset list based on game type and genre
     */
    private determineAssetList(gameType: '2D' | '3D', genre: string, theme: string): any[] {
        const assetList: any[] = [];

        if (gameType === '2D') {
            // 2D Platformer asset pack
            assetList.push(
                { type: '2D', category: 'character', description: `${theme} hero character sprite` },
                { type: '2D', category: 'character', description: `${theme} enemy sprite variant 1` },
                { type: '2D', category: 'character', description: `${theme} enemy sprite variant 2` },
                { type: '2D', category: 'environment', description: `${theme} background layer 1 (far)` },
                { type: '2D', category: 'environment', description: `${theme} background layer 2 (mid)` },
                { type: '2D', category: 'prop', description: `${theme} platform tile set` },
                { type: '2D', category: 'prop', description: `${theme} collectible item (coin/gem)` },
                { type: '2D', category: 'ui', description: 'health bar UI element' },
                { type: '2D', category: 'ui', description: 'score counter UI element' }
            );
        } else {
            // 3D game asset pack
            assetList.push(
                { type: '3D', category: 'character', description: `${theme} player character model` },
                { type: '3D', category: 'character', description: `${theme} enemy character model` },
                { type: '3D', category: 'prop', description: `${theme} weapon item` },
                { type: '3D', category: 'prop', description: `${theme} collectible item` },
                { type: '3D', category: 'environment', description: `${theme} environment prop 1` },
                { type: '3D', category: 'environment', description: `${theme} environment prop 2` }
            );
        }

        return assetList;
    }

    /**
     * Build detailed prompt for asset generation
     */
    private buildPrompt(assetSpec: any, theme: string, genre: string): string {
        return `${assetSpec.description}, ${theme} theme, ${genre} game style, high quality game asset`;
    }

    /**
     * Emit WebSocket event for generation progress
     */
    private emitGenerationEvent(eventType: string, job: IAssetGenerationJob, data?: any): void {
        // This will be implemented when we integrate WebSocket service
        logger.info(`[GameAssetService] Event: gameAssets:generation:${eventType}`, {
            jobId: job._id,
            progress: job.progress,
            ...data
        });

        // TODO: Integrate with WebSocket service
        // webSocketService.emitToRoom(job._id, `gameAssets:generation:${eventType}`, { job, ...data });
    }

    /**
     * Get generation job status
     */
    async getJobStatus(jobId: string): Promise<IAssetGenerationJob | null> {
        return AssetGenerationJob.findById(jobId);
    }

    /**
     * List assets for a project
     */
    async listAssets(
        projectId: string,
        filters?: { type?: '2D' | '3D'; category?: string; status?: string }
    ): Promise<IGameAsset[]> {
        const query: any = { projectId };

        if (filters?.type) query.assetType = filters.type;
        if (filters?.category) query.category = filters.category;
        if (filters?.status) query.status = filters.status;

        return GameAsset.find(query).sort({ createdAt: -1 });
    }

    /**
     * Get single asset
     */
    async getAsset(assetId: string): Promise<IGameAsset | null> {
        return GameAsset.findById(assetId);
    }

    /**
     * Delete asset
     */
    async deleteAsset(assetId: string): Promise<void> {
        const asset = await GameAsset.findById(assetId);
        if (!asset) {
            throw new Error('Asset not found');
        }

        // Delete files
        try {
            await fs.unlink(asset.fileUrl);
            if (asset.thumbnailUrl) {
                await fs.unlink(asset.thumbnailUrl);
            }
        } catch (error) {
            logger.warn(`[GameAssetService] Failed to delete asset files: ${error}`);
        }

        // Delete database record
        await GameAsset.findByIdAndDelete(assetId);
    }

    /**
     * Regenerate asset
     */
    async regenerateAsset(assetId: string, newPrompt?: string): Promise<string> {
        const asset = await GameAsset.findById(assetId);
        if (!asset) {
            throw new Error('Asset not found');
        }

        const prompt = newPrompt || asset.prompt;

        // Create new generation job for single asset
        const job = new AssetGenerationJob({
            projectId: asset.projectId,
            userId: asset.userId,
            gameType: asset.assetType,
            genre: 'custom',
            theme: 'custom',
            assetList: [{
                type: asset.assetType,
                category: asset.category,
                description: prompt
            }],
            totalAssets: 1,
            status: 'pending'
        });

        await job.save();

        // Start generation
        this.processGenerationJob(job._id.toString()).catch(error => {
            logger.error(`[GameAssetService] Regeneration failed:`, error);
        });

        return job._id.toString();
    }
}

export const gameAssetService = new GameAssetService();
