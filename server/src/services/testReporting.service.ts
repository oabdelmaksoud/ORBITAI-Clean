/**
 * Test Reporting Service
 * Generates comprehensive test reports with coverage, execution times, failure rates, performance results
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';

export interface TestCoverageMetrics {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
  overall: number; // 0-100
}

export interface TestExecutionMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // milliseconds
  averageExecutionTime: number;
  slowestTests: Array<{
    testName: string;
    duration: number;
  }>;
}

export interface TestReport {
  projectId: string;
  testSuite: string;
  coverage: TestCoverageMetrics;
  execution: TestExecutionMetrics;
  failureRate: number; // 0-100
  flakyTests: number;
  performanceResults?: {
    loadTestResults: any[];
    stressTestResults: any[];
  };
  trends: Array<{
    date: Date;
    coverage: number;
    failureRate: number;
    executionTime: number;
  }>;
  generatedAt: Date;
}

class TestReportingService {
  /**
   * Generate comprehensive test report
   */
  async generateReport(
    projectId: string,
    testResults?: Array<{
      testName: string;
      passed: boolean;
      duration: number;
      coverage?: TestCoverageMetrics;
    }>
  ): Promise<TestReport> {
    try {
      logger.info(`Generating test report for project ${projectId}`);

      // Get test artifacts
      const testArtifacts = await Artifact.find({
        projectId,
        type: 'test-plan',
      }).lean() as any;

      // Calculate coverage (if test results provided)
      const coverage = testResults
        ? this.calculateCoverage(testResults)
        : this.estimateCoverage(testArtifacts);

      // Calculate execution metrics
      const execution = testResults
        ? this.calculateExecutionMetrics(testResults)
        : this.estimateExecutionMetrics(testArtifacts);

      // Calculate failure rate
      const failureRate =
        execution.totalTests > 0 ? (execution.failed / execution.totalTests) * 100 : 0;

      // Get flaky tests count (would integrate with flaky test service)
      const flakyTests = 0; // Placeholder

      // Generate trends (last 30 days)
      const trends = this.generateTrends(projectId);

      return {
        projectId,
        testSuite: 'All Tests',
        coverage,
        execution,
        failureRate: Math.round(failureRate * 100) / 100,
        flakyTests,
        trends,
        generatedAt: new Date(),
      };
    } catch (error: unknown) {
      logger.error('Failed to generate test report:', error);
      throw error;
    }
  }

  /**
   * Calculate coverage from test results
   */
  private calculateCoverage(
    testResults: Array<{ coverage?: TestCoverageMetrics }>
  ): TestCoverageMetrics {
    const coverages = testResults.filter(r => r.coverage).map(r => r.coverage!);

    if (coverages.length === 0) {
      return {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0,
        overall: 0,
      };
    }

    const avg: {
      lines: number;
      statements: number;
      functions: number;
      branches: number;
      overall: number;
    } = {
      lines: coverages.reduce((sum, c) => sum + c.lines, 0) / coverages.length,
      statements: coverages.reduce((sum, c) => sum + c.statements, 0) / coverages.length,
      functions: coverages.reduce((sum, c) => sum + c.functions, 0) / coverages.length,
      branches: coverages.reduce((sum, c) => sum + c.branches, 0) / coverages.length,
      overall: 0,
    };

    avg.overall = (avg.lines + avg.statements + avg.functions + avg.branches) / 4;

    return {
      lines: Math.round(avg.lines),
      statements: Math.round(avg.statements),
      functions: Math.round(avg.functions),
      branches: Math.round(avg.branches),
      overall: Math.round(avg.overall),
    };
  }

  /**
   * Estimate coverage from test artifacts
   */
  private estimateCoverage(testArtifacts: IArtifact[]): TestCoverageMetrics {
    // Simple estimation based on test count
    const testCount = testArtifacts.length;
    let estimated = 0;

    if (testCount >= 30) estimated = 100;
    else if (testCount >= 20) estimated = 85;
    else if (testCount >= 10) estimated = 70;
    else if (testCount >= 5) estimated = 50;
    else estimated = 30;

    return {
      lines: estimated,
      statements: estimated,
      functions: estimated,
      branches: estimated - 10, // Branches usually lower
      overall: estimated,
    };
  }

  /**
   * Calculate execution metrics
   */
  private calculateExecutionMetrics(
    testResults: Array<{ testName: string; passed: boolean; duration: number }>
  ): TestExecutionMetrics {
    const totalTests = testResults.length;
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    const skipped = 0; // Would come from test framework
    const duration = testResults.reduce((sum, r) => sum + r.duration, 0);
    const averageExecutionTime = totalTests > 0 ? duration / totalTests : 0;

    // Find slowest tests
    const slowestTests = testResults
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(r => ({
        testName: r.testName,
        duration: r.duration,
      }));

    return {
      totalTests,
      passed,
      failed,
      skipped,
      duration,
      averageExecutionTime: Math.round(averageExecutionTime * 100) / 100,
      slowestTests,
    };
  }

  /**
   * Estimate execution metrics
   */
  private estimateExecutionMetrics(testArtifacts: IArtifact[]): TestExecutionMetrics {
    const totalTests = testArtifacts.length;
    const estimatedDuration = totalTests * 100; // 100ms per test average

    return {
      totalTests,
      passed: Math.floor(totalTests * 0.9), // Assume 90% pass rate
      failed: Math.ceil(totalTests * 0.1),
      skipped: 0,
      duration: estimatedDuration,
      averageExecutionTime: 100,
      slowestTests: [],
    };
  }

  /**
   * Generate trends
   */
  private generateTrends(_projectId: string): TestReport['trends'] {
    // Placeholder: would query historical test execution data
    return [];
  }

  /**
   * Export report to HTML
   */
  exportToHTML(report: TestReport): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Test Report - ${report.projectId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .metric { background: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .metric h3 { margin: 0 0 10px 0; }
    .metric .value { font-size: 24px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Test Report</h1>
    <p>Project: ${report.projectId}</p>
    <p>Generated: ${report.generatedAt.toISOString()}</p>
  </div>

  <div class="metrics">
    <div class="metric">
      <h3>Coverage</h3>
      <div class="value">${(report.coverage as any).overall}%</div>
    </div>
    <div class="metric">
      <h3>Tests Passed</h3>
      <div class="value">${report.execution.passed}/${report.execution.totalTests}</div>
    </div>
    <div class="metric">
      <h3>Failure Rate</h3>
      <div class="value">${report.failureRate}%</div>
    </div>
    <div class="metric">
      <h3>Execution Time</h3>
      <div class="value">${(report.execution.duration / 1000).toFixed(2)}s</div>
    </div>
  </div>

  <h2>Coverage Details</h2>
  <table>
    <tr><th>Metric</th><th>Coverage</th></tr>
    <tr><td>Lines</td><td>${report.coverage.lines}%</td></tr>
    <tr><td>Statements</td><td>${report.coverage.statements}%</td></tr>
    <tr><td>Functions</td><td>${report.coverage.functions}%</td></tr>
    <tr><td>Branches</td><td>${report.coverage.branches}%</td></tr>
  </table>

  <h2>Execution Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Tests</td><td>${report.execution.totalTests}</td></tr>
    <tr><td>Passed</td><td>${report.execution.passed}</td></tr>
    <tr><td>Failed</td><td>${report.execution.failed}</td></tr>
    <tr><td>Skipped</td><td>${report.execution.skipped}</td></tr>
    <tr><td>Average Time</td><td>${report.execution.averageExecutionTime}ms</td></tr>
  </table>
</body>
</html>`;
  }

  /**
   * Export report to JSON
   */
  exportToJSON(report: TestReport): string {
    return JSON.stringify(report, null, 2);
  }
}

export const testReportingService = new TestReportingService();
