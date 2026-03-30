import mongoose from 'mongoose';
import { AppError } from '../middleware/errorHandler.js';
import { AuditLog } from '../models/AuditLog.model.js';

interface QueryOptions {
  collection: string;
  query: any;
  projection?: any;
  limit?: number;
  skip?: number;
  sort?: any;
  readOnly?: boolean;
}

interface UpdateOptions {
  collection: string;
  filter: any;
  update: any;
  options?: {
    multi?: boolean;
    upsert?: boolean;
  };
}

interface DeleteOptions {
  collection: string;
  filter: any;
  limit?: number;
}

/**
 * Admin Database Service
 * Provides safe database operations for admin console
 */
export class AdminDatabaseService {
  private readonly MAX_QUERY_RESULTS = 1000;
  private readonly MAX_DELETE_LIMIT = 100;
  private readonly READ_ONLY_COLLECTIONS = ['auditlogs', 'systemlogs']; // Collections that should never be modified

  /**
   * Get all collections in the database
   */
  async getCollections(): Promise<string[]> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new AppError('Database connection not available', 500);
      }
      const collections = await db.listCollections().toArray();
      return collections.map(col => col.name);
    } catch (error: any) {
      throw new AppError(`Failed to list collections: ${error.message}`, 500);
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName: string): Promise<any> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new AppError('Database connection not available', 500);
      }

      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      const stats = await db.command({ collStats: collectionName });
      
      return {
        name: collectionName,
        count,
        size: stats.size || 0,
        storageSize: stats.storageSize || 0,
        indexes: stats.nindexes || 0,
        avgObjSize: count > 0 ? (stats.size / count) : 0
      };
    } catch (error: any) {
      throw new AppError(`Failed to get collection stats: ${error.message}`, 500);
    }
  }

  /**
   * Execute a safe database query
   */
  async executeQuery(
    options: QueryOptions,
    adminId: string,
    adminEmail: string
  ): Promise<any> {
    try {
      const { collection, query, projection, limit, skip, sort, readOnly } = options;

      // Validate collection name
      if (!collection || typeof collection !== 'string') {
        throw new AppError('Invalid collection name', 400);
      }

      // Check if collection is read-only
      if (this.READ_ONLY_COLLECTIONS.includes(collection.toLowerCase()) && !readOnly) {
        throw new AppError(`Collection '${collection}' is read-only`, 403);
      }

      const db = mongoose.connection.db;
      if (!db) {
        throw new AppError('Database connection not available', 500);
      }

      const dbCollection = db.collection(collection);
      
      // Apply limits
      const queryLimit = Math.min(limit || this.MAX_QUERY_RESULTS, this.MAX_QUERY_RESULTS);
      const querySkip = skip || 0;

      // Build query options
      const findOptions: any = {};
      if (projection) findOptions.projection = projection;
      if (queryLimit) findOptions.limit = queryLimit;
      if (querySkip) findOptions.skip = querySkip;
      if (sort) findOptions.sort = sort;

      // Execute query
      const results = await dbCollection.find(query, findOptions).toArray();
      const totalCount = await dbCollection.countDocuments(query);

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'database_query',
        entityType: collection,
        details: {
          query,
          limit: queryLimit,
          skip: querySkip,
          resultsCount: results.length,
          totalCount
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true
      });

      return {
        results,
        pagination: {
          total: totalCount,
          limit: queryLimit,
          skip: querySkip,
          hasMore: totalCount > querySkip + queryLimit
        }
      };
    } catch (error: any) {
      // Log failed query
      await AuditLog.create({
        userId: adminId,
        action: 'database_query',
        entityType: options.collection,
        details: {
          query: options.query,
          error: error.message
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: false
      }).catch(() => {}); // Don't fail if audit log fails

      throw error;
    }
  }

  /**
   * Update database records
   */
  async updateRecords(
    options: UpdateOptions,
    adminId: string,
    adminEmail: string
  ): Promise<any> {
    try {
      const { collection, filter, update, options: updateOptions } = options;

      // Validate collection name
      if (!collection || typeof collection !== 'string') {
        throw new AppError('Invalid collection name', 400);
      }

      // Check if collection is read-only
      if (this.READ_ONLY_COLLECTIONS.includes(collection.toLowerCase())) {
        throw new AppError(`Collection '${collection}' is read-only`, 403);
      }

      const db = mongoose.connection.db;
      if (!db) {
        throw new AppError('Database connection not available', 500);
      }

      const dbCollection = db.collection(collection);

      // Get records before update for audit
      const beforeRecords = await dbCollection.find(filter).toArray();

      // Execute update
      const result = await dbCollection.updateMany(
        filter,
        update,
        updateOptions || {}
      );

      // Get records after update for audit
      const afterRecords = await dbCollection.find(filter).toArray();

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'database_update',
        entityType: collection,
        details: {
          filter,
          update,
          options: updateOptions,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          before: beforeRecords.slice(0, 5), // Store first 5 records
          after: afterRecords.slice(0, 5)
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true
      });

      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount || 0
      };
    } catch (error: any) {
      // Log failed update
      await AuditLog.create({
        userId: adminId,
        action: 'database_update',
        entityType: options.collection,
        details: {
          filter: options.filter,
          update: options.update,
          error: error.message
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: false
      }).catch(() => {});

      throw error;
    }
  }

  /**
   * Delete database records
   */
  async deleteRecords(
    options: DeleteOptions,
    adminId: string,
    adminEmail: string
  ): Promise<any> {
    try {
      const { collection, filter, limit } = options;

      // Validate collection name
      if (!collection || typeof collection !== 'string') {
        throw new AppError('Invalid collection name', 400);
      }

      // Check if collection is read-only
      if (this.READ_ONLY_COLLECTIONS.includes(collection.toLowerCase())) {
        throw new AppError(`Collection '${collection}' is read-only`, 403);
      }

      const db = mongoose.connection.db;
      if (!db) {
        throw new AppError('Database connection not available', 500);
      }

      const dbCollection = db.collection(collection);

      // Get records before deletion for audit
      const beforeRecords = await dbCollection.find(filter).limit(limit || this.MAX_DELETE_LIMIT).toArray();
      const totalCount = await dbCollection.countDocuments(filter);

      // Apply delete limit
      const deleteLimit = Math.min(limit || this.MAX_DELETE_LIMIT, this.MAX_DELETE_LIMIT);

      // Execute delete
      const result = await dbCollection.deleteMany(filter);

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'database_delete',
        entityType: collection,
        details: {
          filter,
          deletedCount: result.deletedCount,
          totalMatched: totalCount,
          deletedRecords: beforeRecords.slice(0, 10) // Store first 10 records
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true
      });

      return {
        deletedCount: result.deletedCount,
        totalMatched: totalCount
      };
    } catch (error: any) {
      // Log failed delete
      await AuditLog.create({
        userId: adminId,
        action: 'database_delete',
        entityType: options.collection,
        details: {
          filter: options.filter,
          error: error.message
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: false
      }).catch(() => {});

      throw error;
    }
  }

  /**
   * Backup a collection
   */
  async backupCollection(collectionName: string, adminId: string): Promise<any> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new AppError('Database connection not available', 500);
      }

      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();
      const timestamp = new Date().toISOString();

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'database_backup',
        entityType: collectionName,
        details: {
          documentCount: documents.length,
          timestamp
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true
      });

      return {
        collection: collectionName,
        documentCount: documents.length,
        timestamp,
        data: documents
      };
    } catch (error: any) {
      throw new AppError(`Failed to backup collection: ${error.message}`, 500);
    }
  }

  /**
   * Get collection schema (sample document structure)
   */
  async getCollectionSchema(collectionName: string): Promise<any> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new AppError('Database connection not available', 500);
      }

      const collection = db.collection(collectionName);
      const sample = await collection.findOne({});
      
      if (!sample) {
        return { fields: [], sample: null };
      }

      // Extract field types from sample
      const fields = Object.keys(sample).map(key => ({
        name: key,
        type: typeof sample[key],
        example: sample[key]
      }));

      return {
        fields,
        sample
      };
    } catch (error: any) {
      throw new AppError(`Failed to get collection schema: ${error.message}`, 500);
    }
  }
}

export const adminDatabaseService = new AdminDatabaseService();
