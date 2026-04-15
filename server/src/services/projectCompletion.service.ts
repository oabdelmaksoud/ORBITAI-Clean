/**
 * Project Completion Service
 * Finalizes projects with documentation, packaging, and quality checks
 * Prepares projects for deployment
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import { documentationGeneratorService } from './documentationGenerator.service.js';
import { projectPackagerService } from './projectPackager.service.js';
import { qualityGateService } from './qualityGate.service.js';
import { codeRefinementService } from './codeRefinement.service.js';
import { testGenerationService } from './testGeneration.service.js';

export interface ProjectCompletionResult {
  success: boolean;
  projectId: string;
  qualityGate: {
    passed: boolean;
    score: number;
  };
  documentation: {
    generated: boolean;
    files: string[];
  };
  packaging: {
    generated: boolean;
    packageSize: number; // bytes
  };
  summary: {
    totalArtifacts: number;
    codeArtifacts: number;
    documentationArtifacts: number;
    testArtifacts: number;
  };
  deploymentReady: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompletionOptions {
  runQualityGates?: boolean; // Default: true
  generateDocumentation?: boolean; // Default: true
  generatePackage?: boolean; // Default: true
  refineCode?: boolean; // Default: true
  generateTests?: boolean; // Default: true
  qualityThreshold?: number; // Default: 85
}

class ProjectCompletionService {
  /**
   * Complete a project - finalize with all necessary components
   */
  async completeProject(
    projectId: string,
    options: CompletionOptions = {}
  ): Promise<ProjectCompletionResult> {
    try {
      logger.info(`Completing project: ${projectId}`);

      const project = await Project.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result: ProjectCompletionResult = {
        success: false,
        projectId,
        qualityGate: {
          passed: false,
          score: 0
        },
        documentation: {
          generated: false,
          files: []
        },
        packaging: {
          generated: false,
          packageSize: 0
        },
        summary: {
          totalArtifacts: project.artifacts?.length || 0,
          codeArtifacts: 0,
          documentationArtifacts: 0,
          testArtifacts: 0
        },
        deploymentReady: false,
        errors: [],
        warnings: []
      };

      // Step 1: Code Refinement (if enabled)
      if (options.refineCode !== false) {
        try {
          await this.refineProjectCode(project);
          logger.info('Code refinement completed');
        } catch (error: unknown) {
          result.warnings.push(`Code refinement failed: ${error.message}`);
        }
      }

      // Step 2: Test Generation (if enabled)
      if (options.generateTests !== false) {
        try {
          await this.generateProjectTests(project);
          logger.info('Test generation completed');
        } catch (error: unknown) {
          result.warnings.push(`Test generation failed: ${error.message}`);
        }
      }

      // Step 3: Quality Gates (if enabled)
      if (options.runQualityGates !== false) {
        try {
          const qualityResult = await qualityGateService.checkQualityGates(projectId, {
            minCodeQuality: options.qualityThreshold || 85,
            minTestCoverage: 70
          });

          result.qualityGate = {
            passed: qualityResult.passed,
            score: qualityResult.score
          };

          if (!qualityResult.passed) {
            result.errors.push(...qualityResult.blockers);
            result.warnings.push(...qualityResult.warnings);
          }

          logger.info(`Quality gates: ${qualityResult.passed ? 'PASSED' : 'FAILED'} (${qualityResult.score}/100)`);
        } catch (error: unknown) {
          result.errors.push(`Quality gate check failed: ${error.message}`);
        }
      }

      // Step 4: Documentation Generation (if enabled)
      if (options.generateDocumentation !== false) {
        try {
          const docs = await documentationGeneratorService.generateDocumentation(project, {
            format: 'markdown',
            includeCodeExamples: true
          });

          // Add documentation as artifacts
          const docArtifacts = [
            { title: 'README.md', content: docs.readme, type: 'requirement' },
            { title: 'API.md', content: docs.apiDocs, type: 'requirement' },
            { title: 'USER_GUIDE.md', content: docs.userGuide, type: 'requirement' },
            { title: 'ARCHITECTURE.md', content: docs.architectureDoc, type: 'design' }
          ];

          for (const doc of docArtifacts) {
            if (!project.artifacts) project.artifacts = [];
            project.artifacts.push({
              id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              ...doc,
              phase: project.currentPhase,
              createdBy: 'Requirements Agent',
              timestamp: Date.now(),
              tags: ['documentation', 'generated']
            });
          }

          result.documentation = {
            generated: true,
            files: docArtifacts.map(d => d.title)
          };

          logger.info('Documentation generated');
        } catch (error: unknown) {
          result.errors.push(`Documentation generation failed: ${error.message}`);
        }
      }

      // Step 5: Project Packaging (if enabled)
      if (options.generatePackage !== false) {
        try {
          const packageResult = await projectPackagerService.packageProject(projectId);
          result.packaging = {
            generated: true,
            packageSize: packageResult.zipBuffer.length
          };
          logger.info(`Project packaged: ${(packageResult.zipBuffer.length / 1024).toFixed(2)} KB`);
        } catch (error: unknown) {
          result.errors.push(`Packaging failed: ${error.message}`);
        }
      }

      // Calculate summary
      result.summary = {
        totalArtifacts: project.artifacts?.length || 0,
        codeArtifacts: project.artifacts?.filter((a: any) => a.type === 'code').length || 0,
        documentationArtifacts: project.artifacts?.filter((a: any) => 
          a.type === 'requirement' || a.title?.toLowerCase().includes('doc')
        ).length || 0,
        testArtifacts: project.artifacts?.filter((a: any) => 
          a.title?.toLowerCase().includes('test')
        ).length || 0
      };

      // Determine if deployment ready
      result.deploymentReady = result.qualityGate.passed && 
                               result.documentation.generated && 
                               result.packaging.generated &&
                               result.errors.length === 0;

      // Save updated project
      await project.save();

      result.success = true;
      logger.info(`Project completion finished. Deployment ready: ${result.deploymentReady}`);

      return result;
    } catch (error: unknown) {
      logger.error('Project completion failed:', error);
      return {
        success: false,
        projectId,
        qualityGate: { passed: false, score: 0 },
        documentation: { generated: false, files: [] },
        packaging: { generated: false, packageSize: 0 },
        summary: { totalArtifacts: 0, codeArtifacts: 0, documentationArtifacts: 0, testArtifacts: 0 },
        deploymentReady: false,
        errors: [`Project completion failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Refine all code artifacts in project
   */
  private async refineProjectCode(project: any): Promise<void> {
    const codeArtifacts = project.artifacts?.filter((a: any) => a.type === 'code') || [];
    
    for (const artifact of codeArtifacts.slice(0, 10)) { // Limit to 10 for performance
      try {
        const language = this.detectLanguage(artifact.title || '');
        const refinement = await codeRefinementService.refineCode(
          artifact.content || '',
          {
            targetScore: 85,
            maxIterations: 2,
            language,
            context: {
              projectType: project.projectType,
              standards: project.selectedStandards
            }
          }
        );

        if (refinement.success && refinement.qualityScoreAfter > refinement.qualityScoreBefore) {
          artifact.content = refinement.refinedCode;
          logger.info(`Refined artifact: ${artifact.title} (${refinement.qualityScoreBefore} → ${refinement.qualityScoreAfter})`);
        }
      } catch (error) {
        // Continue with other artifacts
        logger.warn(`Failed to refine artifact ${artifact.title}:`, error);
      }
    }
  }

  /**
   * Generate tests for project
   */
  private async generateProjectTests(project: any): Promise<void> {
    const codeArtifacts = project.artifacts?.filter((a: any) => a.type === 'code') || [];
    
    for (const artifact of codeArtifacts.slice(0, 5)) { // Limit to 5
      try {
        const language = this.detectLanguage(artifact.title || '');
        const testSuite = await testGenerationService.generateTestSuite(
          artifact.content || '',
          {
            language,
            testTypes: ['unit', 'integration'],
            projectType: project.projectType
          }
        );

        // Add test artifacts
        if (!project.artifacts) project.artifacts = [];

        testSuite.unitTests.forEach((test, idx) => {
          project.artifacts.push({
            id: `test-${Date.now()}-${idx}`,
            title: `${artifact.title}_test_${idx + 1}.test.${language === 'typescript' ? 'ts' : 'js'}`,
            content: test.code,
            type: 'test-plan',
            phase: project.currentPhase,
            createdBy: 'Test Agent',
            timestamp: Date.now(),
            tags: ['test', 'unit', 'generated']
          });
        });
      } catch (error) {
        logger.warn(`Failed to generate tests for ${artifact.title}:`, error);
      }
    }
  }

  /**
   * Detect programming language
   */
  private detectLanguage(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('.ts') || lower.includes('typescript')) return 'typescript';
    if (lower.includes('.js') || lower.includes('javascript')) return 'javascript';
    if (lower.includes('.py') || lower.includes('python')) return 'python';
    if (lower.includes('.java')) return 'java';
    return 'typescript';
  }

  /**
   * Generate project completion report
   */
  async generateCompletionReport(projectId: string): Promise<string> {
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new Error('Project not found');
    }

    const completion = await this.completeProject(projectId);

    return `# Project Completion Report: ${project.name}

## Status: ${completion.success ? '✅ COMPLETE' : '⚠️ INCOMPLETE'}

## Quality Assessment
- **Overall Score**: ${completion.qualityGate.score}/100
- **Quality Gates**: ${completion.qualityGate.passed ? '✅ PASSED' : '❌ FAILED'}

## Summary
- **Total Artifacts**: ${completion.summary.totalArtifacts}
- **Code Artifacts**: ${completion.summary.codeArtifacts}
- **Documentation**: ${completion.summary.documentationArtifacts}
- **Tests**: ${completion.summary.testArtifacts}

## Deployment Readiness
${completion.deploymentReady ? '✅ Ready for deployment' : '❌ Not ready - see issues below'}

## Issues
${completion.errors.length > 0 ? completion.errors.map(e => `- ❌ ${e}`).join('\n') : '- None'}
${completion.warnings.length > 0 ? '\n## Warnings\n' + completion.warnings.map(w => `- ⚠️ ${w}`).join('\n') : ''}
`;
  }
}

export const projectCompletionService = new ProjectCompletionService();




