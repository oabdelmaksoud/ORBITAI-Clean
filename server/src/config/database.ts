import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './env.js';

export async function connectDatabase(): Promise<void> {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      logger.info('MongoDB already connected');
      return;
    }

    // Set buffer commands to false to prevent operations before connection
    // mongoose.set('bufferCommands', false); // Disabled to prevent crashes on startup race conditions


    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 10000, // Increased from 5000 to 10000
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true
    });
    logger.info('MongoDB connected successfully');

    // Enable query profiling for slow queries (queries > 100ms)
    // This helps identify performance bottlenecks
    try {
      const db = mongoose.connection.db;
      if (db) {
        // Check current profiling status first
        const currentStatus = await db.command({ profile: -1 });

        if (currentStatus.was === 0) {
          // Profiling is disabled, try to enable it
          try {
            // Set profiling level: 1 = log slow operations, 2 = log all operations
            // Level 1 with slowms 100 = log queries taking > 100ms
            const result = await db.command({ profile: 1, slowms: 100 });
            logger.info(`MongoDB query profiling enabled (level ${result.was}, slowms: ${result.slowms || 100}ms)`);
          } catch (enableError: any) {
            // Log warning but don't fail connection if profiling can't be enabled
            logger.warn('Could not enable MongoDB query profiling:', enableError.message);
            logger.warn('This may require admin privileges or MongoDB Atlas may have restrictions');
            logger.warn('You can enable it manually with: db.setProfilingLevel(1, { slowms: 100 })');
            logger.warn('Or use the admin API endpoint: POST /api/admin/performance/enable-profiling');
          }
        } else {
          // Profiling is already enabled
          logger.info(`MongoDB query profiling is already enabled (level ${currentStatus.was}, slowms: ${currentStatus.slowms || 100}ms)`);
        }
      }
    } catch (profilingError: any) {
      // Log warning but don't fail connection if profiling check/enable fails
      logger.warn('Could not check/enable MongoDB query profiling:', profilingError.message);
      logger.warn('This is not critical - profiling may require admin privileges or MongoDB Atlas may have restrictions');
      logger.warn('You can enable it manually with: db.setProfilingLevel(1, { slowms: 100 })');
    }

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    logger.warn('⚠️  Starting server without database connection. Some features may not work.');
    // Do not throw error to allow server to start in degraded mode
    // throw error; 
  }
}

export default mongoose.connection;

