/**
 * Database Migration System
 * Handles schema changes and data migrations
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

const migrations: Migration[] = [];

/**
 * Register a migration
 */
export function registerMigration(migration: Migration) {
  migrations.push(migration);
  migrations.sort((a, b) => a.version - b.version);
}

/**
 * Get current database version
 */
async function getCurrentVersion(): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const collection = db.collection('migrations');
  const latest = await collection.findOne({}, { sort: { version: -1 } });
  return latest?.version || 0;
}

/**
 * Record migration execution
 */
async function recordMigration(version: number, name: string, direction: 'up' | 'down') {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const collection = db.collection('migrations');
  await collection.insertOne({
    version,
    name,
    direction,
    executedAt: new Date()
  });
}

/**
 * Run migrations
 */
export async function runMigrations(targetVersion?: number): Promise<void> {
  try {
    const currentVersion = await getCurrentVersion();
    const target = targetVersion ?? migrations[migrations.length - 1]?.version ?? currentVersion;

    if (target > currentVersion) {
      // Run forward migrations
      const toRun = migrations.filter(m => m.version > currentVersion && m.version <= target);
      for (const migration of toRun) {
        logger.info(`Running migration ${migration.version}: ${migration.name}`);
        await migration.up();
        await recordMigration(migration.version, migration.name, 'up');
        logger.info(`Migration ${migration.version} completed`);
      }
    } else if (target < currentVersion) {
      // Run rollback migrations
      const toRollback = migrations
        .filter(m => m.version > target && m.version <= currentVersion)
        .reverse();
      for (const migration of toRollback) {
        logger.info(`Rolling back migration ${migration.version}: ${migration.name}`);
        await migration.down();
        await recordMigration(migration.version, migration.name, 'down');
        logger.info(`Migration ${migration.version} rolled back`);
      }
    } else {
      logger.info('Database is up to date');
    }
  } catch (error: unknown) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Example migration - add indexes
registerMigration({
  version: 1,
  name: 'add_user_email_index',
  up: async () => {
    const { User } = await import('../models/User.model.js');
    await User.collection.createIndex({ email: 1 }, { unique: true });
  },
  down: async () => {
    const { User } = await import('../models/User.model.js');
    await User.collection.dropIndex('email_1');
  }
});

export default { runMigrations, registerMigration };




