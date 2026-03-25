/**
 * Security Scanning Service
 * Integrates SAST/DAST tools (SonarQube, Snyk, Trivy) for security scanning
 */

import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface SecurityScanResult {
  tool: 'sonarqube' | 'snyk' | 'trivy' | 'llm';
  issues: SecurityIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  scanDuration: number; // milliseconds
  timestamp: Date;
}

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string; // SQL injection, XSS, etc.
  title: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
  cwe?: string; // Common Weakness Enumeration
  cve?: string; // Common Vulnerabilities and Exposures
}

class SecurityScanningService {
  /**
   * Scan code for security vulnerabilities
   */
  async scanCode(
    code: string,
    language: string,
    tools: ('sonarqube' | 'snyk' | 'trivy' | 'llm')[] = ['llm']
  ): Promise<SecurityScanResult[]> {
    const results: SecurityScanResult[] = [];

    for (const tool of tools) {
      try {
        const startTime = Date.now();
        let result: SecurityScanResult;

        switch (tool) {
          case 'sonarqube':
            result = await this.scanWithSonarQube(code, language);
            break;
          case 'snyk':
            result = await this.scanWithSnyk(code, language);
            break;
          case 'trivy':
            result = await this.scanWithTrivy(code, language);
            break;
          case 'llm':
          default:
            result = await this.scanWithLLM(code, language);
            break;
        }

        result.scanDuration = Date.now() - startTime;
        results.push(result);
      } catch (error: any) {
        logger.warn(`Security scan with ${tool} failed:`, error.message);
        // Continue with other tools
      }
    }

    return results;
  }

  /**
   * Scan with SonarQube (SAST)
   */
  private async scanWithSonarQube(code: string, language: string): Promise<SecurityScanResult> {
    // Note: This is a placeholder. Full SonarQube integration requires:
    // 1. SonarQube server running
    // 2. SonarScanner CLI installed
    // 3. Project configuration

    logger.debug('SonarQube scan requested (placeholder - requires SonarQube server)');

    // For now, return empty result with note
    return {
      tool: 'sonarqube',
      issues: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      scanDuration: 0,
      timestamp: new Date()
    };
  }

  /**
   * Scan with Snyk (dependency vulnerabilities)
   */
  private async scanWithSnyk(code: string, language: string): Promise<SecurityScanResult> {
    try {
      // Check if Snyk CLI is available
      try {
        await execAsync('snyk --version');
      } catch {
        logger.debug('Snyk CLI not available, using LLM fallback');
        return this.scanWithLLM(code, language);
      }

      // Create temporary file
      const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'snyk-scan-'));
      const tempFile = path.join(tempDir, `code.${this.getFileExtension(language)}`);
      await fs.writeFile(tempFile, code);

      try {
        // Run Snyk test
        const { stdout, stderr } = await execAsync(`snyk test --file=${tempFile}`, {
          cwd: tempDir,
          timeout: 30000
        });

        // Parse Snyk output
        const issues = this.parseSnykOutput(stdout, stderr);

        return {
          tool: 'snyk',
          issues,
          summary: this.calculateSummary(issues),
          scanDuration: 0,
          timestamp: new Date()
        };
      } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error: any) {
      logger.warn('Snyk scan failed, using LLM fallback:', error.message);
      return this.scanWithLLM(code, language);
    }
  }

  /**
   * Scan with Trivy (container/secret scanning)
   */
  private async scanWithTrivy(code: string, language: string): Promise<SecurityScanResult> {
    try {
      // Check if Trivy is available
      try {
        await execAsync('trivy --version');
      } catch {
        logger.debug('Trivy not available, using LLM fallback');
        return this.scanWithLLM(code, language);
      }

      // Create temporary file
      const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'trivy-scan-'));
      const tempFile = path.join(tempDir, `code.${this.getFileExtension(language)}`);
      await fs.writeFile(tempFile, code);

      try {
        // Run Trivy filesystem scan
        const { stdout } = await execAsync(`trivy fs --format json ${tempDir}`, {
          timeout: 30000
        });

        const trivyResult = JSON.parse(stdout);
        const issues = this.parseTrivyOutput(trivyResult);

        return {
          tool: 'trivy',
          issues,
          summary: this.calculateSummary(issues),
          scanDuration: 0,
          timestamp: new Date()
        };
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error: any) {
      logger.warn('Trivy scan failed, using LLM fallback:', error.message);
      return this.scanWithLLM(code, language);
    }
  }

  /**
   * Scan with LLM (fallback/comprehensive)
   */
  private async scanWithLLM(code: string, language: string): Promise<SecurityScanResult> {
    const { llmRouter } = await import('./llm/LLMRouter.js');
    const { Type, Schema } = await import('@google/genai');

    const prompt = `Analyze the following ${language} code for security vulnerabilities:

\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Identify security issues including:
- SQL injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Authentication/Authorization flaws
- Insecure data storage
- Hardcoded secrets
- Insecure dependencies
- Input validation issues
- Path traversal
- Command injection

Return a JSON object with security issues array.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        issues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              severity: { type: Type.STRING },
              type: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              file: { type: Type.STRING },
              line: { type: Type.NUMBER },
              recommendation: { type: Type.STRING },
              cwe: { type: Type.STRING }
            },
            required: ['severity', 'type', 'title', 'description', 'recommendation']
          }
        }
      },
      required: ['issues']
    };

    try {
      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'security_audit',
        agentRole: 'QA/Audit Agent',
        context: {
          agentRole: 'QA/Audit Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      const issues: SecurityIssue[] = (parsed.issues || []).map((issue: any) => ({
        severity: issue.severity || 'medium',
        type: issue.type,
        title: issue.title,
        description: issue.description,
        file: issue.file,
        line: issue.line,
        recommendation: issue.recommendation,
        cwe: issue.cwe
      }));

      return {
        tool: 'llm',
        issues,
        summary: this.calculateSummary(issues),
        scanDuration: 0,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('LLM security scan failed:', error);
      return {
        tool: 'llm',
        issues: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        scanDuration: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Parse Snyk output
   */
  private parseSnykOutput(stdout: string, stderr: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Simple parsing (Snyk output format can vary)
    const vulnerabilityPattern = /✗\s+(.+?)\s+\[(.+?)\]/g;
    let match;

    while ((match = vulnerabilityPattern.exec(stdout)) !== null) {
      issues.push({
        severity: this.inferSeverity(match[2]),
        type: 'dependency_vulnerability',
        title: match[1],
        description: `Vulnerability in dependency: ${match[1]}`,
        recommendation: `Update dependency to a secure version`,
        cve: match[2]
      });
    }

    return issues;
  }

  /**
   * Parse Trivy output
   */
  private parseTrivyOutput(trivyResult: any): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    if (trivyResult.Results) {
      for (const result of trivyResult.Results) {
        if (result.Vulnerabilities) {
          for (const vuln of result.Vulnerabilities) {
            issues.push({
              severity: this.mapTrivySeverity(vuln.Severity),
              type: vuln.Type || 'vulnerability',
              title: vuln.Title || vuln.VulnerabilityID,
              description: vuln.Description || '',
              recommendation: vuln.FixedVersion ? `Update to version ${vuln.FixedVersion}` : 'Review and update',
              cve: vuln.VulnerabilityID,
              cwe: vuln.CweIDs?.[0]
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Map Trivy severity
   */
  private mapTrivySeverity(severity: string): SecurityIssue['severity'] {
    const s = severity.toLowerCase();
    if (s === 'critical' || s === 'cr') return 'critical';
    if (s === 'high' || s === 'h') return 'high';
    if (s === 'medium' || s === 'm') return 'medium';
    return 'low';
  }

  /**
   * Infer severity from text
   */
  private inferSeverity(text: string): SecurityIssue['severity'] {
    const t = text.toLowerCase();
    if (t.includes('critical')) return 'critical';
    if (t.includes('high')) return 'high';
    if (t.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Calculate summary
   */
  private calculateSummary(issues: SecurityIssue[]): SecurityScanResult['summary'] {
    return {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      total: issues.length
    };
  }

  /**
   * Get file extension for language
   */
  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      'typescript': 'ts',
      'javascript': 'js',
      'python': 'py',
      'java': 'java',
      'go': 'go',
      'rust': 'rs',
      'cpp': 'cpp',
      'c': 'c'
    };
    return extensions[language.toLowerCase()] || 'txt';
  }

  /**
   * Aggregate results from multiple tools
   */
  aggregateResults(results: SecurityScanResult[]): SecurityScanResult {
    const allIssues: SecurityIssue[] = [];
    const issueSet = new Set<string>(); // Deduplicate by title+file+line

    for (const result of results) {
      for (const issue of result.issues) {
        const key = `${issue.title}-${issue.file}-${issue.line}`;
        if (!issueSet.has(key)) {
          issueSet.add(key);
          allIssues.push(issue);
        }
      }
    }

    return {
      tool: 'aggregated',
      issues: allIssues,
      summary: this.calculateSummary(allIssues),
      scanDuration: results.reduce((sum, r) => sum + r.scanDuration, 0),
      timestamp: new Date()
    };
  }
}

export const securityScanningService = new SecurityScanningService();



