/**
 * Knowledge Sharing Service
 * Shares knowledge between projects with privacy controls and quality gates
 */

import { logger } from '../utils/logger.js';
import { KnowledgeBase, IKnowledgeBase } from '../models/KnowledgeBase.model.js';

export interface SharingOptions {
  scope: 'project' | 'user' | 'global';
  targetProjects?: string[];
  requireQualityGate: boolean;
  minQualityScore: number; // 0-100
}

class KnowledgeSharingService {
  /**
   * Share knowledge with quality gates
   */
  async shareKnowledge(
    knowledgeId: string,
    options: SharingOptions
  ): Promise<IKnowledgeBase> {
    try {
      const knowledge = await KnowledgeBase.findOne({ id: knowledgeId });
      if (!knowledge) {
        throw new Error('Knowledge not found');
      }

      // Check quality gate
      if (options.requireQualityGate) {
        const qualityScore = this.calculateQualityScore(knowledge);
        
        if (qualityScore < options.minQualityScore) {
          throw new Error(
            `Knowledge quality score (${qualityScore}) below minimum (${options.minQualityScore})`
          );
        }

        knowledge.sharing.qualityGate = {
          passed: true,
          score: qualityScore,
          checkedAt: new Date()
        };
      }

      // Update sharing scope
      knowledge.sharing.scope = options.scope;
      if (options.targetProjects) {
        knowledge.sharing.sharedProjects = options.targetProjects;
      }

      await knowledge.save();

      logger.info(`Knowledge ${knowledgeId} shared with scope: ${options.scope}`);
      return knowledge;
    } catch (error: any) {
      logger.error('Failed to share knowledge:', error);
      throw error;
    }
  }

  /**
   * Calculate quality score for sharing
   */
  private calculateQualityScore(knowledge: IKnowledgeBase): number {
    // Weighted average of quality metrics
    const quality = knowledge.quality;
    return Math.round(
      quality.completeness * 0.3 +
      quality.accuracy * 0.3 +
      quality.clarity * 0.2 +
      quality.usefulness * 0.2
    );
  }

  /**
   * Get shared knowledge for project
   */
  async getSharedKnowledge(
    projectId: string,
    userId?: string
  ): Promise<IKnowledgeBase[]> {
    const query: any = {
      $or: [
        { 'sharing.scope': 'global' },
        { 'sharing.sharedProjects': projectId }
      ],
      status: 'active',
      'sharing.qualityGate.passed': true
    };

    if (userId) {
      query.$or.push({
        'sharing.scope': 'user',
        createdBy: userId
      });
    }

    return await KnowledgeBase.find(query).lean();
  }

  /**
   * Filter knowledge by relevance
   */
  async filterByRelevance(
    knowledgeItems: IKnowledgeBase[],
    projectContext: {
      methodology?: string;
      standards?: string[];
      projectType?: string;
    }
  ): Promise<IKnowledgeBase[]> {
    return knowledgeItems.filter(kb => {
      // Check applicability
      const applicable = kb.applicableTo;

      if (projectContext.methodology && applicable.methodologies) {
        if (!applicable.methodologies.includes(projectContext.methodology)) {
          return false;
        }
      }

      if (projectContext.standards && applicable.standards) {
        const hasMatchingStandard = projectContext.standards.some(s =>
          applicable.standards!.includes(s)
        );
        if (!hasMatchingStandard && applicable.standards.length > 0) {
          return false;
        }
      }

      return true;
    });
  }
}

export const knowledgeSharingService = new KnowledgeSharingService();



