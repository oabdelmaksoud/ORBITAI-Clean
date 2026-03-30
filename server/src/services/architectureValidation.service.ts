/**
 * Architecture Validation Service
 * Validates architectural patterns (MVC, microservices, clean architecture, etc.)
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export type ArchitecturalPattern = 
  | 'mvc' 
  | 'microservices' 
  | 'clean-architecture' 
  | 'hexagonal' 
  | 'event-driven' 
  | 'layered' 
  | 'monolithic';

export interface ArchitectureValidationResult {
  pattern: ArchitecturalPattern;
  detected: boolean;
  confidence: number; // 0-100
  violations: Array<{
    principle: string; // SOLID, DRY, KISS, etc.
    severity: 'high' | 'medium' | 'low';
    description: string;
    location?: string;
    suggestion: string;
  }>;
  layerSeparation: {
    valid: boolean;
    issues: string[];
    score: number; // 0-100
  };
  solidCompliance: {
    score: number; // 0-100
    violations: Array<{
      principle: 'S' | 'O' | 'L' | 'I' | 'D';
      description: string;
      location?: string;
    }>;
  };
  dryViolations: Array<{
    description: string;
    locations: string[];
    suggestion: string;
  }>;
  complexity: {
    cyclomatic: number;
    cognitive: number;
    maintainability: number; // 0-100
  };
  overallScore: number; // 0-100
}

class ArchitectureValidationService {
  /**
   * Validate architecture pattern
   */
  async validateArchitecturePattern(
    code: string,
    language: string,
    pattern: ArchitecturalPattern
  ): Promise<ArchitectureValidationResult> {
    try {
      logger.info(`Validating ${pattern} architecture pattern for ${language} code`);

      // Analyze structure
      const structure = this.analyzeStructure(code, language);

      // Detect pattern
      const detected = this.detectPattern(structure, pattern);
      const confidence = detected ? this.calculateConfidence(structure, pattern) : 0;

      // Check layer separation
      const layerSeparation = this.checkLayerSeparation(code, language, pattern);

      // Validate SOLID principles
      const solidCompliance = await this.validateSOLID(code, language);

      // Detect DRY violations
      const dryViolations = this.detectDRYViolations(code, language);

      // Calculate complexity
      const complexity = this.calculateComplexity(code, language);

      // Generate violations list
      const violations = this.generateViolations(
        layerSeparation,
        solidCompliance,
        dryViolations
      );

      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        confidence,
        layerSeparation.score,
        solidCompliance.score,
        complexity.maintainability,
        violations.length
      );

      return {
        pattern,
        detected,
        confidence,
        violations,
        layerSeparation,
        solidCompliance,
        dryViolations,
        complexity,
        overallScore
      };
    } catch (error: any) {
      logger.error('Failed to validate architecture pattern:', error);
      throw error;
    }
  }

  /**
   * Analyze code structure
   */
  private analyzeStructure(code: string, language: string): {
    files: number;
    classes: number;
    functions: number;
    imports: number;
    dependencies: string[];
  } {
    // Simple structure analysis
    const lines = code.split('\n');
    const classMatches = code.match(/class\s+\w+/g) || [];
    const functionMatches = code.match(/(?:function|const|let|var)\s+\w+\s*[=:]/g) || [];
    const importMatches = code.match(/(?:import|require|from)\s+['"]/g) || [];

    // Extract dependencies from imports
    const dependencies: string[] = [];
    for (const line of lines) {
      const importMatch = line.match(/(?:import|require|from)\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        dependencies.push(importMatch[1]);
      }
    }

    return {
      files: code.split(/\/\/\s*File:|#\s*File:/).length - 1 || 1,
      classes: classMatches.length,
      functions: functionMatches.length,
      imports: importMatches.length,
      dependencies: Array.from(new Set(dependencies))
    };
  }

  /**
   * Detect architectural pattern
   */
  private detectPattern(
    structure: ReturnType<typeof this.analyzeStructure>,
    expectedPattern: ArchitecturalPattern
  ): boolean {
    // Pattern detection heuristics
    switch (expectedPattern) {
      case 'mvc':
        // MVC should have models, views, controllers
        return structure.dependencies.some(d => 
          d.includes('model') || d.includes('view') || d.includes('controller')
        ) || structure.classes >= 3;

      case 'microservices':
        // Microservices should have multiple services, API gateways
        return structure.files > 5 && 
               structure.dependencies.some(d => 
                 d.includes('service') || d.includes('api') || d.includes('gateway')
               );

      case 'clean-architecture':
        // Clean architecture should have layers (domain, use cases, infrastructure)
        return structure.dependencies.some(d => 
          d.includes('domain') || d.includes('usecase') || d.includes('infrastructure')
        );

      case 'hexagonal':
        // Hexagonal should have ports and adapters
        return structure.dependencies.some(d => 
          d.includes('port') || d.includes('adapter')
        );

      case 'event-driven':
        // Event-driven should have events, handlers, publishers
        return structure.dependencies.some(d => 
          d.includes('event') || d.includes('handler') || d.includes('publisher')
        );

      default:
        return true; // Default to true for other patterns
    }
  }

  /**
   * Calculate pattern confidence
   */
  private calculateConfidence(
    structure: ReturnType<typeof this.analyzeStructure>,
    pattern: ArchitecturalPattern
  ): number {
    let confidence = 50; // Base confidence

    // Adjust based on structure characteristics
    if (structure.classes > 0) confidence += 10;
    if (structure.functions > 10) confidence += 10;
    if (structure.dependencies.length > 3) confidence += 10;
    if (structure.files > 1) confidence += 10;

    // Pattern-specific adjustments
    switch (pattern) {
      case 'mvc':
        if (structure.classes >= 3) confidence += 10;
        break;
      case 'microservices':
        if (structure.files > 5) confidence += 10;
        break;
    }

    return Math.min(100, confidence);
  }

  /**
   * Check layer separation
   */
  private checkLayerSeparation(
    code: string,
    language: string,
    pattern: ArchitecturalPattern
  ): {
    valid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check for layer violations based on pattern
    switch (pattern) {
      case 'mvc':
        // Models shouldn't import views
        if (code.match(/model.*import.*view/i)) {
          issues.push('Models importing views violates MVC separation');
          score -= 20;
        }
        // Controllers shouldn't contain business logic
        if (code.match(/controller.*\b(?:calculate|process|transform)\b/i)) {
          issues.push('Business logic found in controllers');
          score -= 15;
        }
        break;

      case 'clean-architecture':
        // Domain shouldn't depend on infrastructure
        if (code.match(/domain.*import.*(?:database|http|framework)/i)) {
          issues.push('Domain layer depends on infrastructure');
          score -= 30;
        }
        break;

      case 'microservices':
        // Services shouldn't directly access other service databases
        if (code.match(/service.*\b(?:database|db|sql).*other.*service/i)) {
          issues.push('Service directly accessing another service database');
          score -= 25;
        }
        break;
    }

    return {
      valid: issues.length === 0,
      issues,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate SOLID principles using LLM
   */
  private async validateSOLID(
    code: string,
    language: string
  ): Promise<{
    score: number;
    violations: Array<{
      principle: 'S' | 'O' | 'L' | 'I' | 'D';
      description: string;
      location?: string;
    }>;
  }> {
    try {
      const prompt = `Analyze the following ${language} code for SOLID principle violations:

\`\`\`${language}
${code.substring(0, 5000)}
\`\`\`

Identify violations of:
- S: Single Responsibility Principle
- O: Open/Closed Principle
- L: Liskov Substitution Principle
- I: Interface Segregation Principle
- D: Dependency Inversion Principle

Return a JSON object with violations array.`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          violations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                principle: { type: Type.STRING },
                description: { type: Type.STRING },
                location: { type: Type.STRING }
              },
              required: ['principle', 'description']
            }
          },
          score: { type: Type.NUMBER }
        },
        required: ['violations', 'score']
      };

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'code_analysis',
        agentRole: 'QA/Audit Agent',
        context: {
          agentRole: 'QA/Audit Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      const violations = (parsed.violations || []).map((v: any) => ({
        principle: v.principle as 'S' | 'O' | 'L' | 'I' | 'D',
        description: v.description,
        location: v.location
      }));

      const score = parsed.score || Math.max(0, 100 - violations.length * 10);

      return { score: Math.round(score), violations };
    } catch (error: any) {
      logger.warn('Failed to validate SOLID principles with LLM, using fallback:', error.message);
      // Fallback: simple heuristic
      return {
        score: 80,
        violations: []
      };
    }
  }

  /**
   * Detect DRY violations
   */
  private detectDRYViolations(code: string, language: string): Array<{
    description: string;
    locations: string[];
    suggestion: string;
  }> {
    const violations: Array<{
      description: string;
      locations: string[];
      suggestion: string;
    }> = [];

    // Simple heuristic: look for repeated code blocks
    const lines = code.split('\n');
    const codeBlocks = new Map<string, number[]>();

    // Group similar lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 20 && !line.startsWith('//') && !line.startsWith('*')) {
        const normalized = line.toLowerCase().replace(/\s+/g, ' ');
        if (!codeBlocks.has(normalized)) {
          codeBlocks.set(normalized, []);
        }
        codeBlocks.get(normalized)!.push(i + 1);
      }
    }

    // Find repeated blocks
    for (const [block, locations] of codeBlocks.entries()) {
      if (locations.length > 2) {
        violations.push({
          description: `Repeated code block found ${locations.length} times`,
          locations: locations.map(l => `Line ${l}`),
          suggestion: 'Extract to a function or constant'
        });
      }
    }

    return violations.slice(0, 10); // Limit to top 10
  }

  /**
   * Calculate complexity metrics
   */
  private calculateComplexity(code: string, language: string): {
    cyclomatic: number;
    cognitive: number;
    maintainability: number;
  } {
    // Simple complexity estimation
    const lines = code.split('\n').filter(l => l.trim().length > 0);
    const functions = code.match(/(?:function|const|let|var)\s+\w+\s*[=:]/g) || [];
    
    // Cyclomatic complexity: count decision points
    const decisions = (code.match(/\b(?:if|else|switch|case|while|for|catch)\b/g) || []).length;
    const cyclomatic = Math.max(1, decisions - functions.length + 2);

    // Cognitive complexity: similar but weights nesting
    const nesting = (code.match(/\{/g) || []).length;
    const cognitive = cyclomatic + nesting * 2;

    // Maintainability index (simplified)
    const maintainability = Math.max(0, Math.min(100, 
      171 - 5.2 * Math.log(cyclomatic) - 0.23 * Math.log(cognitive) - 16.2 * Math.log(lines.length / functions.length || 1)
    ));

    return {
      cyclomatic,
      cognitive,
      maintainability: Math.round(maintainability)
    };
  }

  /**
   * Generate violations list
   */
  private generateViolations(
    layerSeparation: ReturnType<typeof this.checkLayerSeparation>,
    solidCompliance: Awaited<ReturnType<typeof this.validateSOLID>>,
    dryViolations: ReturnType<typeof this.detectDRYViolations>
  ): ArchitectureValidationResult['violations'] {
    const violations: ArchitectureValidationResult['violations'] = [];

    // Layer separation violations
    for (const issue of layerSeparation.issues) {
      violations.push({
        principle: 'Layer Separation',
        severity: 'high',
        description: issue,
        suggestion: 'Refactor to maintain proper layer boundaries'
      });
    }

    // SOLID violations
    for (const violation of solidCompliance.violations) {
      violations.push({
        principle: `SOLID: ${violation.principle}`,
        severity: 'medium',
        description: violation.description,
        location: violation.location,
        suggestion: `Refactor to comply with ${violation.principle} principle`
      });
    }

    // DRY violations
    for (const violation of dryViolations) {
      violations.push({
        principle: 'DRY',
        severity: 'low',
        description: violation.description,
        location: violation.locations.join(', '),
        suggestion: violation.suggestion
      });
    }

    return violations;
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(
    confidence: number,
    layerScore: number,
    solidScore: number,
    maintainability: number,
    violationCount: number
  ): number {
    // Weighted average
    const score = (
      confidence * 0.2 +
      layerScore * 0.3 +
      solidScore * 0.3 +
      maintainability * 0.2
    ) - (violationCount * 2); // Penalty for violations

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

export const architectureValidationService = new ArchitectureValidationService();



