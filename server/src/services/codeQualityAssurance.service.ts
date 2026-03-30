/**
 * Code Quality Assurance Service
 * Provides multi-stage code review, best practices checking, and quality scoring
 * for agency-quality code generation
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';
import { issueTaskCreationService } from './issueTaskCreation.service.js';
import { architectureValidationService } from './architectureValidation.service.js';
import { securityScanningService } from './securityScanning.service.js';

export interface CodeReviewResult {
  overallScore: number; // 0-100
  bestPractices: BestPracticeCheck[];
  securityIssues: SecurityIssue[];
  performanceMetrics: PerformanceMetrics;
  codeStyle: CodeStyleIssues;
  suggestions: string[];
  reasoning: string;
  timestamp: number;
}

export interface BestPracticeCheck {
  principle: string; // SOLID, DRY, KISS, etc.
  status: 'pass' | 'warning' | 'fail';
  description: string;
  location?: string; // File/line reference if applicable
}

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string; // SQL injection, XSS, etc.
  description: string;
  location?: string;
  recommendation: string;
}

export interface PerformanceMetrics {
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  estimatedComplexity: number; // Cyclomatic complexity estimate
  potentialBottlenecks: string[];
  optimizationSuggestions: string[];
}

export interface CodeStyleIssues {
  consistency: 'good' | 'needs-improvement' | 'poor';
  formatting: string[];
  naming: string[];
  structure: string[];
}

class CodeQualityAssuranceService {
  /**
   * Comprehensive code review with multi-stage analysis
   */
  async reviewCode(
    code: string,
    language: string,
    context?: {
      projectType?: string;
      standards?: string[];
      framework?: string;
      projectId?: string;
      userId?: string;
      artifactId?: string;
    }
  ): Promise<CodeReviewResult> {
    try {
      logger.info(`Starting code review for ${language} code (${code.length} chars)`);

      // Stage 1: Best Practices Check
      const bestPractices = await this.checkBestPractices(code, language, context);

      // Stage 2: Security Scan (enhanced with SAST/DAST tools)
      let securityIssues = await this.scanSecurity(code, language, context);
      
      // Also run external security tools if available
      try {
        const externalScans = await securityScanningService.scanCode(
          code,
          language,
          ['snyk', 'trivy', 'llm'] // Try Snyk, Trivy, fallback to LLM
        );
        
        if (externalScans.length > 0) {
          const aggregated = securityScanningService.aggregateResults(externalScans);
          // Merge with existing issues
          securityIssues = [...securityIssues, ...aggregated.issues];
        }
      } catch (error: any) {
        logger.debug('External security tools not available, using LLM only:', error.message);
      }

      // Stage 3: Performance Analysis
      const performanceMetrics = await this.assessPerformance(code, language);

      // Stage 4: Code Style Check
      const codeStyle = await this.checkCodeStyle(code, language);

      // Stage 5: Architecture Validation (if pattern specified)
      let architectureValidation = null;
      if (context?.framework) {
        const pattern = this.inferArchitecturePattern(context.framework);
        if (pattern) {
          architectureValidation = await architectureValidationService.validateArchitecturePattern(
            code,
            language,
            pattern
          );
        }
      }

      // Calculate overall score
      const overallScore = this.calculateQualityScore({
        bestPractices,
        securityIssues,
        performanceMetrics,
        codeStyle,
        architectureValidation
      });

      // Generate suggestions
      const suggestions = this.generateSuggestions({
        bestPractices,
        securityIssues,
        performanceMetrics,
        codeStyle,
        architectureValidation
      });

      const result: CodeReviewResult = {
        overallScore,
        bestPractices,
        securityIssues,
        performanceMetrics,
        codeStyle,
        suggestions,
        reasoning: this.generateReasoning(overallScore, bestPractices, securityIssues),
        timestamp: Date.now()
      };

      logger.info(`Code review complete. Score: ${overallScore}/100`);
      
      // Auto-create tasks for critical/high severity issues
      // This happens asynchronously and doesn't block the review result
      this.createTasksForIssuesAsync(result, context?.projectId, context?.userId, context?.artifactId);
      
      return result;
    } catch (error: any) {
      logger.error('Code review failed:', error);
      // Return safe defaults
      return {
        overallScore: 50,
        bestPractices: [],
        securityIssues: [],
        performanceMetrics: {
          complexity: 'medium',
          estimatedComplexity: 0,
          potentialBottlenecks: [],
          optimizationSuggestions: []
        },
        codeStyle: {
          consistency: 'needs-improvement',
          formatting: [],
          naming: [],
          structure: []
        },
        suggestions: ['Code review failed. Please review manually.'],
        reasoning: `Code review encountered an error: ${error.message}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check code against best practices (SOLID, DRY, KISS, etc.)
   */
  async checkBestPractices(
    code: string,
    language: string,
    context?: {
      projectType?: string;
      standards?: string[];
      framework?: string;
    }
  ): Promise<BestPracticeCheck[]> {
    try {
      const prompt = `Review the following ${language} code for best practices compliance.

Code:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Context:
- Project Type: ${context?.projectType || 'Not specified'}
- Framework: ${context?.framework || 'Not specified'}
- Standards: ${context?.standards?.join(', ') || 'None'}

Check against these principles:
1. **SOLID Principles**
   - Single Responsibility: Each function/class has one clear purpose
   - Open/Closed: Open for extension, closed for modification
   - Liskov Substitution: Subtypes must be substitutable
   - Interface Segregation: Many specific interfaces vs one general
   - Dependency Inversion: Depend on abstractions, not concretions

2. **DRY (Don't Repeat Yourself)**
   - No code duplication
   - Reusable functions/components

3. **KISS (Keep It Simple, Stupid)**
   - Simple, straightforward solutions
   - Avoid over-engineering

4. **YAGNI (You Aren't Gonna Need It)**
   - No unnecessary features
   - Focus on current requirements

5. **Clean Code Principles**
   - Meaningful names
   - Small functions
   - Clear comments
   - Error handling

For each principle, provide:
- Status: pass, warning, or fail
- Description: What was found
- Location: File/line if applicable

Return as JSON array.`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          checks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                principle: { type: Type.STRING },
                status: { type: Type.STRING, enum: ['pass', 'warning', 'fail'] },
                description: { type: Type.STRING },
                location: { type: Type.STRING }
              },
              required: ['principle', 'status', 'description']
            }
          }
        },
        required: ['checks']
      };

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'code_review',
        agentRole: 'QA/Audit Agent',
        context: {
          agentRole: 'QA/Audit Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return parsed.checks || [];
    } catch (error: any) {
      logger.error('Best practices check failed:', error);
      return [];
    }
  }

  /**
   * Scan code for security vulnerabilities
   */
  async scanSecurity(
    code: string,
    language: string,
    context?: {
      projectType?: string;
      standards?: string[];
      framework?: string;
    }
  ): Promise<SecurityIssue[]> {
    try {
      const prompt = `Scan the following ${language} code for security vulnerabilities.

Code:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Context:
- Project Type: ${context?.projectType || 'Not specified'}
- Framework: ${context?.framework || 'Not specified'}

Check for common vulnerabilities:
1. **Injection Attacks** (SQL, NoSQL, Command, LDAP)
2. **Cross-Site Scripting (XSS)**
3. **Cross-Site Request Forgery (CSRF)**
4. **Authentication/Authorization Issues**
5. **Sensitive Data Exposure**
6. **Insecure Dependencies**
7. **Insufficient Logging**
8. **Insecure Deserialization**
9. **Using Components with Known Vulnerabilities**
10. **Insufficient Security Headers**

For each issue found, provide:
- Severity: critical, high, medium, or low
- Type: Vulnerability type
- Description: What was found
- Location: File/line if applicable
- Recommendation: How to fix

Return as JSON array.`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          issues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                severity: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                location: { type: Type.STRING },
                recommendation: { type: Type.STRING }
              },
              required: ['severity', 'type', 'description', 'recommendation']
            }
          }
        },
        required: ['issues']
      };

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
      return parsed.issues || [];
    } catch (error: any) {
      logger.error('Security scan failed:', error);
      return [];
    }
  }

  /**
   * Assess code performance
   */
  async assessPerformance(
    code: string,
    language: string
  ): Promise<PerformanceMetrics> {
    try {
      const prompt = `Analyze the performance characteristics of the following ${language} code.

Code:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Assess:
1. **Complexity**: Estimate cyclomatic complexity (low, medium, high, very-high)
2. **Potential Bottlenecks**: Identify performance issues
   - Nested loops
   - Inefficient algorithms
   - Memory leaks
   - Blocking operations
   - Database query issues
3. **Optimization Suggestions**: Provide specific recommendations

Return as JSON object.`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          complexity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'very-high'] },
          estimatedComplexity: { type: Type.NUMBER },
          potentialBottlenecks: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          optimizationSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ['complexity', 'potentialBottlenecks', 'optimizationSuggestions']
      };

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'performance_analysis',
        agentRole: 'QA/Audit Agent',
        context: {
          agentRole: 'QA/Audit Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return {
        complexity: parsed.complexity || 'medium',
        estimatedComplexity: parsed.estimatedComplexity || 0,
        potentialBottlenecks: parsed.potentialBottlenecks || [],
        optimizationSuggestions: parsed.optimizationSuggestions || []
      };
    } catch (error: any) {
      logger.error('Performance assessment failed:', error);
      return {
        complexity: 'medium',
        estimatedComplexity: 0,
        potentialBottlenecks: [],
        optimizationSuggestions: []
      };
    }
  }

  /**
   * Check code style and consistency
   */
  async checkCodeStyle(
    code: string,
    language: string
  ): Promise<CodeStyleIssues> {
    try {
      const prompt = `Review the code style and consistency of the following ${language} code.

Code:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Check:
1. **Consistency**: Are naming conventions, formatting, and structure consistent?
2. **Formatting Issues**: Indentation, spacing, line length
3. **Naming Issues**: Variable/function/class naming conventions
4. **Structure Issues**: File organization, module structure

Return as JSON object.`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          consistency: { type: Type.STRING, enum: ['good', 'needs-improvement', 'poor'] },
          formatting: { type: Type.ARRAY, items: { type: Type.STRING } },
          naming: { type: Type.ARRAY, items: { type: Type.STRING } },
          structure: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['consistency', 'formatting', 'naming', 'structure']
      };

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'code_style',
        agentRole: 'QA/Audit Agent',
        context: {
          agentRole: 'QA/Audit Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return {
        consistency: parsed.consistency || 'needs-improvement',
        formatting: parsed.formatting || [],
        naming: parsed.naming || [],
        structure: parsed.structure || []
      };
    } catch (error: any) {
      logger.error('Code style check failed:', error);
      return {
        consistency: 'needs-improvement',
        formatting: [],
        naming: [],
        structure: []
      };
    }
  }

  /**
   * Calculate overall quality score (0-100)
   */
  private calculateQualityScore(review: {
    bestPractices: BestPracticeCheck[];
    securityIssues: SecurityIssue[];
    performanceMetrics: PerformanceMetrics;
    codeStyle: CodeStyleIssues;
    architectureValidation?: any;
  }): number {
    let score = 100;

    // Deduct for best practice violations
    review.bestPractices.forEach(check => {
      if (check.status === 'fail') score -= 10;
      else if (check.status === 'warning') score -= 5;
    });

    // Deduct for security issues (weighted by severity)
    review.securityIssues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': score -= 20; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    });

    // Consider architecture validation score
    if (review.architectureValidation) {
      const archScore = review.architectureValidation.overallScore;
      score = (score * 0.8) + (archScore * 0.2); // 20% weight for architecture
    }

    // Deduct for performance issues
    if (review.performanceMetrics.complexity === 'very-high') score -= 10;
    else if (review.performanceMetrics.complexity === 'high') score -= 5;
    if (review.performanceMetrics.potentialBottlenecks.length > 0) {
      score -= review.performanceMetrics.potentialBottlenecks.length * 2;
    }

    // Deduct for code style issues
    if (review.codeStyle.consistency === 'poor') score -= 10;
    else if (review.codeStyle.consistency === 'needs-improvement') score -= 5;
    score -= Math.min(review.codeStyle.formatting.length * 1, 5);
    score -= Math.min(review.codeStyle.naming.length * 1, 5);

    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate actionable suggestions
   */
  private generateSuggestions(review: {
    bestPractices: BestPracticeCheck[];
    securityIssues: SecurityIssue[];
    performanceMetrics: PerformanceMetrics;
    codeStyle: CodeStyleIssues;
    architectureValidation?: any;
  }): string[] {
    const suggestions: string[] = [];

    // Best practice suggestions
    review.bestPractices
      .filter(check => check.status !== 'pass')
      .forEach(check => {
        suggestions.push(`${check.principle}: ${check.description}`);
      });

    // Security suggestions
    review.securityIssues.forEach(issue => {
      suggestions.push(`[${issue.severity.toUpperCase()}] ${issue.type}: ${issue.recommendation}`);
    });

    // Performance suggestions
    review.performanceMetrics.optimizationSuggestions.forEach(suggestion => {
      suggestions.push(`Performance: ${suggestion}`);
    });

    // Code style suggestions
    if (review.codeStyle.consistency !== 'good') {
      suggestions.push(`Code style consistency needs improvement`);
    }
    review.codeStyle.formatting.forEach(issue => {
      suggestions.push(`Formatting: ${issue}`);
    });
    review.codeStyle.naming.forEach(issue => {
      suggestions.push(`Naming: ${issue}`);
    });

    // Architecture validation suggestions
    if (review.architectureValidation) {
      review.architectureValidation.violations.forEach(violation => {
        suggestions.push(`[${violation.severity.toUpperCase()}] ${violation.principle}: ${violation.description}`);
      });
    }

    return suggestions;
  }

  /**
   * Infer architecture pattern from framework
   */
  private inferArchitecturePattern(framework: string): import('./architectureValidation.service.js').ArchitecturalPattern | null {
    const fw = framework.toLowerCase();
    if (fw.includes('express') || fw.includes('django') || fw.includes('rails')) return 'mvc';
    if (fw.includes('microservice') || fw.includes('service')) return 'microservices';
    if (fw.includes('clean') || fw.includes('hexagonal')) return 'clean-architecture';
    if (fw.includes('event') || fw.includes('kafka') || fw.includes('rabbitmq')) return 'event-driven';
    return null;
  }

  /**
   * Generate reasoning for the quality score
   */
  private generateReasoning(
    score: number,
    bestPractices: BestPracticeCheck[],
    securityIssues: SecurityIssue[]
  ): string {
    const passedChecks = bestPractices.filter(c => c.status === 'pass').length;
    const totalChecks = bestPractices.length;
    const criticalIssues = securityIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length;

    let reasoning = `Quality Score: ${score}/100. `;

    if (score >= 85) {
      reasoning += 'Excellent code quality. ';
    } else if (score >= 70) {
      reasoning += 'Good code quality with some areas for improvement. ';
    } else if (score >= 50) {
      reasoning += 'Acceptable code quality but needs significant improvement. ';
    } else {
      reasoning += 'Poor code quality with major issues that must be addressed. ';
    }

    if (totalChecks > 0) {
      reasoning += `Best practices: ${passedChecks}/${totalChecks} checks passed. `;
    }

    if (criticalIssues > 0) {
      reasoning += `Security: ${criticalIssues} critical/high severity issues found. `;
    } else if (securityIssues.length > 0) {
      reasoning += `Security: ${securityIssues.length} minor security issues found. `;
    } else {
      reasoning += 'Security: No major issues detected. ';
    }

    return reasoning.trim();
  }

  /**
   * Quick quality score calculation (faster, less detailed)
   */
  async calculateQualityScore(code: string, language: string): Promise<number> {
    try {
      const prompt = `Quickly assess the quality of this ${language} code and provide a score from 0-100.

Code:
\`\`\`${language}
${code.substring(0, 4000)}
\`\`\`

Consider: code quality, best practices, security, performance, style.

Return only a number between 0-100.`;

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'quality_assessment',
        agentRole: 'QA/Audit Agent',
        context: {
          agentRole: 'QA/Audit Agent',
          tools: []
        }
      });

      // Extract number from response
      const match = response.content.match(/\d+/);
      const score = match ? parseInt(match[0], 10) : 50;
      return Math.max(0, Math.min(100, score));
    } catch (error: any) {
      logger.error('Quick quality score calculation failed:', error);
      return 50; // Default score
    }
  }

  /**
   * Asynchronously create tasks for detected issues
   * This runs in the background and doesn't block the review result
   */
  private async createTasksForIssuesAsync(
    reviewResult: CodeReviewResult,
    projectId?: string,
    userId?: string,
    artifactId?: string
  ): Promise<void> {
    // Only create tasks if projectId and userId are provided
    if (!projectId || !userId) {
      return;
    }

    try {
      // Create tasks from review results
      await issueTaskCreationService.createTasksFromCodeReview(
        projectId,
        {
          securityIssues: reviewResult.securityIssues,
          bestPractices: reviewResult.bestPractices.filter(bp => bp.status === 'fail'),
          performanceMetrics: reviewResult.performanceMetrics,
          codeStyle: reviewResult.codeStyle
        },
        artifactId || '',
        userId
      );
    } catch (error: any) {
      // Log but don't throw - task creation failure shouldn't break code review
      logger.warn('Failed to create tasks for detected issues:', error);
    }
  }
}

export const codeQualityAssuranceService = new CodeQualityAssuranceService();

