/**
 * Test Generation Service
 * Automatically generates unit, integration, and E2E tests for generated code
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';
import { securityTestGenerationService } from './securityTestGeneration.service.js';
import { performanceTestGenerationService } from './performanceTestGeneration.service.js';

export interface TestSuite {
  unitTests: TestCase[];
  integrationTests: TestCase[];
  e2eTests: E2ETestCase[];
  performanceTests?: any[]; // Performance test cases
  testFramework: string;
  coverage: {
    estimated: number; // 0-100
    files: string[];
  };
}

export interface TestCase {
  name: string;
  description: string;
  code: string;
  type: 'unit' | 'integration';
  targetFunction?: string;
  targetFile?: string;
}

export interface E2ETestCase {
  name: string;
  description: string;
  steps: string[];
  expectedResult: string;
  code?: string; // Optional: generated test code
}

export interface TestGenerationOptions {
  language?: string;
  framework?: string; // jest, mocha, pytest, etc.
  testTypes?: ('unit' | 'integration' | 'e2e')[];
  targetCoverage?: number; // 0-100
  projectType?: string;
}

class TestGenerationService {
  /**
   * Generate comprehensive test suite for code
   */
  async generateTestSuite(
    code: string,
    options: TestGenerationOptions = {}
  ): Promise<TestSuite> {
    try {
      const language = options.language || 'typescript';
      const framework = options.framework || this.detectTestFramework(language);
      const testTypes = options.testTypes || ['unit', 'integration', 'e2e'];

      logger.info(`Generating test suite for ${language} using ${framework}`);

      const testSuite: TestSuite = {
        unitTests: [],
        integrationTests: [],
        e2eTests: [],
        performanceTests: [],
        testFramework: framework,
        coverage: {
          estimated: 0,
          files: []
        }
      };

      // Generate unit tests
      if (testTypes.includes('unit')) {
        testSuite.unitTests = await this.generateUnitTests(code, language, framework, options);
      }

      // Generate integration tests
      if (testTypes.includes('integration')) {
        testSuite.integrationTests = await this.generateIntegrationTests(code, language, framework, options);
      }

      // Generate E2E tests
      if (testTypes.includes('e2e')) {
        testSuite.e2eTests = await this.generateE2ETests(code, language, framework, options);
      }

      // Generate security tests
      if (options.testTypes?.includes('security') || options.testTypes === undefined) {
        try {
          const securityTests = await securityTestGenerationService.generateTestSuite(
            code,
            language,
            framework
          );
          // Add security tests to test suite (can be integrated into unit/integration tests)
          logger.debug(`Generated ${securityTests.testCases.length} security test cases`);
        } catch (error: unknown) {
          logger.warn('Security test generation failed:', error.message);
        }
      }

      // Generate performance tests
      if (options.testTypes?.includes('performance') || options.testTypes === undefined) {
        try {
          // Extract endpoints from code
          const endpoints = this.extractEndpoints(code, language);
          const performanceTests = await performanceTestGenerationService.generateTestSuite(
            code,
            language,
            endpoints
          );
          testSuite.performanceTests = performanceTests.tests;
          logger.debug(`Generated ${performanceTests.tests.length} performance test cases`);
        } catch (error: unknown) {
          logger.warn('Performance test generation failed:', error.message);
        }
      }

      // Estimate coverage
      testSuite.coverage = this.estimateCoverage(testSuite, code);

      logger.info(`Test suite generated: ${testSuite.unitTests.length} unit, ${testSuite.integrationTests.length} integration, ${testSuite.e2eTests.length} E2E tests, ${testSuite.performanceTests?.length || 0} performance tests`);
      return testSuite;
    } catch (error: unknown) {
      logger.error('Test suite generation failed:', error);
        return {
          unitTests: [],
          integrationTests: [],
          e2eTests: [],
          performanceTests: [],
          testFramework: options.framework || 'jest',
          coverage: {
            estimated: 0,
            files: []
          }
        };
    }
  }

  /**
   * Generate unit tests
   */
  private async generateUnitTests(
    code: string,
    language: string,
    framework: string,
    options: TestGenerationOptions
  ): Promise<TestCase[]> {
    try {
      const prompt = `Generate comprehensive unit tests for the following ${language} code using ${framework}. Target 100% test coverage.

Code:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Requirements:
- Test ALL functions/methods (100% coverage target)
- Test edge cases (null, undefined, empty, boundary values)
- Test error handling
- Test both success and failure scenarios
- Test all code paths and branches
- Use ${framework} syntax and conventions
- Include descriptive test names
- Add setup/teardown if needed
- Ensure every line of code is covered by tests

Project Type: ${options.projectType || 'Not specified'}

Return as JSON array with:
- name: Test case name
- description: What it tests
- code: Complete test code
- targetFunction: Function being tested (if applicable)
- targetFile: File being tested (if applicable)`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          tests: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                code: { type: Type.STRING },
                targetFunction: { type: Type.STRING },
                targetFile: { type: Type.STRING }
              },
              required: ['name', 'description', 'code']
            }
          }
        },
        required: ['tests']
      };

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'test_generation',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return parsed.tests || [];
    } catch (error: unknown) {
      logger.error('Unit test generation failed:', error);
      return [];
    }
  }

  /**
   * Generate integration tests
   */
  private async generateIntegrationTests(
    code: string,
    language: string,
    framework: string,
    options: TestGenerationOptions
  ): Promise<TestCase[]> {
    try {
      const prompt = `Generate comprehensive integration tests for the following ${language} code using ${framework}. Target 100% coverage of integration points.

Code:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Requirements:
- Test ALL component interactions (100% coverage target)
- Test ALL API endpoints (if applicable)
- Test ALL database interactions (if applicable)
- Test ALL external service integrations
- Test ALL data flow paths between components
- Test error scenarios and edge cases
- Use ${framework} syntax
- Ensure every integration point is covered

Return as JSON array with test cases.`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          tests: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                code: { type: Type.STRING },
                targetFunction: { type: Type.STRING }
              },
              required: ['name', 'description', 'code']
            }
          }
        },
        required: ['tests']
      };

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'test_generation',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return parsed.tests || [];
    } catch (error: unknown) {
      logger.error('Integration test generation failed:', error);
      return [];
    }
  }

  /**
   * Generate E2E tests
   */
  private async generateE2ETests(
    code: string,
    language: string,
    framework: string,
    options: TestGenerationOptions
  ): Promise<E2ETestCase[]> {
    try {
      const prompt = `Generate comprehensive end-to-end (E2E) test scenarios for the following ${language} code. Target 100% coverage of all user workflows.

Code:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Requirements:
- Test ALL complete user workflows (100% coverage target)
- Test ALL critical user paths
- Test ALL alternative paths and error flows
- Include detailed test steps
- Define expected results
- Consider ${options.projectType || 'application'} type
- Ensure every user workflow is covered

Return as JSON array with:
- name: Test scenario name
- description: What workflow it tests
- steps: Array of test steps
- expectedResult: Expected outcome
- code: Optional test code (if applicable)`;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          tests: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                steps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                expectedResult: { type: Type.STRING },
                code: { type: Type.STRING }
              },
              required: ['name', 'description', 'steps', 'expectedResult']
            }
          }
        },
        required: ['tests']
      };

      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'test_generation',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return parsed.tests || [];
    } catch (error: unknown) {
      logger.error('E2E test generation failed:', error);
      return [];
    }
  }

  /**
   * Detect appropriate test framework for language
   */
  private detectTestFramework(language: string): string {
    const frameworkMap: Record<string, string> = {
      'typescript': 'jest',
      'javascript': 'jest',
      'python': 'pytest',
      'java': 'junit',
      'csharp': 'xunit',
      'go': 'testing',
      'rust': 'cargo test',
      'php': 'phpunit'
    };

    return frameworkMap[language.toLowerCase()] || 'jest';
  }

  /**
   * Estimate test coverage based on generated tests
   */
  private estimateCoverage(
    testSuite: TestSuite,
    code: string
  ): { estimated: number; files: string[] } {
    // Simple heuristic: more tests = higher coverage
    const totalTests = testSuite.unitTests.length + testSuite.integrationTests.length + testSuite.e2eTests.length;
    
    // Estimate based on test count (rough heuristic) - target 100% coverage
    let estimated = 0;
    if (totalTests === 0) {
      estimated = 0;
    } else if (totalTests < 5) {
      estimated = 30;
    } else if (totalTests < 10) {
      estimated = 50;
    } else if (totalTests < 20) {
      estimated = 70;
    } else if (totalTests < 30) {
      estimated = 85;
    } else {
      estimated = 100; // Target 100% coverage for comprehensive test suites
    }

    // Extract file names from test cases
    const files = new Set<string>();
    [...testSuite.unitTests, ...testSuite.integrationTests].forEach(test => {
      if (test.targetFile) {
        files.add(test.targetFile);
      }
    });

    return {
      estimated: Math.min(100, estimated),
      files: Array.from(files)
    };
  }

  /**
   * Generate test file content for a specific test case
   */
  async generateTestFile(
    testCase: TestCase,
    framework: string
  ): Promise<string> {
    // This would generate the complete test file with imports, setup, etc.
    // For now, return the test code with basic structure
    return `// Generated test file
// Framework: ${framework}
// Test: ${testCase.name}

${testCase.code}
`;
  }

  /**
   * Generate test configuration files
   */
  async generateTestConfig(
    framework: string,
    language: string
  ): Promise<Record<string, string>> {
    const configs: Record<string, string> = {};

    switch (framework.toLowerCase()) {
      case 'jest':
        configs['jest.config.js'] = `module.exports = {
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}'
  ]
};`;
        break;

      case 'pytest':
        configs['pytest.ini'] = `[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = --cov=. --cov-report=html --cov-report=term
`;
        break;

      // Add more framework configs as needed
    }

    return configs;
  }
}

export const testGenerationService = new TestGenerationService();

