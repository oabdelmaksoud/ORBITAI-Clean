/**
 * Test Reporting Service Tests
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

vi.mock('../../models/Artifact.model.js', () => ({
  Artifact: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

import { testReportingService, TestReport, TestCoverageMetrics } from '../../services/testReporting.service.js';
import { Artifact } from '../../models/Artifact.model.js';

const makeArtifact = (overrides = {}) => ({
  _id: 'artifact-1',
  title: 'Test Plan 1',
  content: 'test content',
  type: 'test-plan',
  projectId: 'proj-1',
  ...overrides,
});

const makeTestResult = (overrides = {}) => ({
  testName: 'should work',
  passed: true,
  duration: 100,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  (Artifact.find as any).mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
});

describe('TestReportingService', () => {
  describe('generateReport', () => {
    it('should return a TestReport with required fields', async () => {
      const report = await testReportingService.generateReport('proj-1');

      expect(report).toHaveProperty('projectId', 'proj-1');
      expect(report).toHaveProperty('coverage');
      expect(report).toHaveProperty('execution');
      expect(report).toHaveProperty('failureRate');
      expect(report).toHaveProperty('generatedAt');
    });

    it('should query Artifact model for test-plan artifacts', async () => {
      await testReportingService.generateReport('proj-abc');

      expect(Artifact.find).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-abc', type: 'test-plan' })
      );
    });

    it('should compute execution metrics from provided testResults', async () => {
      const results = [
        makeTestResult({ passed: true, duration: 200 }),
        makeTestResult({ testName: 'failing test', passed: false, duration: 50 }),
      ];

      const report = await testReportingService.generateReport('proj-1', results);

      expect(report.execution.totalTests).toBe(2);
      expect(report.execution.passed).toBe(1);
      expect(report.execution.failed).toBe(1);
    });

    it('should calculate failureRate as a percentage', async () => {
      const results = [
        makeTestResult({ passed: false }),
        makeTestResult({ passed: false }),
        makeTestResult({ passed: true }),
        makeTestResult({ passed: true }),
      ];

      const report = await testReportingService.generateReport('proj-1', results);

      expect(report.failureRate).toBe(50);
    });

    it('should produce zero failureRate when all tests pass', async () => {
      const results = [makeTestResult(), makeTestResult(), makeTestResult()];

      const report = await testReportingService.generateReport('proj-1', results);

      expect(report.failureRate).toBe(0);
    });

    it('should average coverage from testResults that have coverage', async () => {
      const cov: TestCoverageMetrics = { lines: 80, statements: 80, functions: 80, branches: 60, overall: 75 };
      const results = [
        makeTestResult({ coverage: cov }),
        makeTestResult({ coverage: cov }),
      ];

      const report = await testReportingService.generateReport('proj-1', results);

      expect(report.coverage.lines).toBe(80);
      expect(report.coverage.overall).toBe(75);
    });

    it('should return zero coverage when no testResult has coverage data', async () => {
      const results = [makeTestResult(), makeTestResult()];

      const report = await testReportingService.generateReport('proj-1', results);

      expect(report.coverage.overall).toBe(0);
    });

    it('should estimate metrics from artifacts when testResults is omitted', async () => {
      const artifacts = [makeArtifact(), makeArtifact({ _id: 'artifact-2' })];
      (Artifact.find as any).mockReturnValue({ lean: vi.fn().mockResolvedValue(artifacts) });

      const report = await testReportingService.generateReport('proj-1');

      // 2 artifacts → 90% pass rate heuristic (totalTests = 2)
      expect(report.execution.totalTests).toBe(2);
    });

    it('should include slowest tests ranked by duration', async () => {
      const results = [
        makeTestResult({ testName: 'fast', duration: 10 }),
        makeTestResult({ testName: 'slow', duration: 500 }),
        makeTestResult({ testName: 'medium', duration: 200 }),
      ];

      const report = await testReportingService.generateReport('proj-1', results);

      expect(report.execution.slowestTests[0].testName).toBe('slow');
      expect(report.execution.slowestTests[0].duration).toBe(500);
    });

    it('should set generatedAt to a recent Date', async () => {
      const before = Date.now();
      const report = await testReportingService.generateReport('proj-1');
      const after = Date.now();

      expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(report.generatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should propagate errors thrown by Artifact.find', async () => {
      (Artifact.find as any).mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error('DB error')),
      });

      await expect(testReportingService.generateReport('proj-fail')).rejects.toThrow('DB error');
    });

    it('should include an empty trends array', async () => {
      const report = await testReportingService.generateReport('proj-1');

      expect(Array.isArray(report.trends)).toBe(true);
    });
  });

  describe('exportToHTML', () => {
    const buildReport = (): TestReport => ({
      projectId: 'proj-html',
      testSuite: 'All Tests',
      coverage: { lines: 90, statements: 88, functions: 95, branches: 75, overall: 87 },
      execution: {
        totalTests: 10,
        passed: 9,
        failed: 1,
        skipped: 0,
        duration: 2000,
        averageExecutionTime: 200,
        slowestTests: [{ testName: 'slow', duration: 800 }],
      },
      failureRate: 10,
      flakyTests: 0,
      trends: [],
      generatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    it('should return a string containing HTML doctype', () => {
      const html = testReportingService.exportToHTML(buildReport());

      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should embed the projectId in the HTML', () => {
      const html = testReportingService.exportToHTML(buildReport());

      expect(html).toContain('proj-html');
    });

    it('should display overall coverage percentage', () => {
      const html = testReportingService.exportToHTML(buildReport());

      expect(html).toContain('87%');
    });

    it('should display passed/total test counts', () => {
      const html = testReportingService.exportToHTML(buildReport());

      expect(html).toContain('9/10');
    });

    it('should display all coverage metric rows', () => {
      const html = testReportingService.exportToHTML(buildReport());

      expect(html).toContain('Lines');
      expect(html).toContain('Statements');
      expect(html).toContain('Functions');
      expect(html).toContain('Branches');
    });
  });

  describe('exportToJSON', () => {
    it('should return valid JSON string', async () => {
      const report = await testReportingService.generateReport('proj-1');
      const json = testReportingService.exportToJSON(report);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should contain the projectId in serialised output', async () => {
      const report = await testReportingService.generateReport('proj-json');
      const json = testReportingService.exportToJSON(report);
      const parsed = JSON.parse(json);

      expect(parsed.projectId).toBe('proj-json');
    });

    it('should pretty-print with indentation', async () => {
      const report = await testReportingService.generateReport('proj-1');
      const json = testReportingService.exportToJSON(report);

      // Pretty-printed JSON contains newlines
      expect(json).toContain('\n');
    });
  });
});
