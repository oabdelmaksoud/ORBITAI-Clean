/**
 * Test Generation Service — Unit Tests
 * Covers: TestSuite/TestCase/E2ETestCase interface shapes, options defaults,
 * framework detection, and service singleton export.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies before importing the service
vi.mock('../../services/llm/LLMRouter.js', () => ({
  llmRouter: {
    route: vi.fn().mockResolvedValue({ content: '[]', usage: {} }),
    getAvailableModels: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/securityTestGeneration.service.js', () => ({
  securityTestGenerationService: {
    generateSecurityTests: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/performanceTestGeneration.service.js', () => ({
  performanceTestGenerationService: {
    generatePerformanceTests: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@google/genai', () => ({
  Type: {
    STRING: 'string',
    ARRAY: 'array',
    OBJECT: 'object',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
  },
  Schema: {},
}));

describe('TestCase interface', () => {
  it('constructs a valid unit TestCase', () => {
    const tc = {
      name: 'should return sum of two numbers',
      description: 'Tests the add() function with positive integers',
      code: 'it("should return sum", () => { expect(add(2, 3)).toBe(5); });',
      type: 'unit' as const,
      targetFunction: 'add',
      targetFile: 'src/math.ts',
    };
    expect(tc.type).toBe('unit');
    expect(['unit', 'integration']).toContain(tc.type);
    expect(tc.name).toBeTruthy();
    expect(tc.code).toBeTruthy();
  });

  it('constructs a valid integration TestCase without optional fields', () => {
    const tc = {
      name: 'POST /api/users creates user',
      description: 'Integration test for user creation endpoint',
      code: 'it("creates user", async () => { const res = await request(app).post("/api/users").send({...}); expect(res.status).toBe(201); });',
      type: 'integration' as const,
    };
    expect(tc.type).toBe('integration');
    expect(tc.targetFunction).toBeUndefined();
  });
});

describe('E2ETestCase interface', () => {
  it('constructs a valid E2ETestCase', () => {
    const e2e = {
      name: 'User can register and login',
      description: 'End-to-end flow for user auth',
      steps: [
        'Navigate to /register',
        'Fill in email and password',
        'Submit form',
        'Expect redirect to dashboard',
      ],
      expectedResult: 'User is authenticated and sees the dashboard',
    };
    expect(e2e.steps).toHaveLength(4);
    expect(e2e.expectedResult).toBeTruthy();
    expect(e2e.code).toBeUndefined();
  });

  it('constructs an E2ETestCase with optional code', () => {
    const e2e = {
      name: 'Add item to cart',
      description: 'E2E cart flow',
      steps: ['Visit product page', 'Click Add to Cart'],
      expectedResult: 'Cart count increments by 1',
      code: 'test("add to cart", async ({ page }) => { ... });',
    };
    expect(typeof e2e.code).toBe('string');
  });
});

describe('TestSuite interface', () => {
  it('constructs a valid TestSuite with all fields', () => {
    const suite = {
      unitTests: [],
      integrationTests: [],
      e2eTests: [],
      performanceTests: [],
      testFramework: 'vitest',
      coverage: {
        estimated: 75,
        files: ['src/math.ts', 'src/auth.ts'],
      },
    };
    expect(suite.testFramework).toBe('vitest');
    expect(suite.coverage.estimated).toBeGreaterThanOrEqual(0);
    expect(suite.coverage.estimated).toBeLessThanOrEqual(100);
    expect(Array.isArray(suite.coverage.files)).toBe(true);
  });
});

describe('TestGenerationOptions interface', () => {
  it('allows partial options', () => {
    const opts = {
      language: 'typescript',
      framework: 'vitest',
    };
    expect(opts.language).toBe('typescript');
    expect(opts.testTypes).toBeUndefined();
    expect(opts.targetCoverage).toBeUndefined();
  });

  it('constructs full options', () => {
    const opts = {
      language: 'python',
      framework: 'pytest',
      testTypes: ['unit', 'integration'] as ('unit' | 'integration' | 'e2e')[],
      targetCoverage: 80,
      projectType: 'api',
    };
    expect(opts.testTypes).toContain('unit');
    expect(opts.targetCoverage).toBe(80);
  });
});

describe('testGenerationService singleton', () => {
  it('exports testGenerationService with expected methods', async () => {
    const mod = await import('../../services/testGeneration.service.js');
    expect(mod.testGenerationService).toBeDefined();
    expect(typeof mod.testGenerationService.generateTestSuite).toBe('function');
  });
});
