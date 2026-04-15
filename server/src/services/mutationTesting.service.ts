/**
 * Mutation Testing Service
 * Verifies test quality using Stryker (JS/TS), Mutmut (Python), PIT (Java)
 */

import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface MutationTestResult {
  tool: 'stryker' | 'mutmut' | 'pit' | 'llm';
  mutationScore: number; // 0-100
  totalMutations: number;
  killed: number; // Mutations killed by tests
  survived: number; // Mutations that survived (weak tests)
  timeout: number;
  runtimeErrors: number;
  weakTests: Array<{
    testName: string;
    mutationType: string;
    location: string;
    description: string;
  }>;
  generatedAt: Date;
}

class MutationTestingService {
  /**
   * Run mutation testing
   */
  async runMutationTests(
    code: string,
    tests: string,
    language: string
  ): Promise<MutationTestResult> {
    try {
      logger.info(`Running mutation tests for ${language} code`);

      const tool = this.selectTool(language);

      switch (tool) {
        case 'stryker':
          return await this.runStryker(code, tests, language);
        case 'mutmut':
          return await this.runMutmut(code, tests, language);
        case 'pit':
          return await this.runPIT(code, tests, language);
        default:
          return await this.runLLMMutationAnalysis(code, tests, language);
      }
    } catch (error: unknown) {
      logger.error('Mutation testing failed:', error);
      // Fallback to LLM analysis
      return await this.runLLMMutationAnalysis(code, tests, language);
    }
  }

  /**
   * Select mutation testing tool based on language
   */
  private selectTool(language: string): 'stryker' | 'mutmut' | 'pit' | 'llm' {
    const lang = language.toLowerCase();
    if (lang === 'typescript' || lang === 'javascript') return 'stryker';
    if (lang === 'python') return 'mutmut';
    if (lang === 'java') return 'pit';
    return 'llm';
  }

  /**
   * Run Stryker (JavaScript/TypeScript)
   */
  private async runStryker(
    code: string,
    tests: string,
    language: string
  ): Promise<MutationTestResult> {
    try {
      // Check if Stryker is available
      await execAsync('npx stryker --version');
    } catch {
      logger.debug('Stryker not available, using LLM fallback');
      return await this.runLLMMutationAnalysis(code, tests, language);
    }

    // Create temporary project
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'stryker-'));
    const codeFile = path.join(tempDir, `code.${language === 'typescript' ? 'ts' : 'js'}`);
    const testFile = path.join(tempDir, `code.test.${language === 'typescript' ? 'ts' : 'js'}`);

    await fs.writeFile(codeFile, code);
    await fs.writeFile(testFile, tests);

    // Create Stryker config
    const strykerConfig = this.generateStrykerConfig(language);
    await fs.writeFile(path.join(tempDir, 'stryker.conf.json'), JSON.stringify(strykerConfig, null, 2));

    try {
      // Run Stryker
      const { stdout } = await execAsync('npx stryker run', {
        cwd: tempDir,
        timeout: 300000 // 5 minutes
      });

      // Parse Stryker output
      return this.parseStrykerOutput(stdout);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Run Mutmut (Python)
   */
  private async runMutmut(
    code: string,
    tests: string,
    language: string
  ): Promise<MutationTestResult> {
    try {
      await execAsync('mutmut --version');
    } catch {
      logger.debug('Mutmut not available, using LLM fallback');
      return await this.runLLMMutationAnalysis(code, tests, language);
    }

    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mutmut-'));
    const codeFile = path.join(tempDir, 'code.py');
    const testFile = path.join(tempDir, 'test_code.py');

    await fs.writeFile(codeFile, code);
    await fs.writeFile(testFile, tests);

    try {
      const { stdout } = await execAsync('mutmut run', {
        cwd: tempDir,
        timeout: 300000
      });

      return this.parseMutmutOutput(stdout);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Run PIT (Java)
   */
  private async runPIT(
    code: string,
    tests: string,
    language: string
  ): Promise<MutationTestResult> {
    // PIT requires Maven/Gradle setup, simplified for now
    logger.debug('PIT mutation testing (requires Maven setup)');
    return await this.runLLMMutationAnalysis(code, tests, language);
  }

  /**
   * LLM-based mutation analysis (fallback)
   */
  private async runLLMMutationAnalysis(
    code: string,
    tests: string,
    language: string
  ): Promise<MutationTestResult> {
    const { llmRouter } = await import('./llm/LLMRouter.js');
    const { Type, Schema } = await import('@google/genai');

    const prompt = `Analyze the test quality for the following ${language} code by identifying weak test cases:

Code:
\`\`\`${language}
${code.substring(0, 4000)}
\`\`\`

Tests:
\`\`\`${language}
${tests.substring(0, 4000)}
\`\`\`

Identify:
1. Tests that might not catch common mutations (e.g., changing operators, conditions, return values)
2. Missing edge case coverage
3. Tests that are too lenient (e.g., only checking for non-null, not checking actual values)
4. Tests that don't verify behavior, only structure

Estimate mutation score (0-100) based on how well tests would catch mutations.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        mutationScore: { type: Type.NUMBER },
        totalMutations: { type: Type.NUMBER },
        killed: { type: Type.NUMBER },
        survived: { type: Type.NUMBER },
        weakTests: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              testName: { type: Type.STRING },
              mutationType: { type: Type.STRING },
              location: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      },
      required: ['mutationScore', 'totalMutations', 'killed', 'survived']
    };

    try {
      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'test_analysis',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);

      return {
        tool: 'llm',
        mutationScore: parsed.mutationScore || 0,
        totalMutations: parsed.totalMutations || 0,
        killed: parsed.killed || 0,
        survived: parsed.survived || 0,
        timeout: 0,
        runtimeErrors: 0,
        weakTests: parsed.weakTests || [],
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('LLM mutation analysis failed:', error);
      return {
        tool: 'llm',
        mutationScore: 0,
        totalMutations: 0,
        killed: 0,
        survived: 0,
        timeout: 0,
        runtimeErrors: 0,
        weakTests: [],
        generatedAt: new Date()
      };
    }
  }

  /**
   * Generate Stryker config
   */
  private generateStrykerConfig(language: string): any {
    return {
      packageManager: 'npm',
      reporters: ['html', 'clear-text', 'progress'],
      testRunner: 'jest',
      coverageAnalysis: 'perTest',
      mutate: [
        `src/**/*.${language === 'typescript' ? 'ts' : 'js'}`,
        `!src/**/*.test.${language === 'typescript' ? 'ts' : 'js'}`,
        `!src/**/*.spec.${language === 'typescript' ? 'ts' : 'js'}`
      ],
      thresholds: {
        high: 80,
        low: 70,
        break: 60
      }
    };
  }

  /**
   * Parse Stryker output
   */
  private parseStrykerOutput(output: string): MutationTestResult {
    // Parse Stryker JSON report (simplified)
    const killedMatch = output.match(/(\d+)\s+killed/);
    const survivedMatch = output.match(/(\d+)\s+survived/);
    const timeoutMatch = output.match(/(\d+)\s+timeout/);
    const runtimeErrorMatch = output.match(/(\d+)\s+runtime error/);

    const killed = killedMatch ? parseInt(killedMatch[1], 10) : 0;
    const survived = survivedMatch ? parseInt(survivedMatch[1], 10) : 0;
    const timeout = timeoutMatch ? parseInt(timeoutMatch[1], 10) : 0;
    const runtimeErrors = runtimeErrorMatch ? parseInt(runtimeErrorMatch[1], 10) : 0;
    const totalMutations = killed + survived + timeout + runtimeErrors;

    const mutationScore = totalMutations > 0
      ? (killed / totalMutations) * 100
      : 0;

    return {
      tool: 'stryker',
      mutationScore: Math.round(mutationScore),
      totalMutations,
      killed,
      survived,
      timeout,
      runtimeErrors,
      weakTests: [], // Would parse from detailed report
      generatedAt: new Date()
    };
  }

  /**
   * Parse Mutmut output
   */
  private parseMutmutOutput(output: string): MutationTestResult {
    // Parse Mutmut output (simplified)
    const killedMatch = output.match(/(\d+)\s+killed/);
    const survivedMatch = output.match(/(\d+)\s+survived/);

    const killed = killedMatch ? parseInt(killedMatch[1], 10) : 0;
    const survived = survivedMatch ? parseInt(survivedMatch[1], 10) : 0;
    const totalMutations = killed + survived;

    const mutationScore = totalMutations > 0
      ? (killed / totalMutations) * 100
      : 0;

    return {
      tool: 'mutmut',
      mutationScore: Math.round(mutationScore),
      totalMutations,
      killed,
      survived,
      timeout: 0,
      runtimeErrors: 0,
      weakTests: [],
      generatedAt: new Date()
    };
  }
}

export const mutationTestingService = new MutationTestingService();



