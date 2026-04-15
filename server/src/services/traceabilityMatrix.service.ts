/**
 * Traceability Matrix Service
 * Generates requirements × artifacts traceability matrix with export functionality
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { requirementsValidationService, ParsedRequirement } from './requirementsValidation.service.js';

export interface TraceabilityMatrixCell {
  requirementId: string;
  artifactId: string;
  artifactType: string;
  linkType: 'direct' | 'indirect' | 'none';
  linkStrength: number; // 0-1
  evidence: string[]; // Trace references or content matches
}

export interface TraceabilityMatrix {
  projectId: string;
  requirements: Array<{
    id: string;
    title: string;
    type: string;
    priority: string;
  }>;
  artifacts: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  matrix: TraceabilityMatrixCell[][];
  summary: {
    totalRequirements: number;
    totalArtifacts: number;
    linkedCells: number;
    unlinkedCells: number;
    coverage: number; // Percentage
  };
  generatedAt: Date;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  includeUnlinked?: boolean;
  filterByType?: string[];
}

class TraceabilityMatrixService {
  /**
   * Generate traceability matrix
   */
  async generateMatrix(projectId: string): Promise<TraceabilityMatrix> {
    try {
      logger.info(`Generating traceability matrix for project ${projectId}`);

      // Get all requirements
      const reqArtifacts = await Artifact.find({
        projectId,
        type: 'requirement'
      }).lean() as any;

      if (reqArtifacts.length === 0) {
        return {
          projectId,
          requirements: [],
          artifacts: [],
          matrix: [],
          summary: {
            totalRequirements: 0,
            totalArtifacts: 0,
            linkedCells: 0,
            unlinkedCells: 0,
            coverage: 0
          },
          generatedAt: new Date()
        };
      }

      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);
      const allArtifacts = await Artifact.find({ projectId }).lean() as any;

      // Filter relevant artifacts (code, tests, designs)
      const relevantArtifacts = allArtifacts.filter((a: any) => 
        a.type === 'code' || 
        a.type === 'test-plan' || 
        a.type === 'design' || 
        a.type === 'audit-report' ||
        a.type === 'build'
      );

      // Build matrix
      const matrix: TraceabilityMatrixCell[][] = [];

      for (const req of requirements) {
        const row: TraceabilityMatrixCell[] = [];

        for (const artifact of relevantArtifacts) {
          const cell = this.analyzeLink(req, artifact, allArtifacts);
          row.push(cell);
        }

        matrix.push(row);
      }

      // Calculate summary
      const linkedCells = matrix.flat().filter(cell => cell.linkType !== 'none').length;
      const totalCells = matrix.length * relevantArtifacts.length;
      const unlinkedCells = totalCells - linkedCells;
      const coverage = totalCells > 0 ? (linkedCells / totalCells) * 100 : 0;

      return {
        projectId,
        requirements: requirements.map(req => ({
          id: req.id,
          title: req.description.substring(0, 100),
          type: req.type,
          priority: req.priority
        })),
        artifacts: relevantArtifacts.map((art: any) => ({
          id: art._id.toString(),
          title: art.title,
          type: art.type
        })),
        matrix,
        summary: {
          totalRequirements: requirements.length,
          totalArtifacts: relevantArtifacts.length,
          linkedCells,
          unlinkedCells,
          coverage: Math.round(coverage * 100) / 100
        },
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to generate traceability matrix:', error);
      throw error;
    }
  }

  /**
   * Analyze link between requirement and artifact
   */
  private analyzeLink(
    requirement: ParsedRequirement,
    artifact: IArtifact,
    _allArtifacts: IArtifact[]
  ): TraceabilityMatrixCell {
    let linkType: 'direct' | 'indirect' | 'none' = 'none';
    let linkStrength = 0;
    const evidence: string[] = [];

    // Check direct traceRefs
    if (artifact.traceRefs && artifact.traceRefs.length > 0) {
      const hasDirectRef = artifact.traceRefs.some(ref => 
        ref.toString() === requirement.sourceArtifactId
      );
      
      if (hasDirectRef) {
        linkType = 'direct';
        linkStrength = 1.0;
        evidence.push('traceRef');
      }
    }

    // Check if requirement ID appears in artifact
    // const normalizeId = (id: string) => id.replace(/[-\s_]/g, '').toUpperCase();
    // const _normalizedReqId = normalizeId(requirement.id);
    const exactMatch = new RegExp(`\\b${requirement.id.replace(/[-\s]/g, '[-\\s]?')}\\b`, 'i');

    if (exactMatch.test(artifact.title) || exactMatch.test(artifact.content)) {
      if (linkType === 'none') {
        linkType = 'direct';
        linkStrength = 0.9;
      } else {
        linkStrength = Math.min(1.0, linkStrength + 0.1);
      }
      evidence.push('requirement_id_in_content');
    }

    // Check keyword matching
    const reqKeywords = this.extractKeywords(requirement.description);
    const artifactContent = (artifact.content || '').toLowerCase();
    const artifactTitle = artifact.title.toLowerCase();
    const matchingKeywords = reqKeywords.filter(kw => 
      artifactContent.includes(kw.toLowerCase()) || 
      artifactTitle.includes(kw.toLowerCase())
    );

    if (matchingKeywords.length >= 2) {
      if (linkType === 'none') {
        linkType = 'indirect';
        linkStrength = 0.6;
      } else {
        linkStrength = Math.min(1.0, linkStrength + 0.2);
      }
      evidence.push(`keyword_match: ${matchingKeywords.slice(0, 3).join(', ')}`);
    }

    // Check linked artifacts
    if (requirement.linkedCode.includes(artifact._id.toString()) ||
        requirement.linkedTests.includes(artifact._id.toString()) ||
        requirement.linkedDesigns.includes(artifact._id.toString())) {
      if (linkType === 'none') {
        linkType = 'direct';
        linkStrength = 0.8;
      } else {
        linkStrength = Math.min(1.0, linkStrength + 0.2);
      }
      evidence.push('linked_artifact');
    }

    return {
      requirementId: requirement.id,
      artifactId: artifact._id.toString(),
      artifactType: artifact.type,
      linkType,
      linkStrength: Math.round(linkStrength * 100) / 100,
      evidence
    };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    
    return Array.from(new Set(words)).slice(0, 10); // Top 10 unique keywords
  }

  /**
   * Export matrix to CSV
   */
  exportToCSV(matrix: TraceabilityMatrix, options: ExportOptions = { format: 'csv' }): string {
    const lines: string[] = [];

    // Header row
    const header = ['Requirement ID', 'Requirement Title', 'Requirement Type', 'Priority', ...matrix.artifacts.map(a => a.title)];
    lines.push(header.map(h => `"${h}"`).join(','));

    // Data rows
    for (let i = 0; i < matrix.requirements.length; i++) {
      const req = matrix.requirements[i];
      const row = matrix.matrix[i];
      
      const rowData = [
        req.id,
        req.title,
        req.type,
        req.priority,
        ...row.map(cell => {
          if (cell.linkType === 'none' && !options.includeUnlinked) {
            return '';
          }
          return cell.linkType === 'none' ? 'No Link' : 
                 cell.linkType === 'direct' ? 'Direct' : 'Indirect';
        })
      ];
      
      lines.push(rowData.map(d => `"${d}"`).join(','));
    }

    return lines.join('\n');
  }

  /**
   * Export matrix to JSON
   */
  exportToJSON(matrix: TraceabilityMatrix, options: ExportOptions = { format: 'json' }): string {
    let filteredMatrix = matrix;

    if (!options.includeUnlinked) {
      // Filter out unlinked cells
      filteredMatrix = {
        ...matrix,
        matrix: matrix.matrix.map(row => 
          row.filter(cell => cell.linkType !== 'none')
        )
      };
    }

    if (options.filterByType && options.filterByType.length > 0) {
      // Filter by artifact type
      const artifactIndices = matrix.artifacts
        .map((art, idx) => options.filterByType!.includes(art.type) ? idx : -1)
        .filter(idx => idx >= 0);

      filteredMatrix = {
        ...filteredMatrix,
        artifacts: filteredMatrix.artifacts.filter((_art, idx) => 
          artifactIndices.includes(idx)
        ),
        matrix: filteredMatrix.matrix.map(row => 
          row.filter((_, idx) => artifactIndices.includes(idx))
        )
      };
    }

    return JSON.stringify(filteredMatrix, null, 2);
  }

  /**
   * Export matrix to Excel format (CSV with better formatting)
   */
  exportToExcel(matrix: TraceabilityMatrix, options: ExportOptions = { format: 'excel' }): string {
    // Excel can read CSV, so we'll use CSV format with better structure
    return this.exportToCSV(matrix, { ...options, format: 'csv' });
  }
}

export const traceabilityMatrixService = new TraceabilityMatrixService();



