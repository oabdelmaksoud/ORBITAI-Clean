/**
 * Compliance & Audit Service
 * Enhanced compliance tracking and automated audits
 */

import { ProcessImprovement } from '../models/ProcessImprovement.model.js';
import { QualityStandard } from '../models/QualityStandard.model.js';
import { logger } from '../utils/logger.js';

export interface ComplianceCheck {
  improvementId: string;
  standardId: string;
  standardName: string;
  compliant: boolean;
  score: number; // 0-100
  findings: ComplianceFinding[];
  recommendations: string[];
  lastChecked: Date;
}

export interface ComplianceFinding {
  type: 'requirement' | 'recommendation' | 'best-practice';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: string;
  status: 'pass' | 'fail' | 'partial' | 'not-applicable';
}

export interface ComplianceReport {
  improvementId: string;
  overallCompliance: number; // 0-100
  standards: ComplianceCheck[];
  summary: {
    totalStandards: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
  };
  risks: ComplianceRisk[];
  recommendations: string[];
  generatedAt: Date;
}

export interface ComplianceRisk {
  type: 'regulatory' | 'quality' | 'security' | 'operational';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  mitigation: string;
}

export interface AuditSchedule {
  improvementId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextAudit: Date;
  lastAudit?: Date;
  enabled: boolean;
}

class ComplianceAuditService {
  /**
   * Check compliance against standards
   */
  async checkCompliance(
    improvementId: string,
    standardIds?: string[]
  ): Promise<ComplianceReport> {
    try {
      const improvement = await ProcessImprovement.findOne({ id: improvementId });
      if (!improvement) {
        throw new Error(`Process improvement not found: ${improvementId}`);
      }

      // Get applicable standards
      let standards;
      if (standardIds && standardIds.length > 0) {
        standards = await QualityStandard.find({ id: { $in: standardIds } });
      } else {
        // Get standards from improvement's applicableTo
        const applicableStandards = improvement.applicableTo?.standards || [];
        if (applicableStandards.length > 0) {
          standards = await QualityStandard.find({ id: { $in: applicableStandards } });
        } else {
          // Get all active standards
          standards = await QualityStandard.find({ isActive: true }).limit(10);
        }
      }

      const complianceChecks: ComplianceCheck[] = [];

      for (const standard of standards) {
        const check = await this.checkAgainstStandard(improvement, standard);
        complianceChecks.push(check);
      }

      // Calculate overall compliance
      const overallCompliance = complianceChecks.length > 0
        ? complianceChecks.reduce((sum, c) => sum + c.score, 0) / complianceChecks.length
        : 0;

      // Generate summary
      const summary = {
        totalStandards: complianceChecks.length,
        compliant: complianceChecks.filter(c => c.compliant).length,
        nonCompliant: complianceChecks.filter(c => !c.compliant).length,
        partial: complianceChecks.filter(c => c.score >= 50 && c.score < 80).length
      };

      // Identify risks
      const risks = this.identifyComplianceRisks(complianceChecks, improvement);

      // Generate recommendations
      const recommendations = this.generateComplianceRecommendations(complianceChecks, risks);

      return {
        improvementId,
        overallCompliance,
        standards: complianceChecks,
        summary,
        risks,
        recommendations,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to check compliance:', error);
      throw error;
    }
  }

  /**
   * Check improvement against a standard
   */
  private async checkAgainstStandard(
    improvement: any,
    standard: any
  ): Promise<ComplianceCheck> {
    const findings: ComplianceFinding[] = [];
    let score = 100;

    // Check content requirements
    if (improvement.content.length < 200) {
      findings.push({
        type: 'requirement',
        severity: 'medium',
        description: 'Content is too brief',
        evidence: `Content length: ${improvement.content.length} characters`,
        status: 'partial'
      });
      score -= 10;
    }

    // Check structured content
    if (!improvement.structuredContent?.steps || improvement.structuredContent.steps.length === 0) {
      findings.push({
        type: 'recommendation',
        severity: 'low',
        description: 'No structured steps provided',
        evidence: 'Missing structuredContent.steps',
        status: 'partial'
      });
      score -= 5;
    }

    // Check quality metrics
    const avgQuality = (
      (improvement.quality.completeness || 0) +
      (improvement.quality.clarity || 0) +
      (improvement.quality.usefulness || 0)
    ) / 3;

    if (avgQuality < 60) {
      findings.push({
        type: 'requirement',
        severity: 'high',
        description: 'Quality scores below acceptable threshold',
        evidence: `Average quality: ${avgQuality.toFixed(1)}%`,
        status: 'fail'
      });
      score -= 20;
    }

    // Check approval status
    if (improvement.approval?.status === 'pending') {
      findings.push({
        type: 'requirement',
        severity: 'medium',
        description: 'Improvement pending approval',
        evidence: 'Approval status: pending',
        status: 'partial'
      });
      score -= 15;
    }

    // Check version control
    if (improvement.version < 2) {
      findings.push({
        type: 'best-practice',
        severity: 'low',
        description: 'No version history',
        evidence: `Version: ${improvement.version}`,
        status: 'partial'
      });
      score -= 5;
    }

    // Check tags and keywords
    if ((improvement.tags?.length || 0) < 3) {
      findings.push({
        type: 'recommendation',
        severity: 'low',
        description: 'Insufficient tagging',
        evidence: `Tags: ${improvement.tags?.length || 0}`,
        status: 'partial'
      });
      score -= 5;
    }

    const compliant = score >= 80;
    const recommendations = findings
      .filter(f => f.status === 'fail' || f.status === 'partial')
      .map(f => `Address ${f.description.toLowerCase()}`);

    return {
      improvementId: improvement.id,
      standardId: standard.id,
      standardName: standard.name,
      compliant,
      score: Math.max(0, Math.min(100, score)),
      findings,
      recommendations,
      lastChecked: new Date()
    };
  }

  /**
   * Identify compliance risks
   */
  private identifyComplianceRisks(
    checks: ComplianceCheck[],
    improvement: any
  ): ComplianceRisk[] {
    const risks: ComplianceRisk[] = [];

    // Regulatory risks
    const nonCompliantStandards = checks.filter(c => !c.compliant);
    if (nonCompliantStandards.length > 0) {
      risks.push({
        type: 'regulatory',
        severity: 'high',
        description: `${nonCompliantStandards.length} standards not compliant`,
        impact: 'May violate regulatory requirements',
        mitigation: 'Address non-compliance findings immediately'
      });
    }

    // Quality risks
    const lowScores = checks.filter(c => c.score < 50);
    if (lowScores.length > 0) {
      risks.push({
        type: 'quality',
        severity: 'medium',
        description: `${lowScores.length} standards have low compliance scores`,
        impact: 'May result in poor quality outcomes',
        mitigation: 'Improve process quality and documentation'
      });
    }

    // Security risks
    if (improvement.type === 'security' && improvement.status !== 'active') {
      risks.push({
        type: 'security',
        severity: 'critical',
        description: 'Security-related improvement is not active',
        impact: 'Security vulnerabilities may not be addressed',
        mitigation: 'Activate security improvement immediately'
      });
    }

    // Operational risks
    if (improvement.usage.timesUsed === 0 && improvement.status === 'active') {
      risks.push({
        type: 'operational',
        severity: 'low',
        description: 'Active improvement has no usage',
        impact: 'May indicate process is not being followed',
        mitigation: 'Promote improvement or review relevance'
      });
    }

    return risks;
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(
    checks: ComplianceCheck[],
    risks: ComplianceRisk[]
  ): string[] {
    const recommendations: string[] = [];

    // High priority recommendations
    const criticalRisks = risks.filter(r => r.severity === 'critical');
    criticalRisks.forEach(risk => {
      recommendations.push(`CRITICAL: ${risk.mitigation}`);
    });

    // Standard-specific recommendations
    checks.forEach(check => {
      if (!check.compliant) {
        recommendations.push(`Address compliance issues for ${check.standardName}`);
      }
      check.recommendations.forEach(rec => {
        if (!recommendations.includes(rec)) {
          recommendations.push(rec);
        }
      });
    });

    return recommendations;
  }

  /**
   * Schedule automated audit
   */
  async scheduleAudit(
    improvementId: string,
    frequency: AuditSchedule['frequency']
  ): Promise<AuditSchedule> {
    const nextAudit = this.calculateNextAuditDate(frequency);

    return {
      improvementId,
      frequency,
      nextAudit,
      enabled: true
    };
  }

  /**
   * Calculate next audit date
   */
  private calculateNextAuditDate(frequency: AuditSchedule['frequency']): Date {
    const now = new Date();
    const next = new Date(now);

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
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }

  /**
   * Map process to regulations
   */
  async mapToRegulations(improvementId: string): Promise<Array<{
    regulation: string;
    relevance: number; // 0-100
    requirements: string[];
    compliance: 'compliant' | 'partial' | 'non-compliant';
  }>> {
    try {
      const improvement = await ProcessImprovement.findOne({ id: improvementId });
      if (!improvement) {
        throw new Error(`Process improvement not found: ${improvementId}`);
      }

      // Map to common regulations based on type and category
      const mappings: Array<{
        regulation: string;
        relevance: number;
        requirements: string[];
        compliance: 'compliant' | 'partial' | 'non-compliant';
      }> = [];

      // GDPR mapping
      if (improvement.type === 'compliance' || improvement.category === 'standard') {
        mappings.push({
          regulation: 'GDPR',
          relevance: 70,
          requirements: [
            'Data protection documentation',
            'Privacy by design',
            'User consent management'
          ],
          compliance: improvement.content.includes('privacy') || improvement.content.includes('data protection')
            ? 'compliant'
            : 'partial'
        });
      }

      // HIPAA mapping
      if (improvement.type === 'compliance' && improvement.applicableTo?.industries?.includes('healthcare')) {
        mappings.push({
          regulation: 'HIPAA',
          relevance: 90,
          requirements: [
            'Protected health information (PHI) handling',
            'Access controls',
            'Audit trails'
          ],
          compliance: improvement.content.includes('PHI') || improvement.content.includes('health information')
            ? 'compliant'
            : 'partial'
        });
      }

      // ISO 27001 mapping
      if (improvement.type === 'security') {
        mappings.push({
          regulation: 'ISO 27001',
          relevance: 85,
          requirements: [
            'Information security management',
            'Risk assessment',
            'Security controls'
          ],
          compliance: improvement.content.includes('security') && improvement.content.includes('risk')
            ? 'compliant'
            : 'partial'
        });
      }

      return mappings;
    } catch (error: unknown) {
      logger.error('Failed to map to regulations:', error);
      throw error;
    }
  }
}

export const complianceAuditService = new ComplianceAuditService();
















