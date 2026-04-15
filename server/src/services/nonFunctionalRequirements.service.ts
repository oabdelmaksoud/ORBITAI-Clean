/**
 * Non-Functional Requirements Tracing Service
 * Links NFRs to performance tests, security audits, load tests, and monitoring dashboards
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { requirementsValidationService, ParsedRequirement } from './requirementsValidation.service.js';

export interface NFRTrace {
  requirementId: string;
  requirementTitle: string;
  nfrCategory: 'performance' | 'security' | 'scalability' | 'reliability' | 'usability' | 'maintainability' | 'compatibility';
  linkedArtifacts: {
    performanceTests: string[]; // Artifact IDs
    securityAudits: string[]; // Artifact IDs
    loadTests: string[]; // Artifact IDs
    monitoringDashboards: string[]; // Artifact IDs
    complianceReports: string[]; // Artifact IDs
  };
  metrics: {
    target?: string;
    actual?: string;
    unit?: string;
    status: 'met' | 'not_met' | 'unknown';
  };
  complianceStatus: 'compliant' | 'non-compliant' | 'partial' | 'unknown';
}

export interface NFRTraceReport {
  projectId: string;
  totalNFRs: number;
  nfrTraces: NFRTrace[];
  coverage: {
    performance: number; // Percentage
    security: number;
    scalability: number;
    reliability: number;
    usability: number;
    maintainability: number;
    compatibility: number;
  };
  gaps: Array<{
    requirementId: string;
    category: string;
    missingArtifactTypes: string[];
    severity: 'high' | 'medium' | 'low';
  }>;
  generatedAt: Date;
}

class NonFunctionalRequirementsService {
  /**
   * Extract and trace non-functional requirements
   */
  async traceNFRs(projectId: string): Promise<NFRTraceReport> {
    try {
      logger.info(`Tracing non-functional requirements for project ${projectId}`);

      // Get all requirements
      const reqArtifacts = await Artifact.find({
        projectId,
        type: 'requirement'
      }).lean() as any;

      if (reqArtifacts.length === 0) {
        return {
          projectId,
          totalNFRs: 0,
          nfrTraces: [],
          coverage: {
            performance: 0,
            security: 0,
            scalability: 0,
            reliability: 0,
            usability: 0,
            maintainability: 0,
            compatibility: 0
          },
          gaps: [],
          generatedAt: new Date()
        };
      }

      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);
      const allArtifacts = await Artifact.find({ projectId }).lean() as any;

      // Filter NFRs
      const nfrs = requirements.filter(req => 
        req.type === 'non-functional' || 
        this.isNFR(req.description)
      );

      // Categorize NFRs
      const categorizedNFRs = nfrs.map(req => ({
        ...req,
        nfrCategory: this.categorizeNFR(req.description),
        nfrMetrics: this.extractNFRMetrics(req.description)
      }));

      // Trace each NFR
      const nfrTraces: NFRTrace[] = [];

      for (const nfr of categorizedNFRs) {
        const trace = await this.traceNFR(nfr, allArtifacts);
        nfrTraces.push(trace);
      }

      // Calculate coverage
      const coverage = this.calculateCoverage(nfrTraces);

      // Identify gaps
      const gaps = this.identifyGaps(nfrTraces);

      return {
        projectId,
        totalNFRs: nfrTraces.length,
        nfrTraces,
        coverage,
        gaps,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to trace NFRs:', error);
      throw error;
    }
  }

  /**
   * Check if a requirement is an NFR
   */
  private isNFR(description: string): boolean {
    const nfrKeywords = [
      'performance', 'response time', 'throughput', 'latency',
      'security', 'authentication', 'authorization', 'encryption',
      'scalability', 'scalable', 'scale',
      'reliability', 'availability', 'uptime', 'downtime',
      'usability', 'user experience', 'ux', 'accessibility',
      'maintainability', 'maintainable', 'code quality',
      'compatibility', 'browser', 'platform', 'device'
    ];

    const descLower = description.toLowerCase();
    return nfrKeywords.some(keyword => descLower.includes(keyword));
  }

  /**
   * Categorize NFR
   */
  private categorizeNFR(description: string): NFRTrace['nfrCategory'] {
    const descLower = description.toLowerCase();

    if (descLower.includes('performance') || descLower.includes('response time') || 
        descLower.includes('throughput') || descLower.includes('latency')) {
      return 'performance';
    }
    if (descLower.includes('security') || descLower.includes('authentication') || 
        descLower.includes('authorization') || descLower.includes('encryption')) {
      return 'security';
    }
    if (descLower.includes('scalability') || descLower.includes('scale')) {
      return 'scalability';
    }
    if (descLower.includes('reliability') || descLower.includes('availability') || 
        descLower.includes('uptime') || descLower.includes('downtime')) {
      return 'reliability';
    }
    if (descLower.includes('usability') || descLower.includes('user experience') || 
        descLower.includes('ux') || descLower.includes('accessibility')) {
      return 'usability';
    }
    if (descLower.includes('maintainability') || descLower.includes('maintainable') || 
        descLower.includes('code quality')) {
      return 'maintainability';
    }
    if (descLower.includes('compatibility') || descLower.includes('browser') || 
        descLower.includes('platform') || descLower.includes('device')) {
      return 'compatibility';
    }

    return 'performance'; // Default
  }

  /**
   * Extract NFR metrics from description
   */
  private extractNFRMetrics(description: string): ParsedRequirement['nfrMetrics'] {
    // Pattern: "response time < 200ms", "throughput > 1000 req/s", etc.
    const patterns = [
      /(?:response time|latency|delay)\s*[<≤]?\s*(\d+(?:\.\d+)?)\s*(ms|s|seconds?|milliseconds?)/i,
      /(?:throughput|requests? per second|rps)\s*[>≥]?\s*(\d+(?:\.\d+)?)\s*(req\/s|requests?\/s|rps)/i,
      /(?:availability|uptime)\s*[>≥]?\s*(\d+(?:\.\d+)?)\s*(%|percent)/i,
      /(?:cpu|memory|storage)\s*[<≤]?\s*(\d+(?:\.\d+)?)\s*(%|mb|gb|tb)/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return {
          target: match[1],
          unit: match[2] || 'unknown',
          actual: undefined
        };
      }
    }

    return undefined;
  }

  /**
   * Trace a single NFR to related artifacts
   */
  private async traceNFR(
    nfr: ParsedRequirement & { nfrCategory: NFRTrace['nfrCategory']; nfrMetrics?: ParsedRequirement['nfrMetrics'] },
    allArtifacts: IArtifact[]
  ): Promise<NFRTrace> {
    const performanceTests: string[] = [];
    const securityAudits: string[] = [];
    const loadTests: string[] = [];
    const monitoringDashboards: string[] = [];
    const complianceReports: string[] = [];

    // Find related artifacts based on category
    for (const artifact of allArtifacts) {
      const artifactContent = (artifact.content || '').toLowerCase();
      const artifactTitle = artifact.title.toLowerCase();
      const nfrId = nfr.id.toLowerCase();
      // const _nfrDesc = nfr.description.toLowerCase();

      // Check if artifact references this NFR
      const referencesNFR = artifactContent.includes(nfrId) ||
                           artifactTitle.includes(nfrId) ||
                           artifact.traceRefs?.some(ref => ref.toString() === nfr.sourceArtifactId);

      if (!referencesNFR) continue;

      // Categorize artifact
      if (artifact.type === 'test-plan' || artifact.type === 'audit-report') {
        if (artifactContent.includes('performance') || artifactContent.includes('load') || 
            artifactContent.includes('stress') || artifactContent.includes('benchmark')) {
          if (artifactContent.includes('load') || artifactContent.includes('stress')) {
            loadTests.push(artifact._id.toString());
          } else {
            performanceTests.push(artifact._id.toString());
          }
        }
        if (artifactContent.includes('security') || artifactContent.includes('vulnerability') || 
            artifactContent.includes('audit') || artifactContent.includes('penetration')) {
          securityAudits.push(artifact._id.toString());
        }
        if (artifactContent.includes('compliance') || artifactContent.includes('gdpr') || 
            artifactContent.includes('hipaa') || artifactContent.includes('iso')) {
          complianceReports.push(artifact._id.toString());
        }
      }

      // Check for monitoring dashboards (could be in metadata or content)
      if (artifactContent.includes('monitoring') || artifactContent.includes('dashboard') || 
          artifactContent.includes('metrics') || artifact.metadata?.deploymentUrl) {
        monitoringDashboards.push(artifact._id.toString());
      }
    }

    // Determine compliance status
    let complianceStatus: NFRTrace['complianceStatus'] = 'unknown';
    if (nfr.linkedTests.length > 0 || performanceTests.length > 0 || securityAudits.length > 0) {
      complianceStatus = 'compliant';
    } else if (nfr.linkedCode.length > 0) {
      complianceStatus = 'partial';
    } else {
      complianceStatus = 'non-compliant';
    }

    // Check metrics status
    let metricsStatus: 'met' | 'not_met' | 'unknown' = 'unknown';
    if (nfr.nfrMetrics?.target && nfr.nfrMetrics?.actual) {
      // Simple comparison (can be enhanced)
      const target = parseFloat(nfr.nfrMetrics.target);
      const actual = parseFloat(nfr.nfrMetrics.actual);
      if (!isNaN(target) && !isNaN(actual)) {
        metricsStatus = actual <= target ? 'met' : 'not_met';
      }
    }

    return {
      requirementId: nfr.id,
      requirementTitle: nfr.description.substring(0, 100),
      nfrCategory: nfr.nfrCategory,
      linkedArtifacts: {
        performanceTests,
        securityAudits,
        loadTests,
        monitoringDashboards,
        complianceReports
      },
      metrics: {
        target: nfr.nfrMetrics?.target,
        actual: nfr.nfrMetrics?.actual,
        unit: nfr.nfrMetrics?.unit,
        status: metricsStatus
      },
      complianceStatus
    };
  }

  /**
   * Calculate coverage by category
   */
  private calculateCoverage(nfrTraces: NFRTrace[]): NFRTraceReport['coverage'] {
    const coverage: NFRTraceReport['coverage'] = {
      performance: 0,
      security: 0,
      scalability: 0,
      reliability: 0,
      usability: 0,
      maintainability: 0,
      compatibility: 0
    };

    const categoryCounts = new Map<string, { total: number; traced: number }>();

    for (const trace of nfrTraces) {
      const category = trace.nfrCategory;
      if (!categoryCounts.has(category)) {
        categoryCounts.set(category, { total: 0, traced: 0 });
      }

      const counts = categoryCounts.get(category)!;
      counts.total++;

      // Consider traced if it has at least one linked artifact
      const hasLinks = 
        trace.linkedArtifacts.performanceTests.length > 0 ||
        trace.linkedArtifacts.securityAudits.length > 0 ||
        trace.linkedArtifacts.loadTests.length > 0 ||
        trace.linkedArtifacts.monitoringDashboards.length > 0 ||
        trace.linkedArtifacts.complianceReports.length > 0;

      if (hasLinks) {
        counts.traced++;
      }
    }

    // Calculate percentages
    for (const [category, counts] of categoryCounts.entries()) {
      if (counts.total > 0) {
        coverage[category as keyof typeof coverage] = Math.round((counts.traced / counts.total) * 100);
      }
    }

    return coverage;
  }

  /**
   * Identify gaps in NFR tracing
   */
  private identifyGaps(nfrTraces: NFRTrace[]): NFRTraceReport['gaps'] {
    const gaps: NFRTraceReport['gaps'] = [];

    for (const trace of nfrTraces) {
      const missingTypes: string[] = [];

      // Performance NFRs should have performance tests or load tests
      if (trace.nfrCategory === 'performance') {
        if (trace.linkedArtifacts.performanceTests.length === 0 && 
            trace.linkedArtifacts.loadTests.length === 0) {
          missingTypes.push('performance_tests');
        }
        if (trace.linkedArtifacts.monitoringDashboards.length === 0) {
          missingTypes.push('monitoring_dashboard');
        }
      }

      // Security NFRs should have security audits
      if (trace.nfrCategory === 'security') {
        if (trace.linkedArtifacts.securityAudits.length === 0) {
          missingTypes.push('security_audit');
        }
        if (trace.linkedArtifacts.complianceReports.length === 0) {
          missingTypes.push('compliance_report');
        }
      }

      // Scalability NFRs should have load tests
      if (trace.nfrCategory === 'scalability') {
        if (trace.linkedArtifacts.loadTests.length === 0) {
          missingTypes.push('load_tests');
        }
      }

      // Reliability NFRs should have monitoring
      if (trace.nfrCategory === 'reliability') {
        if (trace.linkedArtifacts.monitoringDashboards.length === 0) {
          missingTypes.push('monitoring_dashboard');
        }
      }

      if (missingTypes.length > 0) {
        const severity = trace.nfrCategory === 'security' || trace.nfrCategory === 'performance' 
          ? 'high' 
          : 'medium';
        
        gaps.push({
          requirementId: trace.requirementId,
          category: trace.nfrCategory,
          missingArtifactTypes: missingTypes,
          severity
        });
      }
    }

    return gaps;
  }
}

export const nonFunctionalRequirementsService = new NonFunctionalRequirementsService();



