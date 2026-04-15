/**
 * Knowledge Validation Service
 * Validates learned patterns before applying, detects negative learning
 */

import { logger } from '../utils/logger.js';
import { KnowledgeBase, IKnowledgeBase } from '../models/KnowledgeBase.model.js';
import { Project } from '../models/Project.model.js';
// import { Type, Schema } from '@google/genai';

export interface ValidationResult {
  knowledgeId: string;
  valid: boolean;
  confidence: number; // 0-100
  issues: Array<{
    type: 'negative_learning' | 'outdated' | 'low_confidence' | 'context_mismatch';
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
  testedOnProjects: number;
  successRate: number; // 0-100
}

class KnowledgeValidationService {
  /**
   * Validate knowledge before applying
   */
  async validateKnowledge(
    knowledgeId: string,
    targetProjectId?: string
  ): Promise<ValidationResult> {
    try {
      const knowledge = await KnowledgeBase.findOne({ id: knowledgeId });
      if (!knowledge) {
        throw new Error('Knowledge not found');
      }

      const issues: ValidationResult['issues'] = [];
      let testedOnProjects = 0;
      let successRate = 0;

      // Check for negative learning
      const negativeLearning = await this.detectNegativeLearning(knowledge);
      if (negativeLearning) {
        issues.push({
          type: 'negative_learning',
          severity: 'high',
          description: negativeLearning,
        });
      }

      // Check if knowledge is outdated
      if (knowledge.status === 'deprecated' || knowledge.deprecatedAt) {
        issues.push({
          type: 'outdated',
          severity: 'high',
          description: 'Knowledge has been deprecated',
        });
      }

      // Check confidence score
      const avgConfidence = this.calculateAverageConfidence(knowledge);
      if (avgConfidence < 60) {
        issues.push({
          type: 'low_confidence',
          severity: 'medium',
          description: `Low confidence score: ${avgConfidence}%`,
        });
      }

      // Test on similar projects
      if (targetProjectId) {
        const testResult = await this.testOnSimilarProjects(knowledge, targetProjectId);
        testedOnProjects = testResult.tested;
        successRate = testResult.successRate;

        if (testResult.successRate < 70) {
          issues.push({
            type: 'context_mismatch',
            severity: 'medium',
            description: `Low success rate on similar projects: ${testResult.successRate}%`,
          });
        }
      }

      const valid = issues.filter(i => i.severity === 'high').length === 0;

      return {
        knowledgeId,
        valid,
        confidence: avgConfidence,
        issues,
        testedOnProjects,
        successRate,
      };
    } catch (error: unknown) {
      logger.error('Knowledge validation failed:', error);
      throw error;
    }
  }

  /**
   * Detect negative learning (learned from mistakes)
   */
  private async detectNegativeLearning(knowledge: IKnowledgeBase): Promise<string | null> {
    // Check if knowledge was learned from failed tasks
    if (knowledge.source?.type === 'agent-learning') {
      // Would check task execution history
      // For now, check quality metrics
      if (knowledge.quality.usefulness < 50 && knowledge.quality.accuracy < 50) {
        return 'Knowledge learned from low-quality or failed executions';
      }
    }

    // Check usage feedback
    if (knowledge.usage.notHelpfulCount > knowledge.usage.helpfulCount * 2) {
      return 'Knowledge has more negative feedback than positive';
    }

    return null;
  }

  /**
   * Calculate average confidence
   */
  private calculateAverageConfidence(knowledge: IKnowledgeBase): number {
    // Would calculate from knowledge domains, skills, etc.
    // Simplified for now
    return knowledge.quality.usefulness || 50;
  }

  /**
   * Test knowledge on similar projects
   */
  private async testOnSimilarProjects(
    knowledge: IKnowledgeBase,
    targetProjectId: string
  ): Promise<{ tested: number; successRate: number }> {
    // Find similar projects
    const targetProject = await Project.findById(targetProjectId);
    if (!targetProject) {
      return { tested: 0, successRate: 0 };
    }

    // Find projects with similar characteristics
    const similarProjects = await Project.find({
      $or: [
        { methodology: targetProject.methodology },
        { standards: { $in: (targetProject as any).standards || [] } },
      ],
      _id: { $ne: targetProjectId },
    })
      .limit(5)
      .lean();

    let tested = 0;
    let successful = 0;

    // Test knowledge application (simplified)
    for (const _project of similarProjects) {
      tested++;
      // Would actually test knowledge application
      // For now, assume 80% success rate if knowledge is high quality
      if (knowledge.quality.usefulness > 70) {
        successful++;
      }
    }

    const successRate = tested > 0 ? (successful / tested) * 100 : 0;

    return { tested, successRate };
  }

  /**
   * Validate before applying to project
   */
  async validateBeforeApplying(knowledgeId: string, projectId: string): Promise<boolean> {
    const validation = await this.validateKnowledge(knowledgeId, projectId);
    return validation.valid && validation.confidence >= 60;
  }
}

export const knowledgeValidationService = new KnowledgeValidationService();
