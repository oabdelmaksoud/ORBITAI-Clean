/**
 * Code Refinement Service
 * Provides automated code improvement cycles to achieve agency-quality code
 */

import { logger } from '../utils/logger.js';
import { codeQualityAssuranceService } from './codeQualityAssurance.service.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export interface RefinementResult {
  originalCode: string;
  refinedCode: string;
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  improvements: string[];
  iterations: number;
  success: boolean;
  reasoning: string;
}

export interface RefinementOptions {
  targetScore?: number; // Default: 85
  maxIterations?: number; // Default: 3
  focusAreas?: string[]; // e.g., ['security', 'performance', 'best-practices']
  language?: string;
  context?: {
    projectType?: string;
    standards?: string[];
    framework?: string;
  };
}

class CodeRefinementService {
  private readonly DEFAULT_TARGET_SCORE = 85;
  private readonly DEFAULT_MAX_ITERATIONS = 3;

  /**
   * Refine code through iterative improvement cycles
   */
  async refineCode(
    code: string,
    options: RefinementOptions = {}
  ): Promise<RefinementResult> {
    const targetScore = options.targetScore || this.DEFAULT_TARGET_SCORE;
    const maxIterations = options.maxIterations || this.DEFAULT_MAX_ITERATIONS;
    const language = options.language || 'typescript';

    logger.info(`Starting code refinement. Target score: ${targetScore}, Max iterations: ${maxIterations}`);

    // Initial quality assessment
    const initialScore = await codeQualityAssuranceService.calculateQualityScore(code, language);
    logger.info(`Initial quality score: ${initialScore}/100`);

    if (initialScore >= targetScore) {
      return {
        originalCode: code,
        refinedCode: code,
        qualityScoreBefore: initialScore,
        qualityScoreAfter: initialScore,
        improvements: ['Code already meets quality threshold'],
        iterations: 0,
        success: true,
        reasoning: `Code quality score (${initialScore}) already meets or exceeds target (${targetScore})`
      };
    }

    let currentCode = code;
    let currentScore = initialScore;
    const improvements: string[] = [];
    let iteration = 0;

    // Iterative refinement loop
    while (currentScore < targetScore && iteration < maxIterations) {
      iteration++;
      logger.info(`Refinement iteration ${iteration}/${maxIterations}. Current score: ${currentScore}`);

      try {
        // Get detailed review to identify issues
        const review = await codeQualityAssuranceService.reviewCode(
          currentCode,
          language,
          options.context
        );

        // Generate refinement prompt
        const refinementPrompt = this.buildRefinementPrompt(
          currentCode,
          review,
          language,
          options
        );

        // Get refined code from LLM
        const refinedResponse = await llmRouter.routeAndExecute({
          prompt: refinementPrompt,
          taskType: 'code_refinement',
          agentRole: 'Implementation Agent',
          context: {
            agentRole: 'Implementation Agent',
            tools: []
          },
          requiredOutputFormat: 'code'
        });

        // Extract code from response (handle code blocks)
        const refinedCode = this.extractCodeFromResponse(refinedResponse.content, language);
        
        // Assess refined code quality
        const refinedScore = await codeQualityAssuranceService.calculateQualityScore(
          refinedCode,
          language
        );

        logger.info(`Iteration ${iteration} complete. Score: ${currentScore} → ${refinedScore}`);

        // Only accept if score improved
        if (refinedScore > currentScore) {
          currentCode = refinedCode;
          currentScore = refinedScore;
          improvements.push(
            `Iteration ${iteration}: Score improved from ${currentScore - (refinedScore - currentScore)} to ${refinedScore}. ` +
            `Key improvements: ${review.suggestions.slice(0, 3).join(', ')}`
          );
        } else {
          improvements.push(
            `Iteration ${iteration}: No improvement (score: ${refinedScore}). Stopping refinement.`
          );
          break; // No improvement, stop
        }

        // If we've reached target, stop early
        if (currentScore >= targetScore) {
          improvements.push(`Target score (${targetScore}) achieved!`);
          break;
        }
      } catch (error: any) {
        logger.error(`Refinement iteration ${iteration} failed:`, error);
        improvements.push(`Iteration ${iteration} failed: ${error.message}`);
        break;
      }
    }

    const success = currentScore >= targetScore;

    return {
      originalCode: code,
      refinedCode: currentCode,
      qualityScoreBefore: initialScore,
      qualityScoreAfter: currentScore,
      improvements,
      iterations: iteration,
      success,
      reasoning: success
        ? `Code refined successfully. Score improved from ${initialScore} to ${currentScore} in ${iteration} iteration(s).`
        : `Code refinement completed but target score not reached. Score improved from ${initialScore} to ${currentScore} in ${iteration} iteration(s). Target was ${targetScore}.`
    };
  }

  /**
   * Build refinement prompt based on code review results
   */
  private buildRefinementPrompt(
    code: string,
    review: any,
    language: string,
    options: RefinementOptions
  ): string {
    const focusAreas = options.focusAreas || ['all'];
    const context = options.context || {};

    let prompt = `You are an expert ${language} developer. Refine the following code to improve its quality.

Original Code:
\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`

Current Quality Score: ${review.overallScore || 'N/A'}/100
Target Quality Score: ${options.targetScore || 85}/100

Quality Issues Found:
`;

    // Add best practice issues
    const failedPractices = review.bestPractices?.filter((p: any) => p.status !== 'pass') || [];
    if (failedPractices.length > 0) {
      prompt += `\nBest Practice Issues:\n`;
      failedPractices.forEach((p: any) => {
        prompt += `- ${p.principle}: ${p.description}\n`;
      });
    }

    // Add security issues
    const securityIssues = review.securityIssues || [];
    if (securityIssues.length > 0) {
      prompt += `\nSecurity Issues:\n`;
      securityIssues.slice(0, 5).forEach((issue: any) => {
        prompt += `- [${issue.severity}] ${issue.type}: ${issue.description}\n`;
        prompt += `  Fix: ${issue.recommendation}\n`;
      });
    }

    // Add performance issues
    const bottlenecks = review.performanceMetrics?.potentialBottlenecks || [];
    if (bottlenecks.length > 0) {
      prompt += `\nPerformance Issues:\n`;
      bottlenecks.forEach((b: string) => {
        prompt += `- ${b}\n`;
      });
    }

    // Add code style issues
    const styleIssues = [
      ...(review.codeStyle?.formatting || []),
      ...(review.codeStyle?.naming || []),
      ...(review.codeStyle?.structure || [])
    ];
    if (styleIssues.length > 0) {
      prompt += `\nCode Style Issues:\n`;
      styleIssues.slice(0, 5).forEach((issue: string) => {
        prompt += `- ${issue}\n`;
      });
    }

    prompt += `\nRefinement Instructions:
1. Fix all security issues (especially critical and high severity)
2. Address best practice violations
3. Optimize performance bottlenecks
4. Improve code style and consistency
5. Maintain functionality - do not break existing behavior
6. Add appropriate error handling
7. Add meaningful comments where needed
8. Follow ${language} best practices and conventions`;

    if (context.framework) {
      prompt += `\n9. Follow ${context.framework} framework conventions`;
    }

    if (context.standards && context.standards.length > 0) {
      prompt += `\n10. Ensure compliance with: ${context.standards.join(', ')}`;
    }

    prompt += `\n\nReturn ONLY the refined code, no explanations. Use proper ${language} syntax.`;

    return prompt;
  }

  /**
   * Extract code from LLM response (handles code blocks)
   */
  private extractCodeFromResponse(response: string, language: string): string {
    // Try to extract from code blocks
    const codeBlockRegex = new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``, 'i');
    const match = response.match(codeBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }

    // Try generic code block
    const genericCodeBlock = /```[\s\S]*?```/;
    const genericMatch = response.match(genericCodeBlock);
    if (genericMatch) {
      const content = genericMatch[0];
      return content.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    }

    // If no code blocks, return response as-is (might be plain code)
    return response.trim();
  }

  /**
   * Quick refinement (single iteration)
   */
  async quickRefine(
    code: string,
    language: string = 'typescript',
    issues: string[] = []
  ): Promise<string> {
    try {
      const prompt = `Refine this ${language} code to improve quality. Focus on: ${issues.join(', ') || 'general improvements'}.

Code:
\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`

Return only the refined code.`;

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'code_refinement',
        agentRole: 'Implementation Agent',
        context: {
          agentRole: 'Implementation Agent',
          tools: []
        },
        requiredOutputFormat: 'code'
      });

      return this.extractCodeFromResponse(response.content, language);
    } catch (error: any) {
      logger.error('Quick refinement failed:', error);
      return code; // Return original on failure
    }
  }
}

export const codeRefinementService = new CodeRefinementService();




