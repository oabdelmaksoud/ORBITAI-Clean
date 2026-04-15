import express from 'express';
import { DatabaseBackup } from '../models/DatabaseBackup.model.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
(async () => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error: unknown) {
    logger.error('Failed to create backup directory:', error);
  }
})();

/**
 * GET /api/admin/backups
 * Get all backups
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const status = req.query.status as string;
    const query: any = {};

    if (status) query.status = status;

    const backups = await DatabaseBackup.find(query).sort({ createdAt: -1 }).limit(100).lean();

    res.json({
      success: true,
      data: {
        backups: backups.map(b => ({
          id: b._id.toString(),
          filename: b.filename,
          fileSize: b.fileSize,
          backupType: b.backupType,
          status: b.status,
          collections: b.collections,
          startedAt: b.startedAt,
          completedAt: b.completedAt,
          error: b.error,
          verified: b.verified,
          verifiedAt: b.verifiedAt,
          createdBy: b.createdBy,
          retentionDays: b.retentionDays,
          expiresAt: b.expiresAt,
          createdAt: (b as any).createdAt,
        })),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/backups
 * Create a manual backup
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const { collections, retentionDays } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Create backup record
    const backup = new DatabaseBackup({
      filename,
      filePath,
      backupType: 'manual',
      status: 'in_progress',
      collections: collections || [],
      createdBy: req.admin?.id || req.user?.id,
      retentionDays: retentionDays || 30,
      expiresAt: new Date(Date.now() + (retentionDays || 30) * 24 * 60 * 60 * 1000),
    });

    await backup.save();

    // Perform backup asynchronously
    (async () => {
      try {
        const db = mongoose.connection.db!;
        const backupData: any = {};

        if (collections && collections.length > 0) {
          // Backup specific collections
          for (const collectionName of collections) {
            const collection = db.collection(collectionName);
            const data = await collection.find({}).toArray();
            backupData[collectionName] = data;
          }
        } else {
          // Backup all collections
          const collectionNames = await db.listCollections().toArray();
          for (const { name } of collectionNames) {
            const collection = db.collection(name);
            const data = await collection.find({}).toArray();
            backupData[name] = data;
          }
        }

        // Write to file
        await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));
        const stats = await fs.stat(filePath);

        // Update backup record
        backup.status = 'completed';
        backup.completedAt = new Date();
        backup.fileSize = stats.size;
        backup.collections = Object.keys(backupData);
        await backup.save();

        logger.info(`Backup completed: ${filename}`);
      } catch (error: unknown) {
        backup.status = 'failed';
        backup.error = error instanceof Error ? error.message : String(error);
        await backup.save();
        logger.error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();

    res.status(202).json({
      success: true,
      data: {
        backup: {
          id: backup._id.toString(),
          filename: backup.filename,
          status: backup.status,
        },
      },
      message: 'Backup started',
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/backups/:id/verify
 * Verify a backup
 */
router.post('/:id/verify', async (req: AdminRequest, res, next) => {
  try {
    const backup = await DatabaseBackup.findById(req.params.id);

    if (!backup) {
      throw new AppError('Backup not found', 404);
    }

    if (backup.status !== 'completed') {
      throw new AppError('Backup is not completed', 400);
    }

    // Verify backup file exists and is readable
    try {
      const data = await fs.readFile(backup.filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Basic verification - check if it's valid JSON with data
      const isValid = typeof parsed === 'object' && Object.keys(parsed).length > 0;

      backup.verified = isValid;
      backup.verifiedAt = new Date();
      await backup.save();

      res.json({
        success: true,
        data: {
          verified: isValid,
          message: isValid ? 'Backup verified successfully' : 'Backup verification failed',
        },
      });
    } catch (error: unknown) {
      backup.verified = false;
      await backup.save();
      throw new AppError(
        `Backup verification failed: ${error instanceof Error ? error.message : String(error)}`,
        400
      );
    }
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/backups/:id/restore
 * Restore from backup
 */
router.post('/:id/restore', async (req: AdminRequest, res, next) => {
  try {
    const backup = await DatabaseBackup.findById(req.params.id);

    if (!backup) {
      throw new AppError('Backup not found', 404);
    }

    if (backup.status !== 'completed') {
      throw new AppError('Backup is not completed', 400);
    }

    // Read backup file
    const data = await fs.readFile(backup.filePath, 'utf-8');
    const backupData = JSON.parse(data);
    const db = mongoose.connection.db!;

    // Restore collections
    for (const [collectionName, documents] of Object.entries(backupData)) {
      const collection = db.collection(collectionName);

      // Clear existing data (optional - could be made configurable)
      if (req.body.clearExisting) {
        await collection.deleteMany({});
      }

      // Insert backup data
      if (Array.isArray(documents) && documents.length > 0) {
        await collection.insertMany(documents);
      }
    }

    logger.info(`Admin ${req.admin?.email} restored from backup ${backup.filename}`);

    res.json({
      success: true,
      message: 'Backup restored successfully',
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/admin/backups/:id
 * Delete a backup
 */
router.delete('/:id', async (req: AdminRequest, res, next) => {
  try {
    const backup = await DatabaseBackup.findById(req.params.id);

    if (!backup) {
      throw new AppError('Backup not found', 404);
    }

    // Delete file
    try {
      await fs.unlink(backup.filePath);
    } catch (error: unknown) {
      // File might not exist, continue
    }

    // Delete record
    await DatabaseBackup.findByIdAndDelete(req.params.id);

    logger.info(`Admin ${req.admin?.email} deleted backup ${backup.filename}`);

    res.json({
      success: true,
      message: 'Backup deleted',
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
