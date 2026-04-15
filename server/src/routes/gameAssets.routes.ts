/**
 * Game Assets API Routes
 * RESTful endpoints for AI-powered game asset generation and management
 */

import express from 'express';
import { Response } from 'express';
import { gameAssetService } from '../services/gameAssetService.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

/**
 * POST /api/game-assets/generate
 * Start bulk asset generation for a game project
 */
router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { projectId, gameType, genre, theme, assetList } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!projectId || !gameType || !genre || !theme) {
            return res.status(400).json({
                error: 'Missing required fields: projectId, gameType, theme'
            });
        }

        if (gameType !== '2D' && gameType !== '3D') {
            return res.status(400).json({
                error: 'Invalid gameType. Must be "2D" or "3D"'
            });
        }

        logger.info(`[GameAssets] Starting generation for project ${projectId}`);

        const job = await gameAssetService.generateGameAssetPack({
            projectId,
            userId,
            gameType,
            genre,
            theme,
            assetList
        });

        res.status(202).json({
            jobId: job._id.toString(),
            status: job.status,
            message: 'Asset generation started',
            totalAssets: job.totalAssets
        });

    } catch (error: unknown) {
        logger.error('[GameAssets] Generation failed:', error);
        res.status(500).json({
            error: 'Failed to start asset generation',
            details: error.message
        });
    }
});

/**
 * GET /api/game-assets/status/:jobId
 * Get generation job status and progress
 */
router.get('/status/:jobId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { jobId } = req.params;
        const userId = req.user?.id;

        const job = await gameAssetService.getJobStatus(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Verify ownership
        if (job.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            jobId: job._id.toString(),
            status: job.status,
            progress: job.progress,
            totalAssets: job.totalAssets,
            completedAssets: job.completedAssets,
            failedAssets: job.failedAssets,
            results: job.results,
            errors: job.errorLog,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            estimatedTimeRemaining: job.estimatedTimeRemaining
        });

    } catch (error: unknown) {
        logger.error('[GameAssets] Status check failed:', error);
        res.status(500).json({
            error: 'Failed to get job status',
            details: error.message
        });
    }
});

/**
 * GET /api/game-assets/:assetId
 * Get asset metadata
 */
router.get('/:assetId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { assetId } = req.params;
        const userId = req.user?.id;

        const asset = await gameAssetService.getAsset(assetId);

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Verify ownership
        if (asset.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            id: asset._id.toString(),
            projectId: asset.projectId,
            assetType: asset.assetType,
            category: asset.category,
            prompt: asset.prompt,
            fileUrl: `/api/game-assets/download/${asset._id}`,
            thumbnailUrl: asset.thumbnailUrl ? `/api/game-assets/thumbnail/${asset._id}` : null,
            format: asset.format,
            status: asset.status,
            metadata: asset.metadata,
            provider: asset.provider,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt
        });

    } catch (error: unknown) {
        logger.error('[GameAssets] Get asset failed:', error);
        res.status(500).json({
            error: 'Failed to get asset',
            details: error.message
        });
    }
});

/**
 * GET /api/game-assets/download/:assetId
 * Download asset file
 */
router.get('/download/:assetId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { assetId } = req.params;
        const userId = req.user?.id;

        const asset = await gameAssetService.getAsset(assetId);

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Verify ownership
        if (asset.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (asset.status !== 'ready') {
            return res.status(400).json({
                error: 'Asset not ready for download',
                status: asset.status
            });
        }

        // Check if file exists
        try {
            await fs.access(asset.fileUrl);
        } catch {
            return res.status(404).json({ error: 'Asset file not found on server' });
        }

        // Set appropriate headers
        const filename = path.basename(asset.fileUrl);
        const mimeTypes: Record<string, string> = {
            'GLB': 'model/gltf-binary',
            'GLTF': 'model/gltf+json',
            'FBX': 'application/octet-stream',
            'PNG': 'image/png',
            'JPG': 'image/jpeg',
            'SVG': 'image/svg+xml'
        };

        res.setHeader('Content-Type', mimeTypes[asset.format] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream file
        const fileStream = require('fs').createReadStream(asset.fileUrl);
        fileStream.pipe(res);

    } catch (error: unknown) {
        logger.error('[GameAssets] Download failed:', error);
        res.status(500).json({
            error: 'Failed to download asset',
            details: error.message
        });
    }
});

/**
 * GET /api/game-assets/list/:projectId
 * List all assets for a project
 */
router.get('/list/:projectId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = req.user?.id;

        const { type, category, status } = req.query;

        const filters: any = {};
        if (type) filters.type = type as '2D' | '3D';
        if (category) filters.category = category as string;
        if (status) filters.status = status as string;

        const assets = await gameAssetService.listAssets(projectId, filters);

        // Verify user owns the project assets
        if (assets.length > 0 && assets[0].userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const formattedAssets = assets.map(asset => ({
            id: asset._id.toString(),
            assetType: asset.assetType,
            category: asset.category,
            prompt: asset.prompt,
            fileUrl: `/api/game-assets/download/${asset._id}`,
            thumbnailUrl: asset.thumbnailUrl ? `/api/game-assets/thumbnail/${asset._id}` : null,
            format: asset.format,
            status: asset.status,
            metadata: asset.metadata,
            provider: asset.provider,
            createdAt: asset.createdAt
        }));

        res.json({
            projectId,
            assets: formattedAssets,
            total: formattedAssets.length
        });

    } catch (error: unknown) {
        logger.error('[GameAssets] List assets failed:', error);
        res.status(500).json({
            error: 'Failed to list assets',
            details: error.message
        });
    }
});

/**
 * DELETE /api/game-assets/:assetId
 * Delete an asset
 */
router.delete('/:assetId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { assetId } = req.params;
        const userId = req.user?.id;

        const asset = await gameAssetService.getAsset(assetId);

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Verify ownership
        if (asset.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await gameAssetService.deleteAsset(assetId);

        res.json({
            success: true,
            message: 'Asset deleted successfully'
        });

    } catch (error: unknown) {
        logger.error('[GameAssets] Delete failed:', error);
        res.status(500).json({
            error: 'Failed to delete asset',
            details: error.message
        });
    }
});

/**
 * POST /api/game-assets/:assetId/regenerate
 * Regenerate an asset with optional new prompt
 */
router.post('/:assetId/regenerate', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { assetId } = req.params;
        const { newPrompt } = req.body;
        const userId = req.user?.id;

        const asset = await gameAssetService.getAsset(assetId);

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Verify ownership
        if (asset.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const jobId = await gameAssetService.regenerateAsset(assetId, newPrompt);

        res.status(202).json({
            jobId,
            message: 'Asset regeneration started',
            originalAssetId: assetId
        });

    } catch (error: unknown) {
        logger.error('[GameAssets] Regenerate failed:', error);
        res.status(500).json({
            error: 'Failed to regenerate asset',
            details: error.message
        });
    }
});

export default router;
