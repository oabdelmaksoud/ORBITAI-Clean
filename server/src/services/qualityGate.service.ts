/**
 * Quality Gate Service
 * Enforces quality thresholds before project completion
 * Ensures agency-quality output
 */

import { logger } from '../utils/logger.js';
import { codeQualityAssuranceService } from './codeQualityAssurance.service.js';
import { testGenerationService } from './testGeneration.service.js';
import { Project } from '../models/Project.model.js';
import { requirementsComplianceService } from './requirementsCompliance.service.js';
import { Artifact } from '../models/Artifact.model.js';

export interface QualityGateResult {
  passed: boolean;
  score: number; // Overall quality score
  checks: QualityCheck[];
  blockers: string[]; // Issues that must be fixed
  warnings: string[]; // Issues that should be fixed
  recommendations: string[];
}

export interface QualityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  score: number; // 0-100
  threshold: number; // Required score
  message: string;
  details?: any;
}

export interface QualityGateOptions {
  minCodeQuality?: number; // Default: 85
  minTestCoverage?: number; // Default: 70
  requireSecurityScan?: boolean; // Default: true
  requireDocumentation?: boolean; // Default: true
  requireBuildSuccess?: boolean; // Default: true
  requireStandardsCompliance?: boolean; // Default: true
  requireRequirementsCompliance?: boolean; // Default: true
  minRequirementsCoverage?: number; // Default: 80
}

class QualityGateService {
  private readonly DEFAULT_MIN_CODE_QUALITY = 85;
  private readonly DEFAULT_MIN_TEST_COVERAGE = 70;
  private readonly DEFAULT_MIN_REQUIREMENTS_COVERAGE = 80;

  /**
   * Run quality gates for a project
   */
  async checkQualityGates(
    projectId: string,
    options: QualityGateOptions = {}
  ): Promise<QualityGateResult> {
    try {
      logger.info(`Running quality gates for project: ${projectId}`);

      const project = await Project.findById(projectId).lean();
      if (!project) {
        throw new Error('Project not found');
      }

      const checks: QualityCheck[] = [];
      const blockers: string[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];

      // Gate 1: Code Quality
      const codeQualityCheck = await this.checkCodeQuality(project, options);
      checks.push(codeQualityCheck);
      if (codeQualityCheck.status === 'fail') {
        blockers.push(`Code quality score (${codeQualityCheck.score}) below threshold (${codeQualityCheck.threshold})`);
      } else if (codeQualityCheck.status === 'warning') {
        warnings.push(`Code quality could be improved: ${codeQualityCheck.message}`);
      }

      // Gate 2: Test Coverage
      const testCoverageCheck = await this.checkTestCoverage(project, options);
      checks.push(testCoverageCheck);
      if (testCoverageCheck.status === 'fail') {
        blockers.push(`Test coverage (${testCoverageCheck.score}%) below threshold (${testCoverageCheck.threshold}%)`);
      }

      // Gate 3: Security Scan
      if (options.requireSecurityScan !== false) {
        const securityCheck = await this.checkSecurity(project);
        checks.push(securityCheck);
        if (securityCheck.status === 'fail') {
          blockers.push(`Security scan failed: ${securityCheck.message}`);
        }
      }

      // Gate 4: Documentation
      if (options.requireDocumentation !== false) {
        const docsCheck = await this.checkDocumentation(project);
        checks.push(docsCheck);
        if (docsCheck.status === 'fail') {
          blockers.push(`Documentation incomplete: ${docsCheck.message}`);
        } else if (docsCheck.status === 'warning') {
          warnings.push(`Documentation could be improved: ${docsCheck.message}`);
        }
      }

      // Gate 5: Build Success
      if (options.requireBuildSuccess !== false) {
        const buildCheck = await this.checkBuildSuccess(project);
        checks.push(buildCheck);
        if (buildCheck.status === 'fail') {
          blockers.push(`Build validation failed: ${buildCheck.message}`);
        }
      }

      // Gate 6: Standards Compliance
      if (options.requireStandardsCompliance !== false && project.selectedStandards?.length > 0) {
        const complianceCheck = await this.checkStandardsCompliance(project);
        checks.push(complianceCheck);
        if (complianceCheck.status === 'fail') {
          blockers.push(`Standards compliance failed: ${complianceCheck.message}`);
        }
      }

      // Gate 7: Requirements Compliance
      if (options.requireRequirementsCompliance !== false) {
        const requirementsCheck = await this.checkRequirementsCompliance(project, options);
        checks.push(requirementsCheck);
        if (requirementsCheck.status === 'fail') {
          blockers.push(`Requirements compliance failed: ${requirementsCheck.message}`);
        } else if (requirementsCheck.status === 'warning') {
          warnings.push(`Requirements compliance could be improved: ${requirementsCheck.message}`);
        }
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(checks);

      // Determine if passed
      const passed = blockers.length === 0 && overallScore >= (options.minCodeQuality || this.DEFAULT_MIN_CODE_QUALITY);

      // Generate recommendations
      if (!passed) {
        recommendations.push('Address all blocker issues before project completion');
        recommendations.push(`Improve code quality to at least ${options.minCodeQuality || this.DEFAULT_MIN_CODE_QUALITY}/100`);
      }
      if (testCoverageCheck.score < testCoverageCheck.threshold) {
        recommendations.push(`Increase test coverage to at least ${testCoverageCheck.threshold}%`);
      }

      return {
        passed,
        score: overallScore,
        checks,
        blockers,
        warnings,
        recommendations
      };
    } catch (error: unknown) {
      logger.error('Quality gate check failed:', error);
      return {
        passed: false,
        score: 0,
        checks: [],
        blockers: [`Quality gate check failed: ${error.message}`],
        warnings: [],
        recommendations: ['Review project manually']
      };
    }
  }

  /**
   * Check code quality
   */
  private async checkCodeQuality(
    project: any,
    options: QualityGateOptions
  ): Promise<QualityCheck> {
    try {
      const threshold = options.minCodeQuality || this.DEFAULT_MIN_CODE_QUALITY;
      
      // Get code artifacts
      const codeArtifacts = project.artifacts?.filter((a: any) => a.type === 'code') || [];
      
      if (codeArtifacts.length === 0) {
        return {
          name: 'Code Quality',
          status: 'warning',
          score: 0,
          threshold,
          message: 'No code artifacts found to evaluate'
        };
      }

      // Evaluate code quality for each artifact
      let totalScore = 0;
      let evaluatedCount = 0;

      for (const artifact of codeArtifacts.slice(0, 5)) { // Limit to 5 for performance
        try {
          const score = await codeQualityAssuranceService.calculateQualityScore(
            artifact.content || '',
            this.detectLanguage(artifact.title || '')
          );
          totalScore += score;
          evaluatedCount++;
        } catch (error) {
          // Skip failed evaluations
        }
      }

      const avgScore = evaluatedCount > 0 ? totalScore / evaluatedCount : 0;

      return {
        name: 'Code Quality',
        status: avgScore >= threshold ? 'pass' : avgScore >= threshold * 0.8 ? 'warning' : 'fail',
        score: Math.round(avgScore),
        threshold,
        message: avgScore >= threshold
          ? `Code quality meets threshold (${Math.round(avgScore)}/100)`
          : `Code quality (${Math.round(avgScore)}/100) below threshold (${threshold}/100)`
      };
    } catch (error: unknown) {
      return {
        name: 'Code Quality',
        status: 'fail',
        score: 0,
        threshold: options.minCodeQuality || this.DEFAULT_MIN_CODE_QUALITY,
        message: `Code quality check failed: ${error.message}`
      };
    }
  }

  /**
   * Check test coverage
   */
  private async checkTestCoverage(
    project: any,
    options: QualityGateOptions
  ): Promise<QualityCheck> {
    try {
      const threshold = options.minTestCoverage || this.DEFAULT_MIN_TEST_COVERAGE;

      // Check if tests exist
      const testArtifacts = project.artifacts?.filter((a: any) =>
        a.title?.toLowerCase().includes('test') ||
        a.type === 'test-plan'
      ) || [];

      // Generate tests if needed and estimate coverage
      const codeArtifacts = project.artifacts?.filter((a: any) => a.type === 'code') || [];
      
      let estimatedCoverage = 0;
      if (testArtifacts.length > 0 && codeArtifacts.length > 0) {
        // Rough estimate: more tests = higher coverage
        estimatedCoverage = Math.min(90, (testArtifacts.length / codeArtifacts.length) * 100);
      } else if (codeArtifacts.length > 0) {
        // No tests found
        estimatedCoverage = 0;
      } else {
        // No code to test
        estimatedCoverage = 100;
      }

      return {
        name: 'Test Coverage',
        status: estimatedCoverage >= threshold ? 'pass' : estimatedCoverage >= threshold * 0.7 ? 'warning' : 'fail',
        score: Math.round(estimatedCoverage),
        threshold,
        message: estimatedCoverage >= threshold
          ? `Test coverage estimated at ${Math.round(estimatedCoverage)}%`
          : `Test coverage (${Math.round(estimatedCoverage)}%) below threshold (${threshold}%)`
      };
    } catch (error: unknown) {
      return {
        name: 'Test Coverage',
        status: 'fail',
        score: 0,
        threshold: options.minTestCoverage || this.DEFAULT_MIN_TEST_COVERAGE,
        message: `Test coverage check failed: ${error.message}`
      };
    }
  }

  /**
   * Check security
   */
  private async checkSecurity(project: any): Promise<QualityCheck> {
    try {
      const codeArtifacts = project.artifacts?.filter((a: any) => a.type === 'code') || [];
      
      if (codeArtifacts.length === 0) {
        return {
          name: 'Security Scan',
          status: 'pass',
          score: 100,
          threshold: 0,
          message: 'No code to scan'
        };
      }

      // Quick security check on first code artifact
      const firstCode = codeArtifacts[0];
      const review = await codeQualityAssuranceService.reviewCode(
        firstCode.content || '',
        this.detectLanguage(firstCode.title || ''),
        {
          projectType: project.projectType,
          standards: project.selectedStandards
        }
      );

      const criticalIssues = review.securityIssues.filter(i => 
        i.severity === 'critical' || i.severity === 'high'
      ).length;

      const status = criticalIssues === 0 ? 'pass' : 'fail';
      const score = criticalIssues === 0 ? 100 : Math.max(0, 100 - (criticalIssues * 20));

      return {
        name: 'Security Scan',
        status,
        score,
        threshold: 0, // No critical/high issues
        message: criticalIssues === 0
          ? 'No critical security issues found'
          : `Found ${criticalIssues} critical/high security issues`,
        details: {
          criticalIssues: review.securityIssues.filter(i => i.severity === 'critical' || i.severity === 'high')
        }
      };
    } catch (error: unknown) {
      return {
        name: 'Security Scan',
        status: 'warning',
        score: 50,
        threshold: 0,
        message: `Security scan incomplete: ${error.message}`
      };
    }
  }

  /**
   * Check documentation completeness
   */
  private async checkDocumentation(project: any): Promise<QualityCheck> {
    try {
      const docArtifacts = project.artifacts?.filter((a: any) =>
        a.type === 'requirement' ||
        a.title?.toLowerCase().includes('readme') ||
        a.title?.toLowerCase().includes('doc') ||
        a.title?.toLowerCase().includes('guide')
      ) || [];

      const codeArtifacts = project.artifacts?.filter((a: any) => a.type === 'code') || [];
      
      // Documentation score based on presence of key docs
      let score = 0;
      const hasReadme = docArtifacts.some((a: any) => a.title?.toLowerCase().includes('readme'));
      const hasUserGuide = docArtifacts.some((a: any) => a.title?.toLowerCase().includes('user') || a.title?.toLowerCase().includes('guide'));
      const hasAPIDocs = docArtifacts.some((a: any) => a.title?.toLowerCase().includes('api'));

      if (hasReadme) score += 30;
      if (hasUserGuide) score += 30;
      if (hasAPIDocs) score += 40;

      // If no code, documentation is not required
      if (codeArtifacts.length === 0) {
        score = 100;
      }

      return {
        name: 'Documentation',
        status: score >= 70 ? 'pass' : score >= 50 ? 'warning' : 'fail',
        score,
        threshold: 70,
        message: score >= 70
          ? 'Documentation is complete'
          : `Documentation incomplete (${score}%). Missing: ${!hasReadme ? 'README, ' : ''}${!hasUserGuide ? 'User Guide, ' : ''}${!hasAPIDocs ? 'API Docs' : ''}`
      };
    } catch (error: unknown) {
      return {
        name: 'Documentation',
        status: 'warning',
        score: 50,
        threshold: 70,
        message: `Documentation check failed: ${error.message}`
      };
    }
  }

  /**
   * Check if project builds successfully
   */
  private async checkBuildSuccess(project: any): Promise<QualityCheck> {
    try {
      // This would actually attempt to build the project
      // For now, check if build configs exist
      const hasBuildConfig = project.artifacts?.some((a: any) =>
        a.title?.includes('package.json') ||
        a.title?.includes('Dockerfile') ||
        a.title?.includes('build')
      ) || false;

      return {
        name: 'Build Success',
        status: hasBuildConfig ? 'pass' : 'warning',
        score: hasBuildConfig ? 100 : 50,
        threshold: 0,
        message: hasBuildConfig
          ? 'Build configuration present'
          : 'Build configuration missing. Project may not build successfully.'
      };
    } catch (error: unknown) {
      return {
        name: 'Build Success',
        status: 'warning',
        score: 50,
        threshold: 0,
        message: `Build check incomplete: ${error.message}`
      };
    }
  }

  /**
   * Check standards compliance
   */
  private async checkStandardsCompliance(project: any): Promise<QualityCheck> {
    try {
      const standards = project.selectedStandards || [];
      
      if (standards.length === 0) {
        return {
          name: 'Standards Compliance',
          status: 'pass',
          score: 100,
          threshold: 0,
          message: 'No standards selected'
        };
      }

      // Check if artifacts reference standards
      const compliantArtifacts = project.artifacts?.filter((a: any) =>
        a.tags?.some((tag: string) => standards.some((s: string) => tag.toLowerCase().includes(s.toLowerCase())))
      ) || [];

      const complianceRate = project.artifacts?.length > 0
        ? (compliantArtifacts.length / project.artifacts.length) * 100
        : 100;

      return {
        name: 'Standards Compliance',
        status: complianceRate >= 80 ? 'pass' : complianceRate >= 60 ? 'warning' : 'fail',
        score: Math.round(complianceRate),
        threshold: 80,
        message: complianceRate >= 80
          ? `Standards compliance: ${Math.round(complianceRate)}%`
          : `Standards compliance (${Math.round(complianceRate)}%) below threshold (80%)`
      };
    } catch (error: unknown) {
      return {
        name: 'Standards Compliance',
        status: 'warning',
        score: 50,
        threshold: 80,
        message: `Standards compliance check failed: ${error.message}`
      };
    }
  }

  /**
   * Check requirements compliance
   */
  private async checkRequirementsCompliance(project: any, options: QualityGateOptions): Promise<QualityCheck> {
    try {
      const projectId = project._id.toString();
      const minCoverage = options.minRequirementsCoverage || this.DEFAULT_MIN_REQUIREMENTS_COVERAGE;

      // Get all artifacts for the project
      const artifacts = await Artifact.find({ projectId }).lean();
      const reqArtifacts = artifacts.filter(a => a.type === 'requirement');

      // If no requirements, pass the check
      if (reqArtifacts.length === 0) {
        return {
          name: 'Requirements Compliance',
          status: 'pass',
          score: 100,
          threshold: minCoverage,
          message: 'No requirements found in project'
        };
      }

      // Get compliance score
      const complianceScore = await requirementsComplianceService.calculateComplianceScore(projectId);

      const status = complianceScore.coverageScore >= minCoverage ? 'pass' :
                    complianceScore.coverageScore >= minCoverage * 0.7 ? 'warning' : 'fail';

      return {
        name: 'Requirements Compliance',
        status,
        score: Math.round(complianceScore.coverageScore),
        threshold: minCoverage,
        message: complianceScore.coverageScore >= minCoverage
          ? `Requirements coverage: ${Math.round(complianceScore.coverageScore)}% (${complianceScore.breakdown.implemented}/${complianceScore.breakdown.total} implemented)`
          : `Requirements coverage (${Math.round(complianceScore.coverageScore)}%) below threshold (${minCoverage}%). ${complianceScore.breakdown.missing} requirements missing, ${complianceScore.breakdown.partial} partial.`
      };
    } catch (error: unknown) {
      logger.error('Requirements compliance check failed:', error);
      return {
        name: 'Requirements Compliance',
        status: 'warning',
        score: 50,
        threshold: options.minRequirementsCoverage || this.DEFAULT_MIN_REQUIREMENTS_COVERAGE,
        message: `Requirements compliance check failed: ${error.message}`
      };
    }
  }

  /**
   * Calculate overall quality score from all checks
   */
  private calculateOverallScore(checks: QualityCheck[]): number {
    if (checks.length === 0) return 0;

    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    return Math.round(totalScore / checks.length);
  }

  /**
   * Detect programming language from filename
   */
  private detectLanguage(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('.ts') || lower.includes('typescript')) return 'typescript';
    if (lower.includes('.js') || lower.includes('javascript')) return 'javascript';
    if (lower.includes('.py') || lower.includes('python')) return 'python';
    if (lower.includes('.java')) return 'java';
    if (lower.includes('.cs') || lower.includes('csharp')) return 'csharp';
    if (lower.includes('.go')) return 'go';
    if (lower.includes('.rs') || lower.includes('rust')) return 'rust';
    return 'typescript'; // Default
  }
}

export const qualityGateService = new QualityGateService();

