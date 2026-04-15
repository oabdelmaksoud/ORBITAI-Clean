/**
 * Flaky Test Detection & Remediation Service
 * Detects non-deterministic test failures and suggests fixes
 */

import { logger } from '../utils/logger.js';
import { FlakyTest, IFlakyTest } from '../models/FlakyTest.model.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export interface FlakyTestReport {
  projectId: string;
  totalTests: number;
  flakyTests: number;
  flakinessRate: number; // Overall percentage
  flakyTestsList: Array<{
    testName: string;
    testFile: string;
    flakinessRate: number;
    failurePattern: string;
    causes: string[];
    suggestedFixes: string[];
  }>;
  generatedAt: Date;
}

class FlakyTestDetectionService {
  /**
   * Detect flaky tests from test execution history
   */
  async detectFlakyTests(
    projectId: string,
    testResults: Array<{
      testName: string;
      testFile: string;
      passed: boolean;
      executionTime: number;
      error?: string;
      timestamp: Date;
    }>
  ): Promise<IFlakyTest[]> {
    try {
      logger.info(`Detecting flaky tests for project ${projectId}`);

      // Group test results by test name
      const testGroups = new Map<string, typeof testResults>();
      for (const result of testResults) {
        const key = `${result.testFile}:${result.testName}`;
        if (!testGroups.has(key)) {
          testGroups.set(key, []);
        }
        testGroups.get(key)!.push(result);
      }

      const flakyTests: IFlakyTest[] = [];

      for (const [key, results] of testGroups.entries()) {
        if (results.length < 3) continue; // Need at least 3 runs

        const passed = results.filter(r => r.passed).length;
        const failed = results.length - passed;
        const flakinessRate = (failed / results.length) * 100;

        // Consider flaky if failure rate is 10-90% (not consistently passing or failing)
        if (flakinessRate >= 10 && flakinessRate <= 90) {
          const [testFile, testName] = key.split(':');
          
          // Analyze failure pattern
          const failurePattern = this.analyzeFailurePattern(results);
          const causes = await this.identifyCauses(testName, testFile, results);
          const fixes = await this.suggestFixes(testName, testFile, failurePattern, causes);

          const flakyTest = new FlakyTest({
            projectId,
            testName,
            testFile,
            flakinessRate,
            failurePattern,
            causes,
            fixes,
            status: 'detected',
            firstDetected: results[0].timestamp,
            lastOccurred: results[results.length - 1].timestamp,
            occurrenceCount: failed
          });

          await flakyTest.save();
          flakyTests.push(flakyTest);
        }
      }

      logger.info(`Detected ${flakyTests.length} flaky tests`);
      return flakyTests;
    } catch (error: unknown) {
      logger.error('Failed to detect flaky tests:', error);
      throw error;
    }
  }

  /**
   * Analyze failure pattern
   */
  private analyzeFailurePattern(
    results: Array<{ passed: boolean; executionTime: number; error?: string; timestamp: Date }>
  ): IFlakyTest['failurePattern'] {
    // Check for time-dependent patterns
    const timeVariations = results.map(r => r.executionTime);
    const avgTime = timeVariations.reduce((sum, t) => sum + t, 0) / timeVariations.length;
    const timeVariance = timeVariations.some(t => Math.abs(t - avgTime) > avgTime * 0.5);

    if (timeVariance) {
      return 'time_dependent';
    }

    // Check error messages for patterns
    const errors = results.filter(r => !r.passed && r.error).map(r => r.error!.toLowerCase());
    
    if (errors.some(e => e.includes('timeout') || e.includes('timed out'))) {
      return 'time_dependent';
    }
    if (errors.some(e => e.includes('race') || e.includes('concurrent'))) {
      return 'race_condition';
    }
    if (errors.some(e => e.includes('network') || e.includes('connection') || e.includes('external'))) {
      return 'external_dependency';
    }

    // Check execution time patterns
    const executionTimes = results.map(r => r.executionTime);
    const hasHighVariance = this.calculateVariance(executionTimes) > avgTime * 0.3;

    if (hasHighVariance) {
      return 'intermittent';
    }

    return 'unknown';
  }

  /**
   * Identify causes using LLM
   */
  private async identifyCauses(
    testName: string,
    testFile: string,
    results: Array<{ passed: boolean; error?: string }>
  ): Promise<string[]> {
    const errors = results.filter(r => !r.passed && r.error).map(r => r.error).slice(0, 5);
    const errorSummary = errors.join('\n');

    const prompt = `Analyze this flaky test to identify root causes:

Test: ${testName}
File: ${testFile}

Error patterns:
${errorSummary}

Common causes of flaky tests:
1. Race conditions (async operations, shared state)
2. Time-dependent logic (dates, timers, delays)
3. External dependencies (network, databases, APIs)
4. Shared state between tests
5. Non-deterministic data ordering
6. Missing test isolation

Identify the most likely causes for this flaky test.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        causes: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ['causes']
    };

    try {
      const response = await (llmRouter as any).routeAndExecute({
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
      return parsed.causes || [];
    } catch (error: unknown) {
      logger.warn('LLM cause identification failed:', (error instanceof Error ? error.message : String(error)));
      return ['Unknown cause - requires manual investigation'];
    }
  }

  /**
   * Suggest fixes
   */
  private async suggestFixes(
    _testName: string,
    _testFile: string,
    failurePattern: IFlakyTest['failurePattern'],
    causes: string[]
  ): Promise<IFlakyTest['fixes']> {
    const fixes: IFlakyTest['fixes'] = [];

    // Pattern-based fixes
    switch (failurePattern) {
      case 'race_condition':
        fixes.push({
          type: 'isolation',
          description: 'Isolate test execution to prevent race conditions',
          implementation: 'Use test isolation, avoid shared state, add proper async/await handling'
        });
        break;

      case 'time_dependent':
        fixes.push({
          type: 'time_control',
          description: 'Mock time-dependent functions',
          implementation: 'Use jest.useFakeTimers() or similar to control time'
        });
        break;

      case 'external_dependency':
        fixes.push({
          type: 'mocking',
          description: 'Mock external dependencies',
          implementation: 'Mock network requests, database calls, and external APIs'
        });
        break;

      case 'shared_state':
        fixes.push({
          type: 'isolation',
          description: 'Ensure test isolation',
          implementation: 'Reset state between tests, use beforeEach/afterEach hooks'
        });
        break;

      default:
        fixes.push({
          type: 'refactor',
          description: 'Refactor test to be more deterministic',
          implementation: 'Review test logic for non-deterministic behavior'
        });
    }

    // Cause-based fixes
    if (causes.some(c => c.toLowerCase().includes('async'))) {
      fixes.push({
        type: 'isolation',
        description: 'Fix async handling',
        implementation: 'Ensure all async operations are properly awaited'
      });
    }

    if (causes.some(c => c.toLowerCase().includes('mock'))) {
      fixes.push({
        type: 'mocking',
        description: 'Add proper mocks',
        implementation: 'Mock all external dependencies and side effects'
      });
    }

    return fixes;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Generate flaky test report
   */
  async generateReport(projectId: string): Promise<FlakyTestReport> {
    const flakyTests = await FlakyTest.find({ projectId, status: { $ne: 'fixed' } }).lean();

    if (flakyTests.length === 0) {
      return {
        projectId,
        totalTests: 0,
        flakyTests: 0,
        flakinessRate: 0,
        flakyTestsList: [],
        generatedAt: new Date()
      };
    }

    const avgFlakiness = flakyTests.reduce((sum, t) => sum + t.flakinessRate, 0) / flakyTests.length;

    return {
      projectId,
      totalTests: 0, // Would need total test count
      flakyTests: flakyTests.length,
      flakinessRate: Math.round(avgFlakiness * 100) / 100,
      flakyTestsList: flakyTests.map(t => ({
        testName: t.testName,
        testFile: t.testFile,
        flakinessRate: t.flakinessRate,
        failurePattern: t.failurePattern,
        causes: t.causes,
        suggestedFixes: t.fixes.map(f => f.description)
      })),
      generatedAt: new Date()
    };
  }
}

export const flakyTestDetectionService = new FlakyTestDetectionService();



