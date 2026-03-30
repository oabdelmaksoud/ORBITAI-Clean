/**
 * Automated Backup Scheduler Service
 * Schedules and manages automated MongoDB backups
 */

import { logger } from '../utils/logger.js';
import { DatabaseBackup } from '../models/DatabaseBackup.model.js';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '../../backups');

export interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format (24-hour)
  retentionDays: number;
  collections?: string[]; // Empty = all collections
}

class BackupSchedulerService {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start automated backup scheduler
   */
  async start(): Promise<void> {
    if (this.interval) {
      logger.warn('[BackupScheduler] Already running');
      return;
    }

    // Check for backup schedule in environment or use defaults
    const schedule: BackupSchedule = {
      enabled: process.env.BACKUP_ENABLED === 'true',
      frequency: (process.env.BACKUP_FREQUENCY as any) || 'daily',
      time: process.env.BACKUP_TIME || '02:00', // Default: 2 AM
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
      collections: process.env.BACKUP_COLLECTIONS?.split(',') || []
    };

    if (!schedule.enabled) {
      logger.info('[BackupScheduler] Automated backups disabled (set BACKUP_ENABLED=true to enable)');
      return;
    }

    logger.info(`[BackupScheduler] Starting automated backup scheduler (${schedule.frequency} at ${schedule.time})`);

    // Calculate next backup time
    const nextBackup = this.calculateNextBackupTime(schedule.frequency, schedule.time);
    const delay = nextBackup.getTime() - Date.now();

    logger.info(`[BackupScheduler] Next backup scheduled for: ${nextBackup.toISOString()}`);

    // Schedule first backup
    setTimeout(() => {
      this.performScheduledBackup(schedule);
      this.scheduleRecurringBackups(schedule);
    }, delay);
  }

  /**
   * Stop automated backup scheduler
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('[BackupScheduler] Stopped');
    }
  }

  /**
   * Calculate next backup time based on frequency and time
   */
  private calculateNextBackupTime(frequency: BackupSchedule['frequency'], time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for next period
    if (next.getTime() <= now.getTime()) {
      switch (frequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          break;
      }
    }

    return next;
  }

  /**
   * Schedule recurring backups
   */
  private scheduleRecurringBackups(schedule: BackupSchedule): void {
    const intervalMs = this.getIntervalMs(schedule.frequency);

    this.interval = setInterval(() => {
      this.performScheduledBackup(schedule);
    }, intervalMs);

    logger.info(`[BackupScheduler] Recurring backups scheduled every ${schedule.frequency}`);
  }

  /**
   * Get interval in milliseconds for frequency
   */
  private getIntervalMs(frequency: BackupSchedule['frequency']): number {
    switch (frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // ~30 days
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Perform scheduled backup
   */
  private async performScheduledBackup(schedule: BackupSchedule): Promise<void> {
    if (this.isRunning) {
      logger.warn('[BackupScheduler] Backup already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${schedule.frequency}-${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    try {
      // Ensure backup directory exists
      await fs.mkdir(BACKUP_DIR, { recursive: true });

      // Create backup record
      const backup = new DatabaseBackup({
        filename,
        filePath,
        backupType: 'automated',
        status: 'in_progress',
        collections: schedule.collections || [],
        retentionDays: schedule.retentionDays,
        expiresAt: new Date(Date.now() + schedule.retentionDays * 24 * 60 * 60 * 1000)
      });

      await backup.save();

      logger.info(`[BackupScheduler] Starting automated backup: ${filename}`);

      // Perform backup
      const db = mongoose.connection.db;
      const backupData: any = {};

      if (schedule.collections && schedule.collections.length > 0) {
        // Backup specific collections
        for (const collectionName of schedule.collections) {
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

      logger.info(`[BackupScheduler] Backup completed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

      // Clean up old backups
      await this.cleanupOldBackups(schedule.retentionDays);
    } catch (error: any) {
      logger.error(`[BackupScheduler] Backup failed: ${error.message}`, error);
      
      // Try to update backup record if it exists
      try {
        const backup = await DatabaseBackup.findOne({ filename });
        if (backup) {
          backup.status = 'failed';
          backup.error = error.message;
          await backup.save();
        }
      } catch (updateError) {
        // Ignore update errors
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(retentionDays: number): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      // Find expired backups
      const expiredBackups = await DatabaseBackup.find({
        expiresAt: { $lt: cutoffDate },
        status: 'completed'
      });

      for (const backup of expiredBackups) {
        try {
          // Delete file
          await fs.unlink(backup.filePath).catch(() => {
            // File might not exist, continue
          });
          
          // Delete record
          await DatabaseBackup.findByIdAndDelete(backup._id);
          logger.info(`[BackupScheduler] Cleaned up expired backup: ${backup.filename}`);
        } catch (error: any) {
          logger.error(`[BackupScheduler] Failed to cleanup backup ${backup.filename}: ${error.message}`);
        }
      }
    } catch (error: any) {
      logger.error(`[BackupScheduler] Cleanup cleanup failed: ${error.message}`);
    }
  }
}

export const backupScheduler = new BackupSchedulerService();

