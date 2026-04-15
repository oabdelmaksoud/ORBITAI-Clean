/**
 * ASPICE Compliance Service
 * Maps requirements to ASPICE process areas and tracks compliance
 */

import { logger } from '../utils/logger.js';
import { ASPICECompliance, IASPICECompliance } from '../models/ASPICECompliance.model.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import {
  requirementsValidationService,
  ParsedRequirement,
} from './requirementsValidation.service.js';

// ASPICE Process Areas (Level 3 focus)
export const ASPICE_PROCESS_AREAS = {
  'SYS.1': {
    name: 'Requirements Elicitation',
    level: 3,
    description: 'System requirements are elicited, analyzed, and agreed upon',
    workProducts: [
      'System Requirements Specification',
      'Stakeholder Requirements',
      'Requirements Traceability Record',
    ],
    practices: [
      'BP.1: Elicit stakeholder requirements',
      'BP.2: Analyze stakeholder requirements',
      'BP.3: Define system requirements',
      'BP.4: Analyze system requirements',
      'BP.5: Agree on system requirements',
    ],
  },
  'SYS.2': {
    name: 'System Requirements Analysis',
    level: 3,
    description: 'System requirements are analyzed and refined',
    workProducts: [
      'System Requirements Specification',
      'System Architecture',
      'Requirements Traceability Record',
    ],
    practices: [
      'BP.1: Analyze system requirements',
      'BP.2: Define system architecture',
      'BP.3: Allocate system requirements',
      'BP.4: Analyze system architecture',
    ],
  },
  'SYS.3': {
    name: 'System Architectural Design',
    level: 3,
    description: 'System architecture is designed',
    workProducts: ['System Architecture', 'System Design Specification', 'Interface Specification'],
    practices: [
      'BP.1: Design system architecture',
      'BP.2: Define interfaces',
      'BP.3: Analyze system architecture',
      'BP.4: Verify system architecture',
    ],
  },
  'SYS.4': {
    name: 'System Integration and Testing',
    level: 3,
    description: 'System integration and testing is performed',
    workProducts: [
      'Integration Test Plan',
      'Integration Test Cases',
      'Integration Test Report',
      'System Test Report',
    ],
    practices: [
      'BP.1: Prepare system integration',
      'BP.2: Perform system integration',
      'BP.3: Verify integrated system',
      'BP.4: Perform system testing',
    ],
  },
  'SWE.1': {
    name: 'Software Requirements Analysis',
    level: 3,
    description: 'Software requirements are analyzed',
    workProducts: [
      'Software Requirements Specification',
      'Software Interface Specification',
      'Requirements Traceability Record',
    ],
    practices: [
      'BP.1: Analyze software requirements',
      'BP.2: Define software architecture',
      'BP.3: Allocate software requirements',
      'BP.4: Analyze software architecture',
    ],
  },
  'SWE.2': {
    name: 'Software Architectural Design',
    level: 3,
    description: 'Software architecture is designed',
    workProducts: [
      'Software Architecture',
      'Software Design Specification',
      'Interface Specification',
    ],
    practices: [
      'BP.1: Design software architecture',
      'BP.2: Define interfaces',
      'BP.3: Analyze software architecture',
      'BP.4: Verify software architecture',
    ],
  },
  'SWE.3': {
    name: 'Software Detailed Design',
    level: 3,
    description: 'Software detailed design is created',
    workProducts: ['Software Detailed Design', 'Software Unit Design', 'Interface Specification'],
    practices: [
      'BP.1: Design software units',
      'BP.2: Define interfaces',
      'BP.3: Analyze software design',
      'BP.4: Verify software design',
    ],
  },
  'SWE.4': {
    name: 'Software Unit Implementation',
    level: 3,
    description: 'Software units are implemented',
    workProducts: ['Software Unit Code', 'Software Unit Documentation', 'Code Review Report'],
    practices: [
      'BP.1: Implement software units',
      'BP.2: Verify software units',
      'BP.3: Integrate software units',
    ],
  },
  'SWE.5': {
    name: 'Software Unit Testing',
    level: 3,
    description: 'Software units are tested',
    workProducts: ['Unit Test Plan', 'Unit Test Cases', 'Unit Test Report'],
    practices: [
      'BP.1: Prepare unit testing',
      'BP.2: Perform unit testing',
      'BP.3: Verify unit test results',
    ],
  },
  'SWE.6': {
    name: 'Software Integration Testing',
    level: 3,
    description: 'Software integration testing is performed',
    workProducts: ['Integration Test Plan', 'Integration Test Cases', 'Integration Test Report'],
    practices: [
      'BP.1: Prepare software integration',
      'BP.2: Perform software integration',
      'BP.3: Verify integrated software',
      'BP.4: Perform integration testing',
    ],
  },
};

// V-Model phase to ASPICE mapping
export const VMODEL_TO_ASPICE = {
  requirements: ['SYS.1', 'SYS.2', 'SWE.1'],
  architecture: ['SYS.3', 'SWE.2', 'SWE.3'],
  implementation: ['SWE.4'],
  testing: ['SWE.5', 'SWE.6', 'SYS.4'],
  deployment: ['SYS.4'],
};

export interface ASPICEComplianceReport {
  projectId: string;
  overallScore: number; // 0-100
  processAreas: Array<{
    processArea: string;
    processAreaName: string;
    complianceScore: number;
    requirementsMapped: number;
    totalRequirements: number;
    workProductsComplete: number;
    totalWorkProducts: number;
    practicesImplemented: number;
    totalPractices: number;
  }>;
  vModelMapping: Array<{
    phase: string;
    processAreas: string[];
    complianceScore: number;
  }>;
  gaps: Array<{
    processArea: string;
    gapType: 'missing_requirement' | 'missing_workproduct' | 'missing_practice';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  generatedAt: Date;
}

class ASPICEComplianceService {
  /**
   * Map requirements to ASPICE process areas
   */
  async mapRequirementsToASPICE(
    projectId: string,
    targetLevel: number = 3
  ): Promise<IASPICECompliance[]> {
    try {
      logger.info(`Mapping requirements to ASPICE Level ${targetLevel} for project ${projectId}`);

      // Get all requirements
      const reqArtifacts = (await Artifact.find({
        projectId,
        type: 'requirement',
      }).lean()) as any[];

      if (reqArtifacts.length === 0) {
        logger.warn(`No requirements found for project ${projectId}`);
        return [];
      }

      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);
      const allArtifacts = (await Artifact.find({ projectId }).lean()) as any[];

      // Get project phase (from project metadata or artifacts)
      const projectPhase = this.detectProjectPhase(allArtifacts);

      // Determine relevant process areas based on phase
      const relevantProcessAreas = this.getRelevantProcessAreas(projectPhase, targetLevel);

      const complianceRecords: IASPICECompliance[] = [];

      for (const processArea of relevantProcessAreas) {
        const processAreaDef =
          ASPICE_PROCESS_AREAS[processArea as keyof typeof ASPICE_PROCESS_AREAS];
        if (!processAreaDef) continue;

        // Map requirements to this process area
        const mappedRequirements = this.mapRequirementsToProcessArea(
          requirements,
          processArea,
          allArtifacts
        );

        // Check work products
        const workProducts = this.checkWorkProducts(processAreaDef.workProducts, allArtifacts);

        // Check practices
        const practices = this.checkPractices(processAreaDef.practices, allArtifacts);

        // Calculate compliance score
        const complianceScore = this.calculateProcessAreaScore(
          mappedRequirements,
          workProducts,
          practices
        );

        // Create or update compliance record
        const compliance = await ASPICECompliance.findOneAndUpdate(
          { projectId, processArea },
          {
            projectId,
            processArea,
            processAreaName: processAreaDef.name,
            level: targetLevel,
            complianceScore,
            requirements: mappedRequirements.map(req => ({
              requirementId: req.id,
              requirementTitle: req.description.substring(0, 100),
              mapped: true,
              evidence: [...req.linkedCode, ...req.linkedTests, ...req.linkedDesigns],
            })),
            workProducts: workProducts.map(wp => ({
              workProductId: wp.id,
              workProductType: wp.type,
              status: wp.status,
              evidence: wp.evidence,
            })),
            practices: practices.map(p => ({
              practiceId: p.id,
              practiceName: p.name,
              implemented: p.implemented,
              evidence: p.evidence,
            })),
            lastAssessed: new Date(),
          },
          { upsert: true, new: true }
        );

        complianceRecords.push(compliance);
      }

      logger.info(
        `Mapped ${requirements.length} requirements to ${complianceRecords.length} ASPICE process areas`
      );
      return complianceRecords;
    } catch (error: unknown) {
      logger.error('Failed to map requirements to ASPICE:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive ASPICE compliance report
   */
  async generateComplianceReport(
    projectId: string,
    targetLevel: number = 3
  ): Promise<ASPICEComplianceReport> {
    try {
      logger.info(
        `Generating ASPICE Level ${targetLevel} compliance report for project ${projectId}`
      );

      // Map requirements
      const complianceRecords = await this.mapRequirementsToASPICE(projectId, targetLevel);

      if (complianceRecords.length === 0) {
        return {
          projectId,
          overallScore: 0,
          processAreas: [],
          vModelMapping: [],
          gaps: [],
          generatedAt: new Date(),
        };
      }

      // Calculate process area details
      const processAreas = complianceRecords.map(record => ({
        processArea: record.processArea,
        processAreaName: record.processAreaName,
        complianceScore: record.complianceScore,
        requirementsMapped: record.requirements.filter(r => r.mapped).length,
        totalRequirements: record.requirements.length,
        workProductsComplete: record.workProducts.filter(wp => wp.status === 'complete').length,
        totalWorkProducts: record.workProducts.length,
        practicesImplemented: record.practices.filter(p => p.implemented).length,
        totalPractices: record.practices.length,
      }));

      // Calculate overall score (weighted average)
      const overallScore =
        processAreas.length > 0
          ? processAreas.reduce((sum, pa) => sum + pa.complianceScore, 0) / processAreas.length
          : 0;

      // V-Model phase mapping
      const allArtifacts = (await Artifact.find({ projectId }).lean()) as any[];
      const projectPhase = this.detectProjectPhase(allArtifacts);
      const vModelMapping = this.generateVModelMapping(complianceRecords, projectPhase);

      // Identify gaps
      const gaps = this.identifyGaps(complianceRecords);

      return {
        projectId,
        overallScore: Math.round(overallScore * 100) / 100,
        processAreas,
        vModelMapping,
        gaps,
        generatedAt: new Date(),
      };
    } catch (error: unknown) {
      logger.error('Failed to generate ASPICE compliance report:', error);
      throw error;
    }
  }

  /**
   * Map requirements to a specific process area
   */
  private mapRequirementsToProcessArea(
    requirements: ParsedRequirement[],
    processArea: string,
    _artifacts: IArtifact[]
  ): ParsedRequirement[] {
    const processAreaDef = ASPICE_PROCESS_AREAS[processArea as keyof typeof ASPICE_PROCESS_AREAS];
    if (!processAreaDef) return [];

    // Filter requirements based on process area focus
    const mapped: ParsedRequirement[] = [];

    for (const req of requirements) {
      let shouldMap = false;

      // SYS.1, SYS.2, SWE.1: Requirements analysis
      if (['SYS.1', 'SYS.2', 'SWE.1'].includes(processArea)) {
        shouldMap =
          req.type === 'functional' || req.type === 'non-functional' || req.type === 'use-case';
      }
      // SYS.3, SWE.2, SWE.3: Architecture design
      else if (['SYS.3', 'SWE.2', 'SWE.3'].includes(processArea)) {
        shouldMap = req.type === 'feature' || req.type === 'constraint';
        // Also check if requirement has design artifacts
        if (req.linkedDesigns.length > 0) {
          shouldMap = true;
        }
      }
      // SWE.4: Implementation
      else if (processArea === 'SWE.4') {
        shouldMap = req.linkedCode.length > 0;
      }
      // SWE.5, SWE.6, SYS.4: Testing
      else if (['SWE.5', 'SWE.6', 'SYS.4'].includes(processArea)) {
        shouldMap = req.linkedTests.length > 0;
      }

      if (shouldMap) {
        mapped.push(req);
      }
    }

    return mapped;
  }

  /**
   * Check work products for a process area
   */
  private checkWorkProducts(
    workProductTypes: string[],
    artifacts: any[]
  ): Array<{
    id: string;
    type: string;
    status: 'complete' | 'partial' | 'missing';
    evidence: string[];
  }> {
    const results: Array<{
      id: string;
      type: string;
      status: 'complete' | 'partial' | 'missing';
      evidence: string[];
    }> = [];

    for (const wpType of workProductTypes) {
      const matchingArtifacts = artifacts.filter(artifact => {
        const title = artifact.title.toLowerCase();
        const content = artifact.content?.toLowerCase() || '';
        const wpTypeLower = wpType.toLowerCase();

        return (
          title.includes(wpTypeLower) ||
          content.includes(wpTypeLower) ||
          artifact.type === this.inferArtifactTypeFromWorkProduct(wpType)
        );
      });

      let status: 'complete' | 'partial' | 'missing' = 'missing';
      if (matchingArtifacts.length > 0) {
        status = matchingArtifacts.length >= 2 ? 'complete' : 'partial';
      }

      results.push({
        id: wpType.replace(/\s+/g, '-').toLowerCase(),
        type: wpType,
        status,
        evidence: matchingArtifacts.map(a => a._id.toString()),
      });
    }

    return results;
  }

  /**
   * Check practices for a process area
   */
  private checkPractices(
    practices: string[],
    artifacts: any[]
  ): Array<{ id: string; name: string; implemented: boolean; evidence: string[] }> {
    const results: Array<{ id: string; name: string; implemented: boolean; evidence: string[] }> =
      [];

    for (const practice of practices) {
      // Check if there's evidence of this practice
      const practiceKeywords = practice.toLowerCase().split(/\s+/);
      const matchingArtifacts = artifacts.filter(artifact => {
        const content = (artifact.content || '').toLowerCase();
        const title = artifact.title.toLowerCase();
        const combined = `${title} ${content}`;

        // Check if practice keywords appear
        const keywordMatches = practiceKeywords.filter(
          kw => kw.length > 3 && combined.includes(kw)
        );

        return keywordMatches.length >= 2;
      });

      results.push({
        id: practice.replace(/\s+/g, '-').toLowerCase(),
        name: practice,
        implemented: matchingArtifacts.length > 0,
        evidence: matchingArtifacts.map(a => a._id.toString()),
      });
    }

    return results;
  }

  /**
   * Calculate compliance score for a process area
   */
  private calculateProcessAreaScore(
    requirements: ParsedRequirement[],
    workProducts: Array<{ status: string }>,
    practices: Array<{ implemented: boolean }>
  ): number {
    // Weight: Requirements 40%, Work Products 30%, Practices 30%
    const reqScore = requirements.length > 0 ? 100 : 0; // Simplified - all mapped requirements count
    const wpScore =
      workProducts.length > 0
        ? (workProducts.filter(wp => wp.status === 'complete').length * 100 +
            workProducts.filter(wp => wp.status === 'partial').length * 50) /
          workProducts.length
        : 0;
    const practiceScore =
      practices.length > 0
        ? (practices.filter(p => p.implemented).length / practices.length) * 100
        : 0;

    return Math.round((reqScore * 0.4 + wpScore * 0.3 + practiceScore * 0.3) * 100) / 100;
  }

  /**
   * Detect project phase from artifacts
   */
  private detectProjectPhase(artifacts: any[]): string {
    const hasRequirements = artifacts.some(a => a.type === 'requirement');
    const hasDesigns = artifacts.some(a => a.type === 'design' || a.type === 'image');
    const hasCode = artifacts.some(a => a.type === 'code' || a.type === 'build');
    const hasTests = artifacts.some(a => a.type === 'test-plan' || a.type === 'audit-report');

    if (hasTests && hasCode) return 'testing';
    if (hasCode) return 'implementation';
    if (hasDesigns) return 'architecture';
    if (hasRequirements) return 'requirements';
    return 'requirements';
  }

  /**
   * Get relevant process areas for a phase
   */
  private getRelevantProcessAreas(phase: string, level: number): string[] {
    const phaseMapping = VMODEL_TO_ASPICE[phase as keyof typeof VMODEL_TO_ASPICE] || [];

    // Filter by level (Level 3 includes all listed areas)
    return phaseMapping.filter(pa => {
      const def = ASPICE_PROCESS_AREAS[pa as keyof typeof ASPICE_PROCESS_AREAS];
      return def && def.level <= level;
    });
  }

  /**
   * Generate V-Model phase mapping
   */
  private generateVModelMapping(
    complianceRecords: IASPICECompliance[],
    _currentPhase: string
  ): Array<{ phase: string; processAreas: string[]; complianceScore: number }> {
    const mapping: Array<{ phase: string; processAreas: string[]; complianceScore: number }> = [];

    for (const [phase, processAreas] of Object.entries(VMODEL_TO_ASPICE)) {
      const relevantRecords = complianceRecords.filter(cr => processAreas.includes(cr.processArea));
      const avgScore =
        relevantRecords.length > 0
          ? relevantRecords.reduce((sum, r) => sum + r.complianceScore, 0) / relevantRecords.length
          : 0;

      mapping.push({
        phase,
        processAreas,
        complianceScore: Math.round(avgScore * 100) / 100,
      });
    }

    return mapping;
  }

  /**
   * Identify compliance gaps
   */
  private identifyGaps(complianceRecords: IASPICECompliance[]): Array<{
    processArea: string;
    gapType: 'missing_requirement' | 'missing_workproduct' | 'missing_practice';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }> {
    const gaps: Array<{
      processArea: string;
      gapType: 'missing_requirement' | 'missing_workproduct' | 'missing_practice';
      description: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    for (const record of complianceRecords) {
      // Missing work products
      const missingWorkProducts = record.workProducts.filter(wp => wp.status === 'missing');
      for (const wp of missingWorkProducts) {
        gaps.push({
          processArea: record.processArea,
          gapType: 'missing_workproduct',
          description: `Missing work product: ${wp.workProductType}`,
          severity: 'high',
        });
      }

      // Missing practices
      const missingPractices = record.practices.filter(p => !p.implemented);
      for (const practice of missingPractices) {
        gaps.push({
          processArea: record.processArea,
          gapType: 'missing_practice',
          description: `Practice not implemented: ${practice.practiceName}`,
          severity: 'medium',
        });
      }

      // Low compliance score
      if (record.complianceScore < 50) {
        gaps.push({
          processArea: record.processArea,
          gapType: 'missing_requirement',
          description: `Low compliance score (${record.complianceScore}%) for ${record.processAreaName}`,
          severity: 'high',
        });
      }
    }

    return gaps;
  }

  /**
   * Infer artifact type from work product name
   */
  private inferArtifactTypeFromWorkProduct(wpType: string): string {
    const wpLower = wpType.toLowerCase();
    if (wpLower.includes('requirement')) return 'requirement';
    if (wpLower.includes('architecture') || wpLower.includes('design')) return 'design';
    if (wpLower.includes('test')) return 'test-plan';
    if (wpLower.includes('code') || wpLower.includes('implementation')) return 'code';
    return 'documentation';
  }
}

export const aspiceComplianceService = new ASPICEComplianceService();
