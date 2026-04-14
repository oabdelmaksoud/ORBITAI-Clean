/**
 * Test Generation Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../services/llm/LLMRouter.js', () => ({
  llmRouter: {
    routeAndExecute: vi.fn(),
  },
}));

vi.mock('../../services/securityTestGeneration.service.js', () => ({
  securityTestGenerationService: {
    generateTestSuite: vi.fn(),
  },
}));

vi.mock('../../services/performanceTestGeneration.service.js', () => ({
  performanceTestGenerationService: {
    generateTestSuite: vi.fn(),
  },
}));

vi.mock('@google/genai', () => ({
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
  },
}));

import { testGenerationService } from '../../services/testGeneration.service.js';
import { llmRouter } from '../../services/llm/LLMRouter.js';
import { securityTestGenerationService } from '../../services/securityTestGeneration.service.js';
import { performanceTestGenerationService } from '../../services/performanceTestGeneration.service.js';

const mockUnitTests = [
  {
    name: 'should add two numbers',
    description: 'Tests the add function with two positive integers',
    code: 'it("should add two numbers", () => { expect(add(1, 2)).toBe(3); });',
    targetFunction: 'add',
    targetFile: 'math.ts',
  },
  {
    name: 'should handle zero',
    description: 'Tests the add function with zero',
    code: 'it("should handle zero", () => { expect(add(0, 0)).toBe(0); });',
    targetFunction: 'add',
    targetFile: 'math.ts',
  },
];

const mockIntegrationTests = [
  {
    name: 'should call API and return data',
    description: 'Tests the API integration',
    code: 'it("should call API", async () => { const data = await fetchData(); expect(data).toBeDefined(); });',
    targetFunction: 'fetchData',
  },
];

const mockE2ETests = [
  {
    name: 'User can log in',
    description: 'End-to-end login workflow',
    steps: ['Navigate to /login', 'Enter credentials', 'Click submit'],
    expectedResult: 'User is redirected to dashboard',
    code: '',
  },
];

beforeEach(() => {
  // resetAllMocks clears both call history AND the implementation/queue, so
  // mockResolvedValueOnce queues from one test cannot bleed into the next.
  vi.resetAllMocks();

  (llmRouter.routeAndExecute as any)
    .mockResolvedValueOnce({ content: JSON.stringify({ tests: mockUnitTests }) })
    .mockResolvedValueOnce({ content: JSON.stringify({ tests: mockIntegrationTests }) })
    .mockResolvedValueOnce({ content: JSON.stringify({ tests: mockE2ETests }) });

  (securityTestGenerationService.generateTestSuite as any).mockResolvedValue({
    testCases: [],
  });

  (performanceTestGenerationService.generateTestSuite as any).mockResolvedValue({
    tests: [],
  });
});

describe('TestGenerationService', () => {
  describe('generateTestSuite', () => {
    it('should return a TestSuite with all test arrays populated', async () => {
      const suite = await testGenerationService.generateTestSuite('function add(a,b){return a+b;}');

      expect(suite).toBeDefined();
      expect(Array.isArray(suite.unitTests)).toBe(true);
      expect(Array.isArray(suite.integrationTests)).toBe(true);
      expect(Array.isArray(suite.e2eTests)).toBe(true);
    });

    it('should populate unitTests from LLM response', async () => {
      const suite = await testGenerationService.generateTestSuite('function add(a,b){return a+b;}');

      expect(suite.unitTests).toHaveLength(2);
      expect(suite.unitTests[0].name).toBe('should add two numbers');
      expect(suite.unitTests[0].targetFunction).toBe('add');
    });

    it('should populate integrationTests from LLM response', async () => {
      const suite = await testGenerationService.generateTestSuite('async function fetchData(){}');

      expect(suite.integrationTests).toHaveLength(1);
      expect(suite.integrationTests[0].name).toBe('should call API and return data');
    });

    it('should populate e2eTests from LLM response', async () => {
      const suite = await testGenerationService.generateTestSuite('function login(){}');

      expect(suite.e2eTests).toHaveLength(1);
      expect(suite.e2eTests[0].steps).toHaveLength(3);
      expect(suite.e2eTests[0].expectedResult).toBe('User is redirected to dashboard');
    });

    it('should default testFramework to jest for TypeScript', async () => {
      const suite = await testGenerationService.generateTestSuite('const x = 1;', { language: 'typescript' });

      expect(suite.testFramework).toBe('jest');
    });

    it('should set testFramework to pytest for Python', async () => {
      (llmRouter.routeAndExecute as any)
        .mockResolvedValueOnce({ content: JSON.stringify({ tests: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ tests: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ tests: [] }) });

      const suite = await testGenerationService.generateTestSuite('def add(a, b): return a + b', {
        language: 'python',
      });

      expect(suite.testFramework).toBe('pytest');
    });

    it('should honour a custom framework option', async () => {
      (llmRouter.routeAndExecute as any)
        .mockResolvedValue({ content: JSON.stringify({ tests: [] }) });

      const suite = await testGenerationService.generateTestSuite('const x = 1;', {
        framework: 'mocha',
      });

      expect(suite.testFramework).toBe('mocha');
    });

    it('should only generate unit tests when testTypes is ["unit"]', async () => {
      (llmRouter.routeAndExecute as any).mockResolvedValue({
        content: JSON.stringify({ tests: mockUnitTests }),
      });

      const suite = await testGenerationService.generateTestSuite('function add(a,b){return a+b;}', {
        testTypes: ['unit'],
      });

      expect(suite.unitTests).toHaveLength(2);
      expect(suite.integrationTests).toHaveLength(0);
      expect(suite.e2eTests).toHaveLength(0);
    });

    it('should estimate coverage based on total test count', async () => {
      const suite = await testGenerationService.generateTestSuite('function add(a,b){return a+b;}');

      // 2 unit + 1 integration + 1 e2e = 4 tests → estimated = 30
      expect(suite.coverage.estimated).toBe(30);
    });

    it('should collect targetFile paths into coverage.files', async () => {
      const suite = await testGenerationService.generateTestSuite('function add(a,b){return a+b;}');

      expect(suite.coverage.files).toContain('math.ts');
    });

    it('should return empty suite when LLM throws', async () => {
      vi.resetAllMocks();
      (llmRouter.routeAndExecute as any).mockRejectedValue(new Error('LLM down'));
      (securityTestGenerationService.generateTestSuite as any).mockResolvedValue({ testCases: [] });
      (performanceTestGenerationService.generateTestSuite as any).mockResolvedValue({ tests: [] });

      const suite = await testGenerationService.generateTestSuite('function add(){}');

      expect(suite.unitTests).toHaveLength(0);
      expect(suite.integrationTests).toHaveLength(0);
      expect(suite.e2eTests).toHaveLength(0);
      expect(suite.coverage.estimated).toBe(0);
    });

    it('should call llmRouter for each requested test type', async () => {
      await testGenerationService.generateTestSuite('const x = 1;', {
        testTypes: ['unit', 'integration', 'e2e'],
      });

      expect(llmRouter.routeAndExecute).toHaveBeenCalledTimes(3);
    });

    it('should return performanceTests array', async () => {
      const suite = await testGenerationService.generateTestSuite('function add(){}');

      expect(Array.isArray(suite.performanceTests)).toBe(true);
    });

    it('should include coverage.estimated of 100 for 30+ tests', async () => {
      const manyTests = Array.from({ length: 16 }, (_, i) => ({
        name: `test ${i}`,
        description: `desc ${i}`,
        code: `it("test ${i}", () => {});`,
      }));

      vi.resetAllMocks();
      (llmRouter.routeAndExecute as any)
        .mockResolvedValueOnce({ content: JSON.stringify({ tests: manyTests }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ tests: manyTests }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ tests: [] }) });
      (securityTestGenerationService.generateTestSuite as any).mockResolvedValue({ testCases: [] });
      (performanceTestGenerationService.generateTestSuite as any).mockResolvedValue({ tests: [] });

      const suite = await testGenerationService.generateTestSuite('function add(){}');

      // 16 unit + 16 integration + 0 e2e = 32 → estimated 100
      expect(suite.coverage.estimated).toBe(100);
    });
  });

  describe('generateTestFile', () => {
    it('should wrap test code with framework header comment', async () => {
      const testCase = {
        name: 'my test',
        description: 'tests something',
        code: 'it("my test", () => {});',
        type: 'unit' as const,
      };

      const result = await testGenerationService.generateTestFile(testCase, 'jest');

      expect(result).toContain('jest');
      expect(result).toContain('my test');
      expect(result).toContain('it("my test", () => {});');
    });
  });

  describe('generateTestConfig', () => {
    it('should return jest.config.js for jest framework', async () => {
      const configs = await testGenerationService.generateTestConfig('jest', 'typescript');

      expect(configs['jest.config.js']).toBeDefined();
      expect(configs['jest.config.js']).toContain('coverageThreshold');
    });

    it('should return pytest.ini for pytest framework', async () => {
      const configs = await testGenerationService.generateTestConfig('pytest', 'python');

      expect(configs['pytest.ini']).toBeDefined();
      expect(configs['pytest.ini']).toContain('[pytest]');
    });

    it('should return empty object for unknown framework', async () => {
      const configs = await testGenerationService.generateTestConfig('unknown', 'go');

      expect(Object.keys(configs)).toHaveLength(0);
    });
  });
});
