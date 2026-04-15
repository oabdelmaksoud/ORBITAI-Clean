/**
 * Requirements Compliance Service
 * Calculates compliance scores and generates compliance reports
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import {
  requirementsValidationService,
  ParsedRequirement,
  ValidationReport,
} from './requirementsValidation.service.js';
import { llmRouterAIService } from './llmRouterAI.service.js';

export interface ComplianceScore {
  projectId: string;
  overallScore: number; // 0-100
  coverageScore: number; // Percentage of requirements with implementations
  traceabilityScore: number; // Quality of traceRefs
  testCoverageScore: number; // Percentage of requirements with tests
  alignmentScore: number; // How well code matches requirements
  breakdown: {
    implemented: number;
    partial: number;
    missing: number;
    total: number;
  };
  generatedAt: Date;
}

export interface ComplianceReport {
  projectId: string;
  score: ComplianceScore;
  requirements: RequirementCompliance[];
  summary: {
    totalRequirements: number;
    fullyCompliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
    compliancePercentage: number;
  };
  recommendations: string[];
  generatedAt: Date;
}

export interface RequirementCompliance {
  requirementId: string;
  description: string;
  priority: string;
  complianceScore: number; // 0-100
  status: 'compliant' | 'partial' | 'non-compliant';
  hasCode: boolean;
  hasTests: boolean;
  hasDesign: boolean;
  traceRefsCount: number;
  alignmentScore: number;
  issues: string[];
}

export interface AlignmentScore {
  score: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  matches: string[];
  mismatches: string[];
  reasoning: string;
}

class RequirementsComplianceService {
  /**
   * Calculate overall compliance score for a project
   */
  async calculateComplianceScore(projectId: string): Promise<ComplianceScore> {
    try {
      // Get all artifacts
      const artifacts = await Artifact.find({ projectId }).lean() as any;
      const reqArtifacts = artifacts.filter((a: any) => a.type === 'requirement');

      if (reqArtifacts.length === 0) {
        return {
          projectId,
          overallScore: 0,
          coverageScore: 0,
          traceabilityScore: 0,
          testCoverageScore: 0,
          alignmentScore: 0,
          breakdown: {
            implemented: 0,
            partial: 0,
            missing: 0,
            total: 0,
          },
          generatedAt: new Date(),
        };
      }

      // Extract requirements
      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);

      // Get validation report
      const validationReport = await requirementsValidationService.validateRequirementsCoverage(
        projectId,
        requirements,
        artifacts
      );

      // Calculate coverage score
      const coverageScore = validationReport.coverage;

      // Calculate traceability score
      const traceabilityReport = requirementsValidationService.checkTraceability(
        requirements,
        artifacts
      );
      const traceabilityScore = traceabilityReport.traceabilityScore;

      // Calculate test coverage score
      const requirementsWithTests = requirements.filter(req => req.linkedTests.length > 0).length;
      const testCoverageScore =
        requirements.length > 0 ? (requirementsWithTests / requirements.length) * 100 : 0;

      // Calculate alignment score (sample a few requirements for detailed analysis)
      const alignmentScores = await Promise.all(
        requirements.slice(0, 5).map(req => this.compareRequirementsToCode(req, artifacts))
      );
      const alignmentScore =
        alignmentScores.length > 0
          ? alignmentScores.reduce((sum, s) => sum + s.score, 0) / alignmentScores.length
          : 50; // Default to 50 if no requirements to compare

      // Calculate overall score (weighted average)
      const overallScore =
        coverageScore * 0.4 +
        traceabilityScore * 0.2 +
        testCoverageScore * 0.2 +
        alignmentScore * 0.2;

      return {
        projectId,
        overallScore: Math.round(overallScore * 100) / 100,
        coverageScore: Math.round(coverageScore * 100) / 100,
        traceabilityScore: Math.round(traceabilityScore * 100) / 100,
        testCoverageScore: Math.round(testCoverageScore * 100) / 100,
        alignmentScore: Math.round(alignmentScore * 100) / 100,
        breakdown: {
          implemented: validationReport.implemented,
          partial: validationReport.partial,
          missing: validationReport.missing,
          total: validationReport.totalRequirements,
        },
        generatedAt: new Date(),
      };
    } catch (error: unknown) {
      logger.error('Failed to calculate compliance score:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(projectId: string): Promise<ComplianceReport> {
    try {
      // Get compliance score
      const score = await this.calculateComplianceScore(projectId);

      // Get all artifacts
      const artifacts = await Artifact.find({ projectId }).lean() as any;
      const reqArtifacts = artifacts.filter((a: any) => a.type === 'requirement');

      if (reqArtifacts.length === 0) {
        return {
          projectId,
          score,
          requirements: [],
          summary: {
            totalRequirements: 0,
            fullyCompliant: 0,
            partiallyCompliant: 0,
            nonCompliant: 0,
            compliancePercentage: 0,
          },
          recommendations: ['No requirements found in project'],
          generatedAt: new Date(),
        };
      }

      // Extract requirements
      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);

      // Get validation report
      const validationReport = await requirementsValidationService.validateRequirementsCoverage(
        projectId,
        requirements,
        artifacts
      );

      // Calculate compliance for each requirement
      const requirementCompliances: RequirementCompliance[] = await Promise.all(
        requirements.map(async req => {
          const hasCode = req.linkedCode.length > 0;
          const hasTests = req.linkedTests.length > 0;
          const hasDesign = req.linkedDesigns.length > 0;
          const traceRefsCount = req.traceRefs.length;

          // Calculate compliance score for this requirement
          let complianceScore = 0;
          if (hasCode) complianceScore += 40;
          if (hasTests) complianceScore += 30;
          if (hasDesign) complianceScore += 10;
          if (traceRefsCount > 0) complianceScore += 20;

          // Get alignment score if code exists
          let alignmentScore = 0;
          if (hasCode) {
            const alignment = await this.compareRequirementsToCode(req, artifacts);
            alignmentScore = alignment.score;
            complianceScore = complianceScore * 0.7 + alignmentScore * 0.3;
          }

          const status =
            complianceScore >= 80
              ? 'compliant'
              : complianceScore >= 50
                ? 'partial'
                : 'non-compliant';

          const issues: string[] = [];
          if (!hasCode) issues.push('No code implementation');
          if (!hasTests) issues.push('No test coverage');
          if (!hasDesign && req.type !== 'constraint') issues.push('No design artifact');
          if (traceRefsCount === 0) issues.push('No trace references');

          return {
            requirementId: req.id,
            description: req.description,
            priority: req.priority,
            complianceScore: Math.round(complianceScore * 100) / 100,
            status,
            hasCode,
            hasTests,
            hasDesign,
            traceRefsCount,
            alignmentScore: Math.round(alignmentScore * 100) / 100,
            issues,
          };
        })
      );

      // Calculate summary
      const fullyCompliant = requirementCompliances.filter(r => r.status === 'compliant').length;
      const partiallyCompliant = requirementCompliances.filter(r => r.status === 'partial').length;
      const nonCompliant = requirementCompliances.filter(r => r.status === 'non-compliant').length;
      const compliancePercentage =
        requirements.length > 0 ? (fullyCompliant / requirements.length) * 100 : 0;

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        score,
        requirementCompliances,
        validationReport
      );

      return {
        projectId,
        score,
        requirements: requirementCompliances,
        summary: {
          totalRequirements: requirements.length,
          fullyCompliant,
          partiallyCompliant,
          nonCompliant,
          compliancePercentage: Math.round(compliancePercentage * 100) / 100,
        },
        recommendations,
        generatedAt: new Date(),
      };
    } catch (error: unknown) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Compare requirement to code artifacts to check alignment
   */
  async compareRequirementsToCode(
    requirement: ParsedRequirement,
    artifacts: IArtifact[]
  ): Promise<AlignmentScore> {
    try {
      // Get code artifacts linked to this requirement
      const codeArtifacts = artifacts.filter(
        a => a.type === 'code' && requirement.linkedCode.includes(a._id.toString())
      );

      if (codeArtifacts.length === 0) {
        return {
          score: 0,
          confidence: 'low',
          matches: [],
          mismatches: ['No code artifacts found'],
          reasoning: 'No code implementation found for this requirement',
        };
      }

      // Use LLM to analyze alignment
      const codeContent = codeArtifacts
        .map(a => `${a.title}:\n${a.content.substring(0, 1000)}`)
        .join('\n\n');

      const prompt = `Analyze if the following code implementation aligns with the requirement.

REQUIREMENT:
ID: ${requirement.id}
Description: ${requirement.description}
Type: ${requirement.type}
Priority: ${requirement.priority}

CODE IMPLEMENTATION:
${codeContent}

Analyze and provide:
1. A score from 0-100 indicating how well the code implements the requirement
2. List of aspects that match the requirement
3. List of aspects that don't match or are missing
4. Your reasoning

Respond in JSON format:
{
  "score": number,
  "confidence": "high" | "medium" | "low",
  "matches": string[],
  "mismatches": string[],
  "reasoning": string
}`;

      const result = await (llmRouterAIService as any).executeWithFallback({
        prompt,
        context: {
          agentRole: 'QA/Audit Agent',
          taskType: 'analysis',
          systemInstruction: 'You are a quality assurance agent analyzing requirement compliance.',
        },
        routingContext: {},
        requestType: 'requirement-alignment-analysis',
        contextType: 'other',
      });

      // Parse JSON response
      let alignment: AlignmentScore;
      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          alignment = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: simple keyword matching
        const reqLower = requirement.description.toLowerCase();
        const codeLower = codeContent.toLowerCase();

        const reqKeywords = reqLower.split(/\s+/).filter(w => w.length > 3);
        const matchingKeywords = reqKeywords.filter(kw => codeLower.includes(kw));
        const matchRatio =
          reqKeywords.length > 0 ? matchingKeywords.length / reqKeywords.length : 0;

        alignment = {
          score: Math.round(matchRatio * 100),
          confidence: matchRatio > 0.7 ? 'high' : matchRatio > 0.4 ? 'medium' : 'low',
          matches: matchingKeywords.slice(0, 5),
          mismatches: reqKeywords.filter(kw => !codeLower.includes(kw)).slice(0, 5),
          reasoning: `Keyword matching analysis: ${matchingKeywords.length}/${reqKeywords.length} keywords found in code`,
        };
      }

      return alignment;
    } catch (error: unknown) {
      logger.error('Failed to compare requirement to code:', error);
      // Return default score
      return {
        score: 50,
        confidence: 'low',
        matches: [],
        mismatches: ['Analysis failed'],
        reasoning: `Error analyzing alignment: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Generate recommendations based on compliance report
   */
  private generateRecommendations(
    score: ComplianceScore,
    requirements: RequirementCompliance[],
    validationReport: ValidationReport
  ): string[] {
    const recommendations: string[] = [];

    if (score.overallScore < 80) {
      recommendations.push(
        `Overall compliance score is ${score.overallScore.toFixed(1)}%. Aim for at least 80% for production readiness.`
      );
    }

    if (score.coverageScore < 80) {
      recommendations.push(
        `Only ${score.coverageScore.toFixed(1)}% of requirements have implementations. Implement missing requirements: ${validationReport.missing} missing, ${validationReport.partial} partial.`
      );
    }

    if (score.testCoverageScore < 70) {
      recommendations.push(
        `Test coverage is ${score.testCoverageScore.toFixed(1)}%. Aim for at least 70% test coverage for all requirements.`
      );
    }

    if (score.traceabilityScore < 90) {
      recommendations.push(
        `Traceability score is ${score.traceabilityScore.toFixed(1)}%. Add traceRefs to link requirements to implementations.`
      );
    }

    if (score.alignmentScore < 75) {
      recommendations.push(
        `Code alignment with requirements is ${score.alignmentScore.toFixed(1)}%. Review implementations to ensure they match requirement specifications.`
      );
    }

    // Priority-based recommendations
    const criticalMissing = requirements.filter(
      r => r.priority === 'critical' && r.status === 'non-compliant'
    );
    if (criticalMissing.length > 0) {
      recommendations.push(
        `URGENT: ${criticalMissing.length} critical priority requirements are non-compliant. Address these immediately.`
      );
    }

    const highMissing = requirements.filter(
      r => r.priority === 'high' && r.status === 'non-compliant'
    );
    if (highMissing.length > 0) {
      recommendations.push(
        `${highMissing.length} high priority requirements are non-compliant. Address before project completion.`
      );
    }

    // Specific issue recommendations
    const noTests = requirements.filter(r => !r.hasTests && r.hasCode);
    if (noTests.length > 0) {
      recommendations.push(
        `${noTests.length} requirements have code but no tests. Add test coverage.`
      );
    }

    const noTraceRefs = requirements.filter(r => r.traceRefsCount === 0);
    if (noTraceRefs.length > 0) {
      recommendations.push(
        `${noTraceRefs.length} requirements have no trace references. Add traceRefs to maintain traceability.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All requirements are compliant. Great job!');
    }

    return recommendations;
  }
}

export const requirementsComplianceService = new RequirementsComplianceService();
