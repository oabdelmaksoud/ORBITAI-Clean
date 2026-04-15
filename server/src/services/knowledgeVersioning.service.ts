/**
 * Knowledge Versioning Service
 * Manages knowledge versioning, validity periods, and deprecation
 */

import { logger } from '../utils/logger.js';
import { KnowledgeBase, IKnowledgeBase } from '../models/KnowledgeBase.model.js';

export interface KnowledgeVersion {
  version: number;
  content: string;
  changedBy: string;
  changeDate: Date;
  changeReason: string;
  validityPeriod?: {
    start: Date;
    end?: Date;
  };
}

class KnowledgeVersioningService {
  /**
   * Create new version of knowledge
   */
  async createVersion(
    knowledgeId: string,
    newContent: string,
    changedBy: string,
    _changeReason: string,
    validityPeriod?: { start: Date; end?: Date }
  ): Promise<IKnowledgeBase> {
    try {
      const knowledge = await KnowledgeBase.findOne({ id: knowledgeId });
      if (!knowledge) {
        throw new Error('Knowledge not found');
      }

      // Add current version to history
      if (!knowledge.versionHistory) {
        knowledge.versionHistory = [];
      }

      knowledge.versionHistory.push({
        version: knowledge.version,
        content: knowledge.content,
        changedBy: knowledge.updatedBy || 'system',
        changeDate: knowledge.updatedAt || new Date(),
        changeReason: 'Previous version',
        validityPeriod: validityPeriod ? {
          start: validityPeriod.start,
          end: validityPeriod.end
        } : undefined
      });

      // Update to new version
      knowledge.version++;
      knowledge.content = newContent;
      knowledge.updatedBy = changedBy;

      await knowledge.save();

      logger.info(`Created version ${knowledge.version} for knowledge ${knowledgeId}`);
      return knowledge;
    } catch (error: unknown) {
      logger.error('Failed to create knowledge version:', error);
      throw error;
    }
  }

  /**
   * Deprecate knowledge
   */
  async deprecate(
    knowledgeId: string,
    reason: string,
    deprecatedBy: string
  ): Promise<void> {
    await KnowledgeBase.findOneAndUpdate(
      { id: knowledgeId },
      {
        status: 'deprecated',
        deprecatedAt: new Date(),
        deprecatedReason: reason,
        updatedBy: deprecatedBy
      }
    );
  }

  /**
   * Rollback to previous version
   */
  async rollback(
    knowledgeId: string,
    targetVersion: number,
    rollbackReason: string,
    rolledBackBy: string
  ): Promise<IKnowledgeBase> {
    const knowledge = await KnowledgeBase.findOne({ id: knowledgeId });
    if (!knowledge) {
      throw new Error('Knowledge not found');
    }

    const targetVersionHistory = knowledge.versionHistory?.find(v => v.version === targetVersion);
    if (!targetVersionHistory) {
      throw new Error(`Version ${targetVersion} not found in history`);
    }

    // Create new version with old content
    await this.createVersion(
      knowledgeId,
      targetVersionHistory.content,
      rolledBackBy,
      `Rollback to version ${targetVersion}: ${rollbackReason}`
    );

    return knowledge;
  }

  /**
   * Check validity periods
   */
  async checkValidityPeriods(): Promise<Array<{
    knowledgeId: string;
    name: string;
    expired: boolean;
    expiresAt?: Date;
  }>> {
    const expired: Array<{
      knowledgeId: string;
      name: string;
      expired: boolean;
      expiresAt?: Date;
    }> = [];

    const now = new Date();
    const knowledgeItems = await KnowledgeBase.find({
      status: 'active',
      'versionHistory.validityPeriod.end': { $exists: true }
    }).lean();

    for (const item of knowledgeItems) {
      const currentVersion = item.versionHistory?.[item.versionHistory.length - 1];
      if (currentVersion?.validityPeriod?.end) {
        if (new Date(currentVersion.validityPeriod.end) < now) {
          expired.push({
            knowledgeId: item.id,
            name: item.name,
            expired: true,
            expiresAt: currentVersion.validityPeriod.end
          });
        }
      }
    }

    return expired;
  }
}

export const knowledgeVersioningService = new KnowledgeVersioningService();



