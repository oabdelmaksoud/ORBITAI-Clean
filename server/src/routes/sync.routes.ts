import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { projectFileService } from '../services/projectFile.service.js';

const router = express.Router();

/**
 * Sync files from WebContainer to the server.
 * POST /api/sync/files
 */
router.post('/files', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, files } = req.body;

        if (!projectId || !files || !Array.isArray(files)) {
            res.status(400).json({ error: 'Invalid request body' });
            return;
        }

        // console.log(`[Sync] Received ${files.length} file updates for project ${projectId}`);

        // Save files to in-memory store (simulating DB/S3 persistence)
        await projectFileService.saveFiles(projectId, files);

        res.status(200).json({ success: true, count: files.length });

    } catch (error) {
        console.error('Sync failed:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
