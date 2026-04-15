/**
 * Knowledge Decay Service
 * Weights older knowledge less and auto-archives outdated knowledge
 */

import { logger } from '../utils/logger.js';
import { KnowledgeBase, IKnowledgeBase } from '../models/KnowledgeBase.model.js';

export interface DecayConfig {
  decayRate: number; // 0-1, how fast knowledge decays
  archiveThreshold: number; // Days before archiving
  minConfidence: number; // Minimum confidence to keep active
}

class KnowledgeDecayService {
  /**
   * Apply knowledge decay
   */
  async applyDecay(
    knowledge: IKnowledgeBase,
    config: DecayConfig = {
      decayRate: 0.1, // 10% per month
      archiveThreshold: 365, // 1 year
      minConfidence: 30
    }
  ): Promise<IKnowledgeBase> {
    const now = new Date();
    const ageInDays = (now.getTime() - new Date(knowledge.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    const ageInMonths = ageInDays / 30;

    // Calculate decay factor
    const decayFactor = Math.pow(1 - config.decayRate, ageInMonths);

    // Apply decay to quality metrics
    knowledge.quality.completeness = Math.max(0, knowledge.quality.completeness * decayFactor);
    knowledge.quality.accuracy = Math.max(0, knowledge.quality.accuracy * decayFactor);
    knowledge.quality.usefulness = Math.max(0, knowledge.quality.usefulness * decayFactor);

    // Check if should be archived
    if (ageInDays > config.archiveThreshold) {
      const avgQuality = (
        knowledge.quality.completeness +
        knowledge.quality.accuracy +
        knowledge.quality.usefulness
      ) / 3;

      if (avgQuality < config.minConfidence) {
        knowledge.status = 'archived';
        logger.info(`Archived knowledge ${knowledge.id} due to age and low quality`);
      }
    }

    await knowledge.save();
    return knowledge;
  }

  /**
   * Process all knowledge for decay
   */
  async processDecay(config?: DecayConfig): Promise<{
    processed: number;
    archived: number;
    updated: number;
  }> {
    const knowledgeItems = await KnowledgeBase.find({
      status: { $in: ['active', 'draft'] }
    }).lean() as any;

    let archived = 0;
    let updated = 0;

    for (const knowledge of knowledgeItems) {
      const beforeStatus = knowledge.status;
      await this.applyDecay(knowledge as IKnowledgeBase, config);
      
      if (knowledge.status === 'archived' && beforeStatus !== 'archived') {
        archived++;
      } else if (knowledge.status === beforeStatus) {
        updated++;
      }
    }

    return {
      processed: knowledgeItems.length,
      archived,
      updated
    };
  }

  /**
   * Calculate weight for knowledge based on age
   */
  calculateWeight(knowledge: IKnowledgeBase): number {
    const now = new Date();
    const ageInDays = (now.getTime() - new Date(knowledge.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    
    // Exponential decay: weight = e^(-age/365)
    const weight = Math.exp(-ageInDays / 365);
    
    // Also consider quality
    const avgQuality = (
      knowledge.quality.completeness +
      knowledge.quality.accuracy +
      knowledge.quality.usefulness
    ) / 3;

    return (weight * 0.6) + ((avgQuality / 100) * 0.4);
  }
}

export const knowledgeDecayService = new KnowledgeDecayService();



