/**
 * Model Benchmark Service
 * Run benchmarks against LLM models to compare performance and quality
 */

import { BenchmarkResult, IBenchmarkResult } from '../models/BenchmarkResult.model.js';
import { modelRegistry } from './llm/models/ModelRegistry.js';
import { logger } from '../utils/logger.js';

export interface BenchmarkPrompt {
  id: string;
  taskType: string;
  prompt: string;
  expectedOutput?: string;
  evaluationCriteria: string[];
}

export interface BenchmarkConfig {
  modelId: string;
  taskType: string;
  timeoutMs?: number;
  iterations?: number;
}

export interface BenchmarkSummary {
  modelId: string;
  provider: string;
  taskType: string;
  avgLatency: number;
  avgCost: number;
  avgQualityScore: number;
  successRate: number;
  totalRuns: number;
  lastRun: Date;
}

export interface ModelComparison {
  taskType: string;
  models: Array<{
    modelId: string;
    provider: string;
    avgLatency: number;
    avgCost: number;
    avgQualityScore: number;
    rank: number;
    bestFor: string[];
  }>;
}

// Predefined benchmark prompts by task type
const BENCHMARK_PROMPTS: Record<string, BenchmarkPrompt[]> = {
  'code-generation': [
    {
      id: 'code-1',
      taskType: 'code-generation',
      prompt: 'Write a TypeScript function that implements a binary search algorithm. Include proper typing and comments.',
      expectedOutput: 'function binarySearch',
      evaluationCriteria: ['correctness', 'typing', 'comments', 'efficiency']
    },
    {
      id: 'code-2',
      taskType: 'code-generation',
      prompt: 'Create a React component that displays a paginated list with sorting capabilities. Use TypeScript.',
      expectedOutput: 'const PaginatedList',
      evaluationCriteria: ['correctness', 'react-patterns', 'typing', 'readability']
    }
  ],
  'analysis': [
    {
      id: 'analysis-1',
      taskType: 'analysis',
      prompt: 'Analyze the following code for potential bugs and security vulnerabilities:\n```javascript\nfunction processUser(input) {\n  eval(input);\n  return db.query("SELECT * FROM users WHERE id = " + input);\n}\n```',
      evaluationCriteria: ['completeness', 'accuracy', 'security-awareness']
    }
  ],
  'documentation': [
    {
      id: 'doc-1',
      taskType: 'documentation',
      prompt: 'Write comprehensive JSDoc documentation for this function:\n```typescript\nasync function fetchUserData(userId: string, options?: { includeHistory?: boolean; limit?: number }) {\n  // Implementation details...\n}\n```',
      evaluationCriteria: ['completeness', 'accuracy', 'format-compliance']
    }
  ],
  'chat': [
    {
      id: 'chat-1',
      taskType: 'chat',
      prompt: 'You are a helpful AI assistant. A user asks: "How do I implement authentication in a Node.js application?" Provide a concise but helpful response.',
      evaluationCriteria: ['helpfulness', 'accuracy', 'conciseness']
    }
  ],
  'structured-output': [
    {
      id: 'struct-1',
      taskType: 'structured-output',
      prompt: 'Extract the following information from this text and return as JSON: "John Smith, age 35, works at Acme Corp as a Senior Engineer since 2019. His email is john.smith@acme.com"\n\nReturn JSON with fields: name, age, company, title, startYear, email',
      expectedOutput: '{"name":"John Smith"',
      evaluationCriteria: ['format-compliance', 'accuracy', 'completeness']
    }
  ]
};

class ModelBenchmarkService {
  private runningBenchmarks: Set<string> = new Set();

  /**
   * Run a benchmark for a specific model and task type
   */
  async runBenchmark(config: BenchmarkConfig): Promise<IBenchmarkResult> {
    const { modelId, taskType, timeoutMs = 30000, iterations = 1 } = config;
    
    const benchmarkKey = `${modelId}-${taskType}`;
    if (this.runningBenchmarks.has(benchmarkKey)) {
      throw new Error('Benchmark already running for this model/task combination');
    }

    this.runningBenchmarks.add(benchmarkKey);

    try {
      const model = modelRegistry.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      const prompts = BENCHMARK_PROMPTS[taskType];
      if (!prompts || prompts.length === 0) {
        throw new Error(`No benchmark prompts available for task type: ${taskType}`);
      }

      // Select a random prompt
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];

      // Simulate benchmark execution (in production, this would call the actual LLM)
      const startTime = Date.now();
      
      // Simulate response time based on model characteristics
      const baseLatency = model.performance.avgLatencyMs;
      const latencyVariation = baseLatency * 0.2; // 20% variation
      const simulatedLatency = baseLatency + (Math.random() - 0.5) * latencyVariation;
      
      await new Promise(resolve => setTimeout(resolve, Math.min(simulatedLatency, 2000)));
      
      const endTime = Date.now();
      const actualLatency = endTime - startTime;

      // Simulate token counts
      const inputTokens = Math.floor(prompt.prompt.length / 4);
      const outputTokens = Math.floor(Math.random() * 500) + 100;

      // Calculate cost
      const inputCost = (inputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens;
      const outputCost = (outputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens;
      const totalCost = inputCost + outputCost;

      // Simulate quality score based on model reliability
      const baseQuality = model.performance.reliability * 100;
      const qualityVariation = 10;
      const qualityScore = Math.min(100, Math.max(0, 
        baseQuality + (Math.random() - 0.5) * qualityVariation
      ));

      // Create benchmark result
      const result = await BenchmarkResult.create({
        modelId,
        provider: model.provider,
        taskType,
        latency: actualLatency,
        timeToFirstToken: Math.floor(actualLatency * 0.2),
        tokensPerSecond: outputTokens / (actualLatency / 1000),
        cost: totalCost,
        inputTokens,
        outputTokens,
        qualityScore,
        coherenceScore: qualityScore + (Math.random() - 0.5) * 5,
        accuracyScore: qualityScore + (Math.random() - 0.5) * 5,
        formatComplianceScore: qualityScore + (Math.random() - 0.5) * 5,
        benchmarkPrompt: prompt.prompt,
        expectedOutput: prompt.expectedOutput,
        actualOutput: '[Simulated output for benchmark]',
        status: 'success',
        timestamp: new Date()
      });

      logger.info(`[ModelBenchmark] Completed benchmark for ${modelId} on ${taskType}`);
      return result;
    } catch (error: any) {
      logger.error(`[ModelBenchmark] Benchmark failed for ${modelId}:`, error);
      
      // Create failure record
      const model = modelRegistry.getModel(modelId);
      const result = await BenchmarkResult.create({
        modelId,
        provider: model?.provider || 'unknown',
        taskType,
        latency: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        qualityScore: 0,
        benchmarkPrompt: BENCHMARK_PROMPTS[taskType]?.[0]?.prompt || '',
        status: 'failure',
        errorMessage: error.message,
        timestamp: new Date()
      });

      return result;
    } finally {
      this.runningBenchmarks.delete(benchmarkKey);
    }
  }

  /**
   * Get benchmark results for a model
   */
  async getBenchmarkResults(
    modelId?: string,
    taskType?: string,
    limit: number = 50
  ): Promise<IBenchmarkResult[]> {
    const query: any = {};
    if (modelId) query.modelId = modelId;
    if (taskType) query.taskType = taskType;

    return BenchmarkResult.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get benchmark summary for a model
   */
  async getBenchmarkSummary(modelId: string, taskType?: string): Promise<BenchmarkSummary[]> {
    const matchStage: any = { modelId, status: 'success' };
    if (taskType) matchStage.taskType = taskType;

    const results = await BenchmarkResult.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { modelId: '$modelId', provider: '$provider', taskType: '$taskType' },
          avgLatency: { $avg: '$latency' },
          avgCost: { $avg: '$cost' },
          avgQualityScore: { $avg: '$qualityScore' },
          totalRuns: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          lastRun: { $max: '$timestamp' }
        }
      }
    ]);

    return results.map(r => ({
      modelId: r._id.modelId,
      provider: r._id.provider,
      taskType: r._id.taskType,
      avgLatency: Math.round(r.avgLatency),
      avgCost: r.avgCost,
      avgQualityScore: Math.round(r.avgQualityScore),
      successRate: r.totalRuns > 0 ? (r.successCount / r.totalRuns) * 100 : 0,
      totalRuns: r.totalRuns,
      lastRun: r.lastRun
    }));
  }

  /**
   * Compare models for a specific task type
   */
  async compareModels(taskType: string): Promise<ModelComparison> {
    const results = await BenchmarkResult.aggregate([
      { $match: { taskType, status: 'success' } },
      {
        $group: {
          _id: { modelId: '$modelId', provider: '$provider' },
          avgLatency: { $avg: '$latency' },
          avgCost: { $avg: '$cost' },
          avgQualityScore: { $avg: '$qualityScore' },
          totalRuns: { $sum: 1 }
        }
      },
      { $match: { totalRuns: { $gte: 1 } } } // At least 1 run
    ]);

    // Calculate composite score and rank
    const models = results.map(r => {
      // Normalize metrics (0-1 scale, higher is better)
      const maxLatency = Math.max(...results.map(x => x.avgLatency), 1);
      const maxCost = Math.max(...results.map(x => x.avgCost), 0.001);
      
      const latencyScore = 1 - (r.avgLatency / maxLatency);
      const costScore = 1 - (r.avgCost / maxCost);
      const qualityScore = r.avgQualityScore / 100;
      
      // Weighted composite score
      const compositeScore = latencyScore * 0.3 + costScore * 0.3 + qualityScore * 0.4;
      
      // Determine what this model is best for
      const bestFor: string[] = [];
      if (latencyScore > 0.8) bestFor.push('speed');
      if (costScore > 0.8) bestFor.push('cost-efficiency');
      if (qualityScore > 0.9) bestFor.push('quality');

      return {
        modelId: r._id.modelId,
        provider: r._id.provider,
        avgLatency: Math.round(r.avgLatency),
        avgCost: r.avgCost,
        avgQualityScore: Math.round(r.avgQualityScore),
        compositeScore,
        bestFor
      };
    });

    // Sort by composite score and assign ranks
    models.sort((a, b) => b.compositeScore - a.compositeScore);
    const rankedModels = models.map((m, idx) => ({
      ...m,
      rank: idx + 1
    }));

    return {
      taskType,
      models: rankedModels
    };
  }

  /**
   * Get historical trends for a model
   */
  async getHistoricalTrends(
    modelId: string,
    taskType: string,
    days: number = 30
  ): Promise<Array<{
    date: string;
    avgLatency: number;
    avgCost: number;
    avgQualityScore: number;
    runs: number;
  }>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const results = await BenchmarkResult.aggregate([
      {
        $match: {
          modelId,
          taskType,
          status: 'success',
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          avgLatency: { $avg: '$latency' },
          avgCost: { $avg: '$cost' },
          avgQualityScore: { $avg: '$qualityScore' },
          runs: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return results.map(r => ({
      date: r._id,
      avgLatency: Math.round(r.avgLatency),
      avgCost: r.avgCost,
      avgQualityScore: Math.round(r.avgQualityScore),
      runs: r.runs
    }));
  }

  /**
   * Get available task types for benchmarking
   */
  getAvailableTaskTypes(): string[] {
    return Object.keys(BENCHMARK_PROMPTS);
  }

  /**
   * Check if a benchmark is currently running
   */
  isBenchmarkRunning(modelId: string, taskType: string): boolean {
    return this.runningBenchmarks.has(`${modelId}-${taskType}`);
  }
}

export const modelBenchmarkService = new ModelBenchmarkService();
export default modelBenchmarkService;

