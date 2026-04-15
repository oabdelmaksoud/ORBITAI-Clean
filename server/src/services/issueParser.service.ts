/**
 * Issue Parser Service
 * Parses agent output to detect issues and extract them for task creation
 */

import { logger } from '../utils/logger.js';
type AgentRoleType = string;
import { DetectedIssue } from './issueTaskCreation.service.js';

class IssueParserService {
  /**
   * Parse agent output for detected issues
   * Looks for structured issue reports in agent output
   */
  parseIssuesFromOutput(
    output: string,
    agentRole: AgentRoleType,
    artifactId?: string
  ): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    // Return empty array if output is not a string or is empty
    if (!output || typeof output !== 'string' || output.trim().length === 0) {
      return issues;
    }

    try {
      // Pattern 1: Structured JSON issues block
      const jsonMatch = output.match(/<!-- ISSUES_START -->\s*([\s\S]*?)\s*<!-- ISSUES_END -->/);
      if (jsonMatch) {
        try {
          const issuesData = JSON.parse(jsonMatch[1]);
          if (Array.isArray(issuesData)) {
            for (const issueData of issuesData) {
              issues.push(this.normalizeIssue(issueData, agentRole, artifactId));
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse structured issues JSON:', parseError);
        }
      }

      // Pattern 2: Markdown issue list
      const markdownIssues = this.parseMarkdownIssues(output, agentRole, artifactId);
      issues.push(...markdownIssues);

      // Pattern 3: Security vulnerability mentions
      const securityIssues = this.parseSecurityIssues(output, agentRole, artifactId);
      issues.push(...securityIssues);

      // Pattern 4: Performance issue mentions
      const performanceIssues = this.parsePerformanceIssues(output, agentRole, artifactId);
      issues.push(...performanceIssues);

      // Pattern 5: Bug mentions
      const bugIssues = this.parseBugIssues(output, agentRole, artifactId);
      issues.push(...bugIssues);

      // Pattern 6: Best practice violations
      const qualityIssues = this.parseQualityIssues(output, agentRole, artifactId);
      issues.push(...qualityIssues);

      // Remove duplicates
      return this.deduplicateIssues(issues);
    } catch (error: unknown) {
      logger.error('Failed to parse issues from output:', error);
      return [];
    }
  }

  /**
   * Parse markdown-formatted issues
   */
  private parseMarkdownIssues(
    output: string,
    agentRole: AgentRoleType,
    artifactId?: string
  ): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    // Pattern: ## Issues or ### Issues or **Issues:**
    const issuesSection = output.match(
      /(?:##|###|\*\*)\s*Issues?[:\s]*\n([\s\S]*?)(?=\n##|\n###|\n\*\*|$)/i
    );
    if (issuesSection) {
      const issuesText = issuesSection[1];
      const lines = issuesText.split('\n').filter(line => line.trim());

      for (const line of lines) {
        // Pattern: - [Severity] Issue description
        const match = line.match(/[-*]\s*\[?(critical|high|medium|low)\]?\s*[:\-]?\s*(.+)/i);
        if (match) {
          const severity = match[1].toLowerCase() as any;
          const description = match[2].trim();

          // Determine issue type from description
          const type = this.detectIssueType(description);

          issues.push({
            type,
            severity,
            title: this.extractTitle(description),
            description,
            agentRole,
            artifactId,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Parse security issues
   */
  private parseSecurityIssues(
    output: string,
    agentRole: AgentRoleType,
    artifactId?: string
  ): DetectedIssue[] {
    const issues: DetectedIssue[] = [];
    const securityKeywords = [
      'sql injection',
      'xss',
      'csrf',
      'authentication',
      'authorization',
      'sensitive data',
      'insecure',
      'vulnerability',
      'security flaw',
      'password',
      'token',
      'session',
      'encryption',
    ];

    const securityPattern = new RegExp(
      `(${securityKeywords.join('|')})[^.!?]*(?:critical|high|medium|low|vulnerability|flaw|issue)`,
      'gi'
    );

    const matches = output.matchAll(securityPattern);
    for (const match of matches) {
      const context = this.getContextAroundMatch(output, match.index || 0, 200);
      const severity = this.extractSeverity(context);

      issues.push({
        type: 'security',
        severity: severity || 'high',
        title: `Security: ${this.extractTitle(match[0])}`,
        description: context,
        agentRole,
        artifactId,
      });
    }

    return issues;
  }

  /**
   * Parse performance issues
   */
  private parsePerformanceIssues(
    output: string,
    agentRole: AgentRoleType,
    artifactId?: string
  ): DetectedIssue[] {
    const issues: DetectedIssue[] = [];
    const performanceKeywords = [
      'slow',
      'bottleneck',
      'performance',
      'optimization',
      'memory leak',
      'inefficient',
      'timeout',
      'latency',
    ];

    const performancePattern = new RegExp(
      `(${performanceKeywords.join('|')})[^.!?]*(?:issue|problem|bottleneck|slow|optimize)`,
      'gi'
    );

    const matches = output.matchAll(performancePattern);
    for (const match of matches) {
      const context = this.getContextAroundMatch(output, match.index || 0, 200);
      const severity = this.extractSeverity(context) || 'medium';

      issues.push({
        type: 'performance',
        severity,
        title: `Performance: ${this.extractTitle(match[0])}`,
        description: context,
        agentRole,
        artifactId,
      });
    }

    return issues;
  }

  /**
   * Parse bug mentions
   */
  private parseBugIssues(
    output: string,
    agentRole: AgentRoleType,
    artifactId?: string
  ): DetectedIssue[] {
    const issues: DetectedIssue[] = [];
    const bugPattern =
      /(?:bug|error|exception|crash|fails?|broken)[^.!?]*(?:in|at|line|file)[^.!?]*/gi;

    const matches = output.matchAll(bugPattern);
    for (const match of matches) {
      const context = this.getContextAroundMatch(output, match.index || 0, 200);
      const severity = this.extractSeverity(context) || 'medium';
      const location = this.extractLocation(context);

      issues.push({
        type: 'bug',
        severity,
        title: `Bug: ${this.extractTitle(match[0])}`,
        description: context,
        location,
        agentRole,
        artifactId,
      });
    }

    return issues;
  }

  /**
   * Parse quality/best practice issues
   */
  private parseQualityIssues(
    output: string,
    agentRole: AgentRoleType,
    artifactId?: string
  ): DetectedIssue[] {
    const issues: DetectedIssue[] = [];
    const qualityKeywords = [
      'violates',
      'does not follow',
      'missing',
      'should use',
      'SOLID',
      'DRY',
      'KISS',
      'best practice',
      'code smell',
    ];

    const qualityPattern = new RegExp(
      `(${qualityKeywords.join('|')})[^.!?]*(?:principle|practice|pattern|guideline)`,
      'gi'
    );

    const matches = output.matchAll(qualityPattern);
    for (const match of matches) {
      const context = this.getContextAroundMatch(output, match.index || 0, 200);

      issues.push({
        type: 'best-practice',
        severity: 'medium',
        title: `Code Quality: ${this.extractTitle(match[0])}`,
        description: context,
        agentRole,
        artifactId,
      });
    }

    return issues;
  }

  /**
   * Normalize issue data
   */
  private normalizeIssue(
    issueData: any,
    agentRole: AgentRoleType,
    artifactId?: string
  ): DetectedIssue {
    return {
      type: issueData.type || 'quality',
      severity: issueData.severity || 'medium',
      title: issueData.title || 'Issue detected',
      description: issueData.description || '',
      location: issueData.location,
      recommendation: issueData.recommendation,
      agentRole: issueData.agentRole || agentRole,
      artifactId: issueData.artifactId || artifactId,
      relatedTaskId: issueData.relatedTaskId,
    };
  }

  /**
   * Detect issue type from description
   */
  private detectIssueType(description: string): DetectedIssue['type'] {
    const lower = description.toLowerCase();

    if (
      lower.includes('security') ||
      lower.includes('vulnerability') ||
      lower.includes('injection') ||
      lower.includes('xss') ||
      lower.includes('csrf')
    ) {
      return 'security';
    }
    if (
      lower.includes('performance') ||
      lower.includes('slow') ||
      lower.includes('bottleneck') ||
      lower.includes('optimize')
    ) {
      return 'performance';
    }
    if (lower.includes('bug') || lower.includes('error') || lower.includes('fails')) {
      return 'bug';
    }
    if (lower.includes('requirement') || lower.includes('missing')) {
      return 'requirement';
    }
    if (lower.includes('compliance') || lower.includes('standard')) {
      return 'compliance';
    }
    if (
      lower.includes('quality') ||
      lower.includes('best practice') ||
      lower.includes('SOLID') ||
      lower.includes('DRY')
    ) {
      return 'best-practice';
    }

    return 'quality';
  }

  /**
   * Extract severity from text
   */
  private extractSeverity(text: string): 'critical' | 'high' | 'medium' | 'low' | undefined {
    const lower = text.toLowerCase();
    if (lower.includes('critical') || lower.includes('urgent')) return 'critical';
    if (lower.includes('high') || lower.includes('severe')) return 'high';
    if (lower.includes('low') || lower.includes('minor')) return 'low';
    if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
    return undefined;
  }

  /**
   * Extract title from description
   */
  private extractTitle(description: string): string {
    // Take first sentence or first 60 characters
    const firstSentence = description.split(/[.!?]/)[0].trim();
    if (firstSentence.length <= 60) {
      return firstSentence;
    }
    return description.substring(0, 57) + '...';
  }

  /**
   * Extract location from text
   */
  private extractLocation(text: string): string | undefined {
    const locationPattern = /(?:in|at|file|line)\s+([^\s,]+(?:\.[a-z]+)?(?::\d+)?)/i;
    const match = text.match(locationPattern);
    return match ? match[1] : undefined;
  }

  /**
   * Get context around a match
   */
  private getContextAroundMatch(text: string, index: number, length: number): string {
    const start = Math.max(0, index - length / 2);
    const end = Math.min(text.length, index + length / 2);
    return text.substring(start, end).trim();
  }

  /**
   * Remove duplicate issues
   */
  private deduplicateIssues(issues: DetectedIssue[]): DetectedIssue[] {
    const seen = new Set<string>();
    const unique: DetectedIssue[] = [];

    for (const issue of issues) {
      const key = `${issue.type}:${issue.title.toLowerCase()}:${issue.location || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(issue);
      }
    }

    return unique;
  }
}

export const issueParserService = new IssueParserService();
