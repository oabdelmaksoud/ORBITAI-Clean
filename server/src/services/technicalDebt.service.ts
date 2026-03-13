/**
 * Technical Debt Service
 * Tracks technical debt accumulation, categorizes issues, and calculates debt scores
 */

import { logger } from '../utils/logger.js';
import { TechnicalDebt, ITechnicalDebt } from '../models/TechnicalDebt.model.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { codeQualityAssuranceService } from './codeQualityAssurance.service.js';
import { architectureValidationService } from './architectureValidation.service.js';

export interface TechnicalDebtReport {
  projectId: string;
  totalDebt: number; // Total debt score
  debtScore: number; // 0-100, normalized
  byCategory: Array<{
    category: string;
    count: number;
    totalScore: number;
    averageScore: number;
  }>;
  bySeverity: Array<{
    severity: string;
    count: number;
    totalScore: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    totalScore: number;
  }>;
  trends: Array<{
    date: Date;
    totalDebt: number;
    openDebt: number;
    resolvedDebt: number;
  }>;
  topDebtItems: Array<{
    id: string;
    category: string;
    severity: string;
    description: string;
    debtScore: number;
    estimatedEffort: number;
  }>;
  remediationPriorities: Array<{
    category: string;
    priority: number; // 1-10, higher = more urgent
    reason: string;
    suggestedActions: string[];
  }>;
  generatedAt: Date;
}

class TechnicalDebtService {
  /**
   * Identify technical debt from code artifacts
   */
  async identifyDebt(
    projectId: string,
    artifactId?: string
  ): Promise<ITechnicalDebt[]> {
    try {
      logger.info(`Identifying technical debt for project ${projectId}`);

      const artifacts = artifactId
        ? await Artifact.find({ projectId, _id: artifactId })
        : await Artifact.find({ projectId, type: 'code' });

      const debtItems: ITechnicalDebt[] = [];

      for (const artifact of artifacts) {
        // Analyze code quality
        const qualityReview = await codeQualityAssuranceService.reviewCode(
          artifact.content,
          artifact.metadata?.language || 'typescript',
          {
            projectId,
            artifactId: artifact._id.toString()
          }
        );

        // Extract debt from quality review
        const qualityDebt = this.extractDebtFromQualityReview(
          projectId,
          artifact,
          qualityReview
        );
        debtItems.push(...qualityDebt);

        // Check architecture if framework specified
        if (artifact.metadata?.framework) {
          const pattern = this.inferArchitecturePattern(artifact.metadata.framework);
          if (pattern) {
            const archValidation = await architectureValidationService.validateArchitecturePattern(
              artifact.content,
              artifact.metadata.language || 'typescript',
              pattern
            );

            const archDebt = this.extractDebtFromArchitecture(
              projectId,
              artifact,
              archValidation
            );
            debtItems.push(...archDebt);
          }
        }
      }

      // Save debt items
      for (const debt of debtItems) {
        await TechnicalDebt.findOneAndUpdate(
          {
            projectId: debt.projectId,
            location: debt.location,
            description: debt.description,
            status: 'open'
          },
          debt,
          { upsert: true, new: true }
        );
      }

      logger.info(`Identified ${debtItems.length} technical debt items`);
      return debtItems;
    } catch (error: unknown) {
      logger.error('Failed to identify technical debt:', error);
      throw error;
    }
  }

  /**
   * Extract debt from quality review
   */
  private extractDebtFromQualityReview(
    projectId: string,
    artifact: IArtifact,
    review: any
  ): ITechnicalDebt[] {
    const debtItems: ITechnicalDebt[] = [];

    // Code quality issues
    for (const check of review.bestPractices || []) {
      if (check.status !== 'pass') {
        debtItems.push({
          projectId,
          category: 'code_quality',
          severity: check.status === 'fail' ? 'high' : 'medium',
          description: `${check.principle}: ${check.description}`,
          location: artifact.title,
          estimatedEffort: check.status === 'fail' ? 4 : 2,
          debtScore: this.calculateDebtScore(check.status === 'fail' ? 'high' : 'medium', check.status === 'fail' ? 4 : 2),
          status: 'open',
          identifiedAt: new Date(),
          relatedArtifacts: [artifact._id.toString()]
        } as ITechnicalDebt);
      }
    }

    // Security issues
    for (const issue of review.securityIssues || []) {
      debtItems.push({
        projectId,
        category: 'security',
        severity: issue.severity,
        description: `${issue.type}: ${issue.description}`,
        location: issue.location || artifact.title,
        estimatedEffort: this.estimateSecurityFixEffort(issue.severity),
        debtScore: this.calculateDebtScore(issue.severity, this.estimateSecurityFixEffort(issue.severity)),
        status: 'open',
        identifiedAt: new Date(),
        relatedArtifacts: [artifact._id.toString()]
      } as ITechnicalDebt);
    }

    // Performance issues
    if (review.performanceMetrics?.complexity === 'very-high' || 
        review.performanceMetrics?.complexity === 'high') {
      debtItems.push({
        projectId,
        category: 'performance',
        severity: review.performanceMetrics.complexity === 'very-high' ? 'high' : 'medium',
        description: `High complexity code: ${review.performanceMetrics.potentialBottlenecks.join(', ')}`,
        location: artifact.title,
        estimatedEffort: 6,
        debtScore: this.calculateDebtScore(
          review.performanceMetrics.complexity === 'very-high' ? 'high' : 'medium',
          6
        ),
        status: 'open',
        identifiedAt: new Date(),
        relatedArtifacts: [artifact._id.toString()]
      } as ITechnicalDebt);
    }

    // Missing tests (if quality score is low)
    if (review.overallScore < 70) {
      debtItems.push({
        projectId,
        category: 'missing_tests',
        severity: review.overallScore < 50 ? 'high' : 'medium',
        description: `Low code quality score (${review.overallScore}/100) suggests missing or inadequate tests`,
        location: artifact.title,
        estimatedEffort: 8,
        debtScore: this.calculateDebtScore(
          review.overallScore < 50 ? 'high' : 'medium',
          8
        ),
        status: 'open',
        identifiedAt: new Date(),
        relatedArtifacts: [artifact._id.toString()]
      } as ITechnicalDebt);
    }

    return debtItems;
  }

  /**
   * Extract debt from architecture validation
   */
  private extractDebtFromArchitecture(
    projectId: string,
    artifact: IArtifact,
    validation: any
  ): ITechnicalDebt[] {
    const debtItems: ITechnicalDebt[] = [];

    for (const violation of validation.violations || []) {
      debtItems.push({
        projectId,
        category: 'architecture',
        severity: violation.severity,
        description: `${violation.principle}: ${violation.description}`,
        location: violation.location || artifact.title,
        estimatedEffort: violation.severity === 'high' ? 6 : violation.severity === 'medium' ? 4 : 2,
        debtScore: this.calculateDebtScore(
          violation.severity,
          violation.severity === 'high' ? 6 : violation.severity === 'medium' ? 4 : 2
        ),
        status: 'open',
        identifiedAt: new Date(),
        relatedArtifacts: [artifact._id.toString()]
      } as ITechnicalDebt);
    }

    return debtItems;
  }

  /**
   * Calculate debt score
   */
  private calculateDebtScore(severity: string, effort: number): number {
    const severityWeight = {
      'critical': 40,
      'high': 30,
      'medium': 20,
      'low': 10
    };

    const effortWeight = Math.min(30, effort * 5); // Max 30 points for effort
    const baseScore = severityWeight[severity as keyof typeof severityWeight] || 20;

    return Math.min(100, baseScore + effortWeight);
  }

  /**
   * Estimate security fix effort
   */
  private estimateSecurityFixEffort(severity: string): number {
    switch (severity) {
      case 'critical': return 12;
      case 'high': return 8;
      case 'medium': return 4;
      case 'low': return 2;
      default: return 4;
    }
  }

  /**
   * Infer architecture pattern
   */
  private inferArchitecturePattern(framework: string): import('./architectureValidation.service.js').ArchitecturalPattern | null {
    const fw = framework.toLowerCase();
    if (fw.includes('express') || fw.includes('django') || fw.includes('rails')) return 'mvc';
    if (fw.includes('microservice') || fw.includes('service')) return 'microservices';
    if (fw.includes('clean') || fw.includes('hexagonal')) return 'clean-architecture';
    if (fw.includes('event') || fw.includes('kafka') || fw.includes('rabbitmq')) return 'event-driven';
    return null;
  }

  /**
   * Generate technical debt report
   */
  async generateReport(projectId: string): Promise<TechnicalDebtReport> {
    try {
      logger.info(`Generating technical debt report for project ${projectId}`);

      const allDebt = await TechnicalDebt.find({ projectId }).lean();

      if (allDebt.length === 0) {
        return {
          projectId,
          totalDebt: 0,
          debtScore: 100,
          byCategory: [],
          bySeverity: [],
          byStatus: [],
          trends: [],
          topDebtItems: [],
          remediationPriorities: [],
          generatedAt: new Date()
        };
      }

      // Calculate totals
      const totalDebt = allDebt.reduce((sum, d) => sum + d.debtScore, 0);
      const maxPossibleDebt = allDebt.length * 100;
      const debtScore = maxPossibleDebt > 0 
        ? Math.max(0, 100 - (totalDebt / maxPossibleDebt) * 100)
        : 100;

      // Group by category
      const byCategory = this.groupBy(allDebt, 'category').map(([category, items]) => ({
        category,
        count: items.length,
        totalScore: items.reduce((sum, d) => sum + d.debtScore, 0),
        averageScore: items.reduce((sum, d) => sum + d.debtScore, 0) / items.length
      }));

      // Group by severity
      const bySeverity = this.groupBy(allDebt, 'severity').map(([severity, items]) => ({
        severity,
        count: items.length,
        totalScore: items.reduce((sum, d) => sum + d.debtScore, 0)
      }));

      // Group by status
      const byStatus = this.groupBy(allDebt, 'status').map(([status, items]) => ({
        status,
        count: items.length,
        totalScore: items.reduce((sum, d) => sum + d.debtScore, 0)
      }));

      // Calculate trends (last 30 days)
      const trends = this.calculateTrends(allDebt);

      // Top debt items
      const topDebtItems = allDebt
        .filter(d => d.status === 'open')
        .sort((a, b) => b.debtScore - a.debtScore)
        .slice(0, 10)
        .map(d => ({
          id: d._id.toString(),
          category: d.category,
          severity: d.severity,
          description: d.description,
          debtScore: d.debtScore,
          estimatedEffort: d.estimatedEffort
        }));

      // Remediation priorities
      const remediationPriorities = this.calculateRemediationPriorities(byCategory, allDebt);

      return {
        projectId,
        totalDebt,
        debtScore: Math.round(debtScore * 100) / 100,
        byCategory,
        bySeverity,
        byStatus,
        trends,
        topDebtItems,
        remediationPriorities,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to generate technical debt report:', error);
      throw error;
    }
  }

  /**
   * Group array by key
   */
  private groupBy<T>(array: T[], key: keyof T): Array<[string, T[]]> {
    const map = new Map<string, T[]>();
    for (const item of array) {
      const value = String(item[key]);
      if (!map.has(value)) {
        map.set(value, []);
      }
      map.get(value)!.push(item);
    }
    return Array.from(map.entries());
  }

  /**
   * Calculate trends
   */
  private calculateTrends(allDebt: ITechnicalDebt[]): TechnicalDebtReport['trends'] {
    const trends: TechnicalDebtReport['trends'] = [];
    const now = new Date();
    const days = 30;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const dayDebt = allDebt.filter(d => {
        const debtDate = new Date(d.identifiedAt);
        return debtDate <= date;
      });

      const openDebt = dayDebt.filter(d => d.status === 'open');
      const resolvedDebt = dayDebt.filter(d => d.status === 'resolved');

      trends.push({
        date,
        totalDebt: dayDebt.reduce((sum, d) => sum + d.debtScore, 0),
        openDebt: openDebt.reduce((sum, d) => sum + d.debtScore, 0),
        resolvedDebt: resolvedDebt.reduce((sum, d) => sum + d.debtScore, 0)
      });
    }

    return trends;
  }

  /**
   * Calculate remediation priorities
   */
  private calculateRemediationPriorities(
    byCategory: TechnicalDebtReport['byCategory'],
    allDebt: ITechnicalDebt[]
  ): TechnicalDebtReport['remediationPriorities'] {
    const priorities: TechnicalDebtReport['remediationPriorities'] = [];

    for (const category of byCategory) {
      const categoryDebt = allDebt.filter(d => d.category === category.category && d.status === 'open');
      const criticalCount = categoryDebt.filter(d => d.severity === 'critical' || d.severity === 'high').length;
      const totalEffort = categoryDebt.reduce((sum, d) => sum + d.estimatedEffort, 0);

      // Priority calculation: severity (40%) + count (30%) + effort (30%)
      const priority = Math.min(10, Math.round(
        (criticalCount / categoryDebt.length) * 4 +
        (categoryDebt.length / allDebt.length) * 3 +
        (totalEffort / 100) * 3
      ));

      let reason = '';
      const suggestedActions: string[] = [];

      if (category.category === 'security') {
        reason = `${criticalCount} critical/high security issues found`;
        suggestedActions.push('Run security audit', 'Fix critical vulnerabilities first', 'Update dependencies');
      } else if (category.category === 'code_quality') {
        reason = `${category.count} code quality issues affecting maintainability`;
        suggestedActions.push('Refactor code', 'Apply best practices', 'Improve code structure');
      } else if (category.category === 'missing_tests') {
        reason = `Missing or inadequate test coverage`;
        suggestedActions.push('Add unit tests', 'Add integration tests', 'Increase coverage to 80%+');
      } else if (category.category === 'performance') {
        reason = `Performance bottlenecks identified`;
        suggestedActions.push('Profile code', 'Optimize bottlenecks', 'Add caching');
      } else if (category.category === 'architecture') {
        reason = `Architecture violations detected`;
        suggestedActions.push('Refactor architecture', 'Fix layer violations', 'Improve separation of concerns');
      }

      priorities.push({
        category: category.category,
        priority,
        reason,
        suggestedActions
      });
    }

    return priorities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Resolve technical debt
   */
  async resolveDebt(debtId: string, resolvedBy: string): Promise<void> {
    await TechnicalDebt.findByIdAndUpdate(debtId, {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy
    });
  }
}

export const technicalDebtService = new TechnicalDebtService();



