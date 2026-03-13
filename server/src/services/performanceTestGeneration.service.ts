/**
 * Performance Test Generation Service
 * Generates load, stress, spike, and endurance tests
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export interface PerformanceTest {
  id: string;
  type: 'load' | 'stress' | 'spike' | 'endurance';
  title: string;
  description: string;
  testCode: string;
  tool: 'k6' | 'artillery' | 'jmeter' | 'custom';
  configuration: {
    virtualUsers: number;
    duration: string;
    rampUp?: string;
    targetEndpoint?: string;
    scenarios: Array<{
      name: string;
      weight: number;
      requests: Array<{
        method: string;
        url: string;
        headers?: Record<string, string>;
        body?: any;
      }>;
    }>;
  };
  expectedMetrics: {
    responseTime: { p50: number; p95: number; p99: number };
    throughput: number;
    errorRate: number;
  };
}

export interface PerformanceTestSuite {
  projectId: string;
  tests: PerformanceTest[];
  summary: {
    loadTests: number;
    stressTests: number;
    spikeTests: number;
    enduranceTests: number;
    total: number;
  };
  generatedAt: Date;
}

class PerformanceTestGenerationService {
  /**
   * Generate performance test suite
   */
  async generateTestSuite(
    code: string,
    language: string,
    endpoints: Array<{ method: string; path: string; parameters: string[] }>,
    nfrRequirements?: Array<{ type: string; target: string; unit: string }>
  ): Promise<PerformanceTestSuite> {
    try {
      logger.info(`Generating performance test suite for ${endpoints.length} endpoints`);

      const tests: PerformanceTest[] = [];

      // Generate load tests
      const loadTests = await this.generateLoadTests(endpoints, nfrRequirements);
      tests.push(...loadTests);

      // Generate stress tests
      const stressTests = await this.generateStressTests(endpoints);
      tests.push(...stressTests);

      // Generate spike tests
      const spikeTests = await this.generateSpikeTests(endpoints);
      tests.push(...spikeTests);

      // Generate endurance tests
      const enduranceTests = await this.generateEnduranceTests(endpoints);
      tests.push(...enduranceTests);

      return {
        projectId: '', // Will be set by caller
        tests,
        summary: {
          loadTests: loadTests.length,
          stressTests: stressTests.length,
          spikeTests: spikeTests.length,
          enduranceTests: enduranceTests.length,
          total: tests.length
        },
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to generate performance test suite:', error);
      throw error;
    }
  }

  /**
   * Generate load tests
   */
  private async generateLoadTests(
    endpoints: Array<{ method: string; path: string; parameters: string[] }>,
    nfrRequirements?: Array<{ type: string; target: string; unit: string }>
  ): Promise<PerformanceTest[]> {
    const tests: PerformanceTest[] = [];

    // Extract performance requirements
    const responseTimeReq = nfrRequirements?.find(r => 
      r.type === 'performance' && (r.unit.includes('ms') || r.unit.includes('s'))
    );
    const targetResponseTime = responseTimeReq 
      ? parseFloat(responseTimeReq.target) 
      : 200; // Default 200ms

    const throughputReq = nfrRequirements?.find(r => 
      r.type === 'performance' && (r.unit.includes('req/s') || r.unit.includes('rps'))
    );
    const targetThroughput = throughputReq 
      ? parseFloat(throughputReq.target) 
      : 100; // Default 100 req/s

    for (const endpoint of endpoints) {
      const test = await this.generateLoadTestForEndpoint(endpoint, targetResponseTime, targetThroughput);
      if (test) {
        tests.push(test);
      }
    }

    return tests;
  }

  /**
   * Generate load test for endpoint
   */
  private async generateLoadTestForEndpoint(
    endpoint: { method: string; path: string; parameters: string[] },
    targetResponseTime: number,
    targetThroughput: number
  ): Promise<PerformanceTest | null> {
    const prompt = `Generate a k6 load test for the following API endpoint:

Endpoint: ${endpoint.method} ${endpoint.path}
Parameters: ${endpoint.parameters.join(', ')}

Requirements:
- Target response time: ${targetResponseTime}ms (p95)
- Target throughput: ${targetThroughput} requests/second
- Virtual users: ${Math.ceil(targetThroughput / 10)} (distributed over 30 seconds)
- Duration: 5 minutes

Generate k6 test code that:
1. Sets up the test configuration
2. Defines the load scenario
3. Makes requests to the endpoint
4. Validates response times
5. Collects and reports metrics

Return the complete k6 test code.`;

    try {
      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'test_generation',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        }
      });

      return {
        id: `load-${endpoint.path.replace(/\//g, '-')}`,
        type: 'load',
        title: `Load Test: ${endpoint.method} ${endpoint.path}`,
        description: `Load test targeting ${targetThroughput} req/s with ${targetResponseTime}ms response time`,
        testCode: response.content,
        tool: 'k6',
        configuration: {
          virtualUsers: Math.ceil(targetThroughput / 10),
          duration: '5m',
          rampUp: '30s',
          targetEndpoint: endpoint.path,
          scenarios: [{
            name: 'load_test',
            weight: 100,
            requests: [{
              method: endpoint.method,
              url: endpoint.path
            }]
          }]
        },
        expectedMetrics: {
          responseTime: {
            p50: targetResponseTime * 0.5,
            p95: targetResponseTime,
            p99: targetResponseTime * 1.5
          },
          throughput: targetThroughput,
          errorRate: 0.01 // 1% error rate target
        }
      };
    } catch (error: unknown) {
      logger.warn(`Failed to generate load test for ${endpoint.path}:`, error.message);
      return null;
    }
  }

  /**
   * Generate stress tests
   */
  private async generateStressTests(
    endpoints: Array<{ method: string; path: string; parameters: string[] }>
  ): Promise<PerformanceTest[]> {
    const tests: PerformanceTest[] = [];

    // Stress test: gradually increase load until breaking point
    for (const endpoint of endpoints.slice(0, 3)) { // Limit to 3 stress tests
      tests.push({
        id: `stress-${endpoint.path.replace(/\//g, '-')}`,
        type: 'stress',
        title: `Stress Test: ${endpoint.method} ${endpoint.path}`,
        description: 'Gradually increase load to find breaking point',
        testCode: this.generateK6StressTest(endpoint),
        tool: 'k6',
        configuration: {
          virtualUsers: 100, // Start with 100, ramp up
          duration: '10m',
          rampUp: '5m',
          targetEndpoint: endpoint.path,
          scenarios: [{
            name: 'stress_test',
            weight: 100,
            requests: [{
              method: endpoint.method,
              url: endpoint.path
            }]
          }]
        },
        expectedMetrics: {
          responseTime: { p50: 500, p95: 2000, p99: 5000 },
          throughput: 0, // Will vary
          errorRate: 0.05 // 5% error rate acceptable under stress
        }
      });
    }

    return tests;
  }

  /**
   * Generate spike tests
   */
  private async generateSpikeTests(
    endpoints: Array<{ method: string; path: string; parameters: string[] }>
  ): Promise<PerformanceTest[]> {
    const tests: PerformanceTest[] = [];

    // Spike test: sudden load increase
    for (const endpoint of endpoints.slice(0, 2)) { // Limit to 2 spike tests
      tests.push({
        id: `spike-${endpoint.path.replace(/\//g, '-')}`,
        type: 'spike',
        title: `Spike Test: ${endpoint.method} ${endpoint.path}`,
        description: 'Sudden load spike to test system resilience',
        testCode: this.generateK6SpikeTest(endpoint),
        tool: 'k6',
        configuration: {
          virtualUsers: 500, // Sudden spike
          duration: '2m',
          rampUp: '10s', // Quick ramp up
          targetEndpoint: endpoint.path,
          scenarios: [{
            name: 'spike_test',
            weight: 100,
            requests: [{
              method: endpoint.method,
              url: endpoint.path
            }]
          }]
        },
        expectedMetrics: {
          responseTime: { p50: 1000, p95: 3000, p99: 5000 },
          throughput: 0,
          errorRate: 0.1 // 10% error rate acceptable during spike
        }
      });
    }

    return tests;
  }

  /**
   * Generate endurance tests
   */
  private async generateEnduranceTests(
    endpoints: Array<{ method: string; path: string; parameters: string[] }>
  ): Promise<PerformanceTest[]> {
    const tests: PerformanceTest[] = [];

    // Endurance test: long-running test
    for (const endpoint of endpoints.slice(0, 1)) { // One endurance test
      tests.push({
        id: `endurance-${endpoint.path.replace(/\//g, '-')}`,
        type: 'endurance',
        title: `Endurance Test: ${endpoint.method} ${endpoint.path}`,
        description: 'Long-running test to detect memory leaks and degradation',
        testCode: this.generateK6EnduranceTest(endpoint),
        tool: 'k6',
        configuration: {
          virtualUsers: 50,
          duration: '1h', // 1 hour
          rampUp: '5m',
          targetEndpoint: endpoint.path,
          scenarios: [{
            name: 'endurance_test',
            weight: 100,
            requests: [{
              method: endpoint.method,
              url: endpoint.path
            }]
          }]
        },
        expectedMetrics: {
          responseTime: { p50: 200, p95: 500, p99: 1000 },
          throughput: 10, // Steady throughput
          errorRate: 0.01 // 1% error rate
        }
      });
    }

    return tests;
  }

  /**
   * Generate k6 stress test code
   */
  private generateK6StressTest(endpoint: { method: string; path: string }): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '3m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.${endpoint.method.toLowerCase()}('${endpoint.path}');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  sleep(1);
}`;
  }

  /**
   * Generate k6 spike test code
   */
  private generateK6SpikeTest(endpoint: { method: string; path: string }): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '10s', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const res = http.${endpoint.method.toLowerCase()}('${endpoint.path}');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}`;
  }

  /**
   * Generate k6 endurance test code
   */
  private generateK6EnduranceTest(endpoint: { method: string; path: string }): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const responseTime = new Trend('response_time');
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '50m', target: 50 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    response_time: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  const res = http.${endpoint.method.toLowerCase()}('${endpoint.path}');
  
  responseTime.add(res.timings.duration);
  errorRate.add(res.status !== 200);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time stable': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}`;
  }
}

export const performanceTestGenerationService = new PerformanceTestGenerationService();



