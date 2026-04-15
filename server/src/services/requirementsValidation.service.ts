/**
 * Requirements Validation Service
 * Extracts, validates, and tracks requirements implementation coverage
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';

export interface ParsedRequirement {
  id: string;
  type: 'functional' | 'non-functional' | 'use-case' | 'constraint' | 'feature';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'implemented' | 'partial' | 'missing' | 'unknown';
  sourceArtifactId: string;
  sourceArtifactTitle: string;
  linkedCode: string[]; // Artifact IDs
  linkedTests: string[]; // Artifact IDs
  linkedDesigns: string[]; // Artifact IDs
  traceRefs: string[]; // Direct trace references
  nfrCategory?: 'performance' | 'security' | 'scalability' | 'reliability' | 'usability' | 'maintainability' | 'compatibility';
  nfrMetrics?: {
    target?: string;
    actual?: string;
    unit?: string;
  };
}

export interface ValidationReport {
  projectId: string;
  totalRequirements: number;
  implemented: number;
  partial: number;
  missing: number;
  requirements: ParsedRequirement[];
  coverage: number; // Percentage
  issues: ValidationIssue[];
  generatedAt: Date;
}

export interface ValidationIssue {
  type: 'missing_implementation' | 'missing_tests' | 'missing_design' | 'no_trace_refs' | 'incomplete_trace';
  requirementId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestedActions: string[];
}

export interface TraceabilityReport {
  projectId: string;
  totalRequirements: number;
  requirementsWithTraceRefs: number;
  requirementsWithoutTraceRefs: number;
  traceabilityScore: number; // Percentage
  missingLinks: Array<{
    requirementId: string;
    missingArtifactTypes: string[];
  }>;
}

class RequirementsValidationService {
  /**
   * Extract requirements from requirement artifacts
   */
  extractRequirements(artifacts: IArtifact[]): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    const reqArtifacts = artifacts.filter(a => a.type === 'requirement');

    for (const artifact of reqArtifacts) {
      const parsed = this.parseRequirementArtifact(artifact);
      requirements.push(...parsed);
    }

    return requirements;
  }

  /**
   * Parse a single requirement artifact into structured requirements
   */
  private parseRequirementArtifact(artifact: IArtifact): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    const content = artifact.content || '';
    const lines = content.split('\n');

    // Pattern 1: Table format (markdown table)
    if (content.includes('|') && content.includes('ID')) {
      const tableReqs = this.parseTableFormat(artifact, lines);
      requirements.push(...tableReqs);
    }

    // Pattern 2: List format with IDs (REQ-001, FR-001, UC-001, etc.)
    const listReqs = this.parseListFormat(artifact, lines);
    requirements.push(...listReqs);

    // Pattern 3: Structured sections (## Functional Requirements, etc.)
    const sectionReqs = this.parseSectionFormat(artifact, content);
    requirements.push(...sectionReqs);

    // If no structured format found, create a single requirement from the artifact
    if (requirements.length === 0 && content.trim().length > 0) {
      requirements.push({
        id: `REQ-${artifact._id.toString().substring(0, 8)}`,
        type: 'feature',
        description: content.substring(0, 500),
        priority: 'medium',
        status: 'unknown',
        sourceArtifactId: artifact._id.toString(),
        sourceArtifactTitle: artifact.title,
        linkedCode: [],
        linkedTests: [],
        linkedDesigns: [],
        traceRefs: artifact.traceRefs?.map(ref => ref.toString()) || []
      });
    }

    return requirements;
  }

  /**
   * Parse markdown table format
   */
  private parseTableFormat(artifact: IArtifact, lines: string[]): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    let inTable = false;
    let headers: string[] = [];
    let idColIndex = -1;
    let descColIndex = -1;
    let priorityColIndex = -1;
    let typeColIndex = -1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) continue;

      const cols = trimmed.split('|').map(c => c.trim()).filter(c => c !== '');

      if (!inTable) {
        const headerStr = cols.join(' ').toLowerCase();
        if (headerStr.includes('id') && (headerStr.includes('desc') || headerStr.includes('req') || headerStr.includes('feature'))) {
          headers = cols.map(c => c.toLowerCase());
          idColIndex = headers.findIndex(h => h.includes('id'));
          descColIndex = headers.findIndex(h => h.includes('desc') || h.includes('description') || h.includes('req') || h.includes('feature'));
          priorityColIndex = headers.findIndex(h => h.includes('priority') || h.includes('prio'));
          typeColIndex = headers.findIndex(h => h.includes('type') || h.includes('category'));
          inTable = true;
          continue;
        }
      }

      if (inTable && trimmed.includes('---')) continue;

      if (inTable && cols.length >= 2) {
        const id = idColIndex >= 0 ? cols[idColIndex] : `REQ-${requirements.length + 1}`;
        const description = descColIndex >= 0 ? cols[descColIndex] : cols[1];
        const priority = this.parsePriority(priorityColIndex >= 0 ? cols[priorityColIndex] : 'medium');
        const type = this.parseType(typeColIndex >= 0 ? cols[typeColIndex] : 'feature');

        if (id && description) {
          requirements.push({
            id: id.trim(),
            type,
            description: description.trim(),
            priority,
            status: 'unknown',
            sourceArtifactId: artifact._id.toString(),
            sourceArtifactTitle: artifact.title,
            linkedCode: [],
            linkedTests: [],
            linkedDesigns: [],
            traceRefs: artifact.traceRefs?.map(ref => ref.toString()) || []
          });
        }
      }
    }

    return requirements;
  }

  /**
   * Parse list format (REQ-001, FR-001, UC-001, etc.)
   */
  private parseListFormat(artifact: IArtifact, lines: string[]): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    const idPattern = /\b(REQ|FR|UC|NFR|CONSTRAINT|FEATURE)-(\d+)\b/i;

    for (const line of lines) {
      const match = line.match(idPattern);
      if (match) {
        const id = match[0];
        const description = line.replace(idPattern, '').replace(/^[:\-\s]+/, '').trim();
        
        if (description) {
          const type = this.inferTypeFromId(id);
          const priority = this.extractPriority(line);

          requirements.push({
            id,
            type,
            description,
            priority,
            status: 'unknown',
            sourceArtifactId: artifact._id.toString(),
            sourceArtifactTitle: artifact.title,
            linkedCode: [],
            linkedTests: [],
            linkedDesigns: [],
            traceRefs: artifact.traceRefs?.map(ref => ref.toString()) || []
          });
        }
      }
    }

    return requirements;
  }

  /**
   * Parse section format (## Functional Requirements, etc.)
   */
  private parseSectionFormat(artifact: IArtifact, content: string): ParsedRequirement[] {
    const requirements: ParsedRequirement[] = [];
    const sectionPattern = /^##+\s*(Functional|Non-Functional|Use Cases|Features|Constraints)/i;
    const listItemPattern = /^[\*\-\+]\s*(.+)$/;
    const numberedPattern = /^\d+\.\s*(.+)$/;

    let currentSection = 'feature';
    let reqCounter = 1;

    const lines = content.split('\n');
    for (const line of lines) {
      const sectionMatch = line.match(sectionPattern);
      if (sectionMatch) {
        currentSection = sectionMatch[1].toLowerCase().replace(/\s+/, '-');
        reqCounter = 1;
        continue;
      }

      const listMatch = line.match(listItemPattern);
      const numberedMatch = line.match(numberedPattern);
      const text = listMatch ? listMatch[1] : (numberedMatch ? numberedMatch[1] : null);

      if (text && text.trim().length > 10) {
        const id = `REQ-${artifact._id.toString().substring(0, 8)}-${reqCounter++}`;
        requirements.push({
          id,
          type: this.inferTypeFromSection(currentSection),
          description: text.trim(),
          priority: this.extractPriority(text),
          status: 'unknown',
          sourceArtifactId: artifact._id.toString(),
          sourceArtifactTitle: artifact.title,
          linkedCode: [],
          linkedTests: [],
          linkedDesigns: [],
          traceRefs: artifact.traceRefs?.map(ref => ref.toString()) || []
        });
      }
    }

    return requirements;
  }

  /**
   * Validate requirements coverage
   */
  async validateRequirementsCoverage(
    projectId: string,
    requirements: ParsedRequirement[],
    artifacts: IArtifact[]
  ): Promise<ValidationReport> {
    const codeArtifacts = artifacts.filter(a => a.type === 'code' || a.type === 'build');
    const testArtifacts = artifacts.filter(a => a.type === 'test-plan' || a.type === 'audit-report');
    const designArtifacts = artifacts.filter(a => a.type === 'design' || a.type === 'image');

    const issues: ValidationIssue[] = [];
    let implemented = 0;
    let partial = 0;
    let missing = 0;

    for (const req of requirements) {
      // Find linked artifacts via traceRefs
      const linkedCode = this.findLinkedArtifacts(req, codeArtifacts);
      const linkedTests = this.findLinkedArtifacts(req, testArtifacts);
      const linkedDesigns = this.findLinkedArtifacts(req, designArtifacts);

      req.linkedCode = linkedCode.map(a => a._id.toString());
      req.linkedTests = linkedTests.map(a => a._id.toString());
      req.linkedDesigns = linkedDesigns.map(a => a._id.toString());

      // Determine status
      if (linkedCode.length > 0 && linkedTests.length > 0) {
        req.status = 'implemented';
        implemented++;
      } else if (linkedCode.length > 0 || linkedDesigns.length > 0) {
        req.status = 'partial';
        partial++;
      } else {
        req.status = 'missing';
        missing++;
      }

      // Generate issues
      if (req.status === 'missing') {
        issues.push({
          type: 'missing_implementation',
          requirementId: req.id,
          severity: req.priority === 'critical' ? 'critical' : req.priority === 'high' ? 'high' : 'medium',
          message: `Requirement ${req.id} has no implementation`,
          suggestedActions: [
            `Create code artifact for ${req.id}`,
            `Link requirement ${req.id} to implementation using traceRefs`
          ]
        });
      } else if (req.status === 'partial') {
        if (linkedCode.length === 0) {
          issues.push({
            type: 'missing_implementation',
            requirementId: req.id,
            severity: 'medium',
            message: `Requirement ${req.id} has design but no code implementation`,
            suggestedActions: [
              `Implement code for requirement ${req.id}`,
              `Link code artifact to ${req.id} using traceRefs`
            ]
          });
        }
        if (linkedTests.length === 0) {
          issues.push({
            type: 'missing_tests',
            requirementId: req.id,
            severity: req.priority === 'critical' ? 'high' : 'medium',
            message: `Requirement ${req.id} has no test coverage`,
            suggestedActions: [
              `Create test plan for requirement ${req.id}`,
              `Link test artifact to ${req.id} using traceRefs`
            ]
          });
        }
      }

      if (req.traceRefs.length === 0 && linkedCode.length === 0) {
        issues.push({
          type: 'no_trace_refs',
          requirementId: req.id,
          severity: 'low',
          message: `Requirement ${req.id} has no trace references`,
          suggestedActions: [
            `Add traceRefs to requirement ${req.id}`,
            `Link implementation artifacts to ${req.id}`
          ]
        });
      }
    }

    const coverage = requirements.length > 0
      ? ((implemented + partial * 0.5) / requirements.length) * 100
      : 0;

    return {
      projectId,
      totalRequirements: requirements.length,
      implemented,
      partial,
      missing,
      requirements,
      coverage: Math.round(coverage * 100) / 100,
      issues,
      generatedAt: new Date()
    };
  }

  /**
   * Check traceability
   */
  checkTraceability(
    requirements: ParsedRequirement[],
    _artifacts: IArtifact[]
  ): TraceabilityReport {
    let withTraceRefs = 0;
    let withoutTraceRefs = 0;
    const missingLinks: Array<{ requirementId: string; missingArtifactTypes: string[] }> = [];

    for (const req of requirements) {
      const hasCode = req.linkedCode.length > 0;
      const hasTests = req.linkedTests.length > 0;
      const hasDesign = req.linkedDesigns.length > 0;

      if (req.traceRefs.length > 0 || hasCode || hasTests || hasDesign) {
        withTraceRefs++;
      } else {
        withoutTraceRefs++;
      }

      const missingTypes: string[] = [];
      if (!hasCode) missingTypes.push('code');
      if (!hasTests) missingTypes.push('tests');
      if (!hasDesign && req.type !== 'constraint') missingTypes.push('design');

      if (missingTypes.length > 0) {
        missingLinks.push({
          requirementId: req.id,
          missingArtifactTypes: missingTypes
        });
      }
    }

    const traceabilityScore = requirements.length > 0
      ? (withTraceRefs / requirements.length) * 100
      : 0;

    return {
      projectId: '', // Will be set by caller
      totalRequirements: requirements.length,
      requirementsWithTraceRefs: withTraceRefs,
      requirementsWithoutTraceRefs: withoutTraceRefs,
      traceabilityScore: Math.round(traceabilityScore * 100) / 100,
      missingLinks
    };
  }

  /**
   * Find artifacts linked to a requirement
   */
  private findLinkedArtifacts(req: ParsedRequirement, artifacts: IArtifact[]): IArtifact[] {
    const normalizeId = (id: string) => id.replace(/[-\s_]/g, '').toUpperCase();
    const normalizedReqId = normalizeId(req.id);
    const exactMatch = new RegExp(`\\b${req.id.replace(/[-\s]/g, '[-\\s]?')}\\b`, 'i');

    return artifacts.filter(artifact => {
      // Check traceRefs
      if (artifact.traceRefs && artifact.traceRefs.length > 0) {
        const matchesTraceRef = artifact.traceRefs.some(ref => {
          const refStr = ref.toString();
          const normalizedRef = normalizeId(refStr);
          return normalizedRef === normalizedReqId ||
                 normalizedRef.includes(normalizedReqId) ||
                 normalizedReqId.includes(normalizedRef) ||
                 exactMatch.test(refStr);
        });
        if (matchesTraceRef) return true;
      }

      // Check if requirement ID is in title or content
      if (exactMatch.test(artifact.title) || exactMatch.test(artifact.content)) {
        return true;
      }

      // Check tags
      if (artifact.tags && artifact.tags.some(tag => exactMatch.test(tag))) {
        return true;
      }

      return false;
    });
  }

  /**
   * Helper methods
   */
  private parsePriority(priority: string): ParsedRequirement['priority'] {
    const p = priority.toLowerCase();
    if (p.includes('critical') || p.includes('must')) return 'critical';
    if (p.includes('high') || p.includes('should')) return 'high';
    if (p.includes('low') || p.includes('nice')) return 'low';
    return 'medium';
  }

  private parseType(type: string): ParsedRequirement['type'] {
    const t = type.toLowerCase();
    if (t.includes('functional') || t.includes('fr')) return 'functional';
    if (t.includes('non-functional') || t.includes('nfr')) return 'non-functional';
    if (t.includes('use case') || t.includes('uc')) return 'use-case';
    if (t.includes('constraint')) return 'constraint';
    return 'feature';
  }

  private inferTypeFromId(id: string): ParsedRequirement['type'] {
    if (id.startsWith('FR-')) return 'functional';
    if (id.startsWith('NFR-')) return 'non-functional';
    if (id.startsWith('UC-')) return 'use-case';
    if (id.startsWith('CONSTRAINT-')) return 'constraint';
    return 'feature';
  }

  private inferTypeFromSection(section: string): ParsedRequirement['type'] {
    if (section.includes('functional')) return 'functional';
    if (section.includes('non-functional')) return 'non-functional';
    if (section.includes('use case')) return 'use-case';
    if (section.includes('constraint')) return 'constraint';
    return 'feature';
  }

  private extractPriority(text: string): ParsedRequirement['priority'] {
    const t = text.toLowerCase();
    if (t.includes('critical') || t.includes('must have') || t.includes('required')) return 'critical';
    if (t.includes('high') || t.includes('should have') || t.includes('important')) return 'high';
    if (t.includes('low') || t.includes('nice to have') || t.includes('optional')) return 'low';
    return 'medium';
  }

  /**
   * Detect missing requirements when new artifacts are created
   */
  async detectMissingRequirements(
    projectId: string,
    _newArtifact: IArtifact
  ): Promise<ValidationIssue[]> {
    // Get all requirements for the project
    const reqArtifacts = await Artifact.find({
      projectId,
      type: 'requirement'
    });

    if (reqArtifacts.length === 0) return [];

    const requirements = this.extractRequirements(reqArtifacts);
    const allArtifacts = await Artifact.find({ projectId });
    
    const report = await this.validateRequirementsCoverage(
      projectId,
      requirements,
      allArtifacts
    );

    // Return only critical/high priority missing requirements
    return report.issues.filter(
      issue => issue.severity === 'critical' || issue.severity === 'high'
    );
  }

  /**
   * Auto-link artifact to requirements based on content analysis
   * Uses LLM to analyze artifact content and suggest requirement links
   */
  async suggestRequirementLinks(
    projectId: string,
    artifact: IArtifact
  ): Promise<Array<{ requirementId: string; confidence: number; reason: string }>> {
    try {
      // Only suggest links for code and test artifacts
      if (artifact.type !== 'code' && artifact.type !== 'test-plan') {
        return [];
      }

      // Get all requirements
      const reqArtifacts = await Artifact.find({
        projectId,
        type: 'requirement'
      });

      if (reqArtifacts.length === 0) return [];

      const requirements = this.extractRequirements(reqArtifacts);

      // Simple keyword matching for now (can be enhanced with LLM)
      const artifactContent = (artifact.content || '').toLowerCase();
      const artifactTitle = (artifact.title || '').toLowerCase();
      const suggestions: Array<{ requirementId: string; confidence: number; reason: string }> = [];

      for (const req of requirements) {
        const reqId = req.id.toLowerCase();
        const reqDesc = req.description.toLowerCase();
        
        // Check if requirement ID appears in artifact
        if (artifactContent.includes(reqId) || artifactTitle.includes(reqId)) {
          suggestions.push({
            requirementId: req.id,
            confidence: 0.9,
            reason: `Requirement ID ${req.id} found in artifact content`
          });
          continue;
        }

        // Check for keyword matches
        const reqKeywords = reqDesc.split(/\s+/).filter(w => w.length > 4);
        const matchingKeywords = reqKeywords.filter(kw => 
          artifactContent.includes(kw) || artifactTitle.includes(kw)
        );
        
        if (matchingKeywords.length >= 2) {
          const confidence = Math.min(0.7, matchingKeywords.length / reqKeywords.length);
          suggestions.push({
            requirementId: req.id,
            confidence,
            reason: `Found ${matchingKeywords.length} matching keywords: ${matchingKeywords.slice(0, 3).join(', ')}`
          });
        }
      }

      // Sort by confidence and return top 5
      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
    } catch (error: unknown) {
      logger.error('Failed to suggest requirement links:', error);
      return [];
    }
  }
}

export const requirementsValidationService = new RequirementsValidationService();
