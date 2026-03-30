/**
 * Community Sharing Service
 * Manages marketplace and sharing features
 */

import { MarketplaceListing, IMarketplaceListing } from '../models/MarketplaceListing.model.js';
import { ProcessImprovement } from '../models/ProcessImprovement.model.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface MarketplaceSearch {
  query?: string;
  category?: string;
  minRating?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ForkResult {
  forkedId: string;
  originalId: string;
  customizations: Record<string, any>;
}

class CommunitySharingService {
  /**
   * Publish improvement to marketplace
   */
  async publishToMarketplace(
    improvementId: string,
    userId: string,
    options?: {
      license?: 'public' | 'private' | 'restricted';
      organizationId?: string;
    }
  ): Promise<IMarketplaceListing> {
    try {
      const improvement = await ProcessImprovement.findOne({ id: improvementId });
      if (!improvement) {
        throw new Error(`Process improvement not found: ${improvementId}`);
      }

      // Check if already listed
      const existing = await MarketplaceListing.findOne({ improvementId });
      if (existing) {
        throw new Error('Improvement already published to marketplace');
      }

      const listingId = `listing-${crypto.randomUUID()}`;

      const listing = await MarketplaceListing.create({
        id: listingId,
        improvementId,
        title: improvement.title,
        description: improvement.description,
        category: improvement.category,
        published: true,
        publishedAt: new Date(),
        publishedBy: userId,
        ratings: [],
        averageRating: 0,
        totalRatings: 0,
        downloads: 0,
        forks: 0,
        views: 0,
        shareable: true,
        license: options?.license || 'public',
        organizationId: options?.organizationId,
        tags: improvement.tags || [],
        keywords: improvement.keywords || []
      });

      logger.info(`Published improvement to marketplace: ${improvementId} -> ${listingId}`);
      return listing;
    } catch (error: any) {
      logger.error('Failed to publish to marketplace:', error);
      throw error;
    }
  }

  /**
   * Search marketplace
   */
  async searchMarketplace(search: MarketplaceSearch): Promise<{
    listings: IMarketplaceListing[];
    total: number;
  }> {
    try {
      const filter: any = { published: true };

      if (search.query) {
        filter.$text = { $search: search.query };
      }
      if (search.category) {
        filter.category = search.category;
      }
      if (search.minRating) {
        filter.averageRating = { $gte: search.minRating };
      }
      if (search.tags && search.tags.length > 0) {
        filter.tags = { $in: search.tags };
      }

      const limit = search.limit || 20;
      const offset = search.offset || 0;

      const [listings, total] = await Promise.all([
        MarketplaceListing.find(filter)
          .sort({ averageRating: -1, downloads: -1, publishedAt: -1 })
          .limit(limit)
          .skip(offset)
          .lean(),
        MarketplaceListing.countDocuments(filter)
      ]);

      return { listings, total };
    } catch (error: any) {
      logger.error('Failed to search marketplace:', error);
      throw error;
    }
  }

  /**
   * Rate improvement
   */
  async rateImprovement(
    listingId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const listing = await MarketplaceListing.findOne({ id: listingId });
      if (!listing) {
        throw new Error(`Marketplace listing not found: ${listingId}`);
      }

      // Check if user already rated
      const existingRating = listing.ratings.find(r => r.userId === userId);
      if (existingRating) {
        // Update existing rating
        existingRating.rating = rating;
        existingRating.comment = comment;
        existingRating.timestamp = new Date();
      } else {
        // Add new rating
        listing.ratings.push({
          userId,
          rating,
          comment,
          timestamp: new Date()
        });
      }

      // Recalculate average
      const totalRatings = listing.ratings.length;
      const sumRatings = listing.ratings.reduce((sum, r) => sum + r.rating, 0);
      listing.averageRating = sumRatings / totalRatings;
      listing.totalRatings = totalRatings;

      await listing.save();
      logger.info(`Rated listing: ${listingId} with ${rating} stars`);
    } catch (error: any) {
      logger.error('Failed to rate improvement:', error);
      throw error;
    }
  }

  /**
   * Fork improvement
   */
  async forkImprovement(
    listingId: string,
    userId: string,
    customizations: Record<string, any>
  ): Promise<ForkResult> {
    try {
      const listing = await MarketplaceListing.findOne({ id: listingId });
      if (!listing) {
        throw new Error(`Marketplace listing not found: ${listingId}`);
      }

      const originalImprovement = await ProcessImprovement.findOne({ id: listing.improvementId });
      if (!originalImprovement) {
        throw new Error(`Original improvement not found: ${listing.improvementId}`);
      }

      // Create forked improvement
      const forkedId = `pi-${crypto.randomUUID()}`;
      const forkedImprovement = await ProcessImprovement.create({
        id: forkedId,
        title: customizations.title || `${originalImprovement.title} (Forked)`,
        description: customizations.description || originalImprovement.description,
        category: customizations.category || originalImprovement.category,
        type: customizations.type || originalImprovement.type,
        content: customizations.content || originalImprovement.content,
        structuredContent: customizations.structuredContent || originalImprovement.structuredContent,
        version: 1,
        status: 'draft',
        priority: originalImprovement.priority,
        applicableTo: customizations.applicableTo || originalImprovement.applicableTo,
        usage: {
          timesUsed: 0,
          successRate: 0
        },
        improvementHistory: [{
          version: 1,
          changedBy: userId,
          changeDate: new Date(),
          changeReason: `Forked from ${listingId}`,
          changes: 'Forked from marketplace listing'
        }],
        tags: customizations.tags || originalImprovement.tags,
        keywords: customizations.keywords || originalImprovement.keywords,
        quality: {
          completeness: originalImprovement.quality.completeness,
          clarity: originalImprovement.quality.clarity,
          usefulness: 0
        },
        autoGenerated: false,
        source: {
          type: 'imported',
          projectId: listing.improvementId
        },
        knowledgeBaseRefs: [],
        createdBy: userId,
        updatedBy: userId
      });

      // Update fork count
      listing.forks += 1;
      await listing.save();

      logger.info(`Forked improvement: ${listingId} -> ${forkedId}`);

      return {
        forkedId,
        originalId: listing.improvementId,
        customizations
      };
    } catch (error: any) {
      logger.error('Failed to fork improvement:', error);
      throw error;
    }
  }

  /**
   * Import from marketplace
   */
  async importFromMarketplace(
    listingId: string,
    userId: string
  ): Promise<string> {
    try {
      const listing = await MarketplaceListing.findOne({ id: listingId });
      if (!listing) {
        throw new Error(`Marketplace listing not found: ${listingId}`);
      }

      const originalImprovement = await ProcessImprovement.findOne({ id: listing.improvementId });
      if (!originalImprovement) {
        throw new Error(`Original improvement not found: ${listing.improvementId}`);
      }

      // Create imported improvement
      const importedId = `pi-${crypto.randomUUID()}`;
      await ProcessImprovement.create({
        id: importedId,
        title: originalImprovement.title,
        description: originalImprovement.description,
        category: originalImprovement.category,
        type: originalImprovement.type,
        content: originalImprovement.content,
        structuredContent: originalImprovement.structuredContent,
        version: 1,
        status: 'draft',
        priority: originalImprovement.priority,
        applicableTo: originalImprovement.applicableTo,
        usage: {
          timesUsed: 0,
          successRate: 0
        },
        improvementHistory: [{
          version: 1,
          changedBy: userId,
          changeDate: new Date(),
          changeReason: `Imported from marketplace listing ${listingId}`,
          changes: 'Imported from marketplace'
        }],
        tags: originalImprovement.tags,
        keywords: originalImprovement.keywords,
        quality: {
          completeness: originalImprovement.quality.completeness,
          clarity: originalImprovement.quality.clarity,
          usefulness: 0
        },
        autoGenerated: false,
        source: {
          type: 'imported',
          projectId: listing.improvementId
        },
        knowledgeBaseRefs: [],
        createdBy: userId,
        updatedBy: userId
      });

      // Update download count
      listing.downloads += 1;
      listing.views += 1;
      await listing.save();

      logger.info(`Imported improvement from marketplace: ${listingId} -> ${importedId}`);
      return importedId;
    } catch (error: any) {
      logger.error('Failed to import from marketplace:', error);
      throw error;
    }
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats(): Promise<{
    totalListings: number;
    totalDownloads: number;
    totalForks: number;
    averageRating: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    try {
      const listings = await MarketplaceListing.find({ published: true }).lean();

      const totalListings = listings.length;
      const totalDownloads = listings.reduce((sum, l) => sum + l.downloads, 0);
      const totalForks = listings.reduce((sum, l) => sum + l.forks, 0);
      const averageRating = listings.length > 0
        ? listings.reduce((sum, l) => sum + l.averageRating, 0) / listings.length
        : 0;

      // Top categories
      const categoryCounts = new Map<string, number>();
      listings.forEach(l => {
        categoryCounts.set(l.category, (categoryCounts.get(l.category) || 0) + 1);
      });

      const topCategories = Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalListings,
        totalDownloads,
        totalForks,
        averageRating,
        topCategories
      };
    } catch (error: any) {
      logger.error('Failed to get marketplace stats:', error);
      throw error;
    }
  }
}

export const communitySharingService = new CommunitySharingService();
















