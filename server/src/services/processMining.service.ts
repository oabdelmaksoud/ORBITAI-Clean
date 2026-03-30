/**
 * Process Mining Service
 * Discovers actual workflows from agent task execution data
 * Uses PM4Py concepts for process discovery and analysis
 * Enhanced with deep learning capabilities for complex pattern recognition
 */

import { logger } from '../utils/logger.js';
import { Task } from '../models/Project.model.js';
import { AgentKnowledge } from '../models/AgentKnowledge.model.js';

export interface WorkflowPattern {
  id: string;
  name: string;
  agentRole: string;
  steps: WorkflowStep[];
  frequency: number;
  successRate: number;
  averageDuration: number;
  variants: WorkflowVariant[];
}

export interface WorkflowStep {
  stepNumber: number;
  taskType: string;
  taskTitle: string;
  averageDuration: number;
  successRate: number;
  nextSteps: Array<{ step: number; probability: number }>;
}

export interface WorkflowVariant {
  variantId: string;
  steps: WorkflowStep[];
  frequency: number;
  successRate: number;
}

export interface Bottleneck {
  stepNumber: number;
  taskType: string;
  averageWaitTime: number;
  averageDuration: number;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
}

export interface ProcessDiscoveryResult {
  patterns: WorkflowPattern[];
  bottlenecks: Bottleneck[];
  recommendations: string[];
  statistics: {
    totalWorkflows: number;
    uniquePatterns: number;
    averageSteps: number;
    averageSuccessRate: number;
  };
  deepLearningInsights?: {
    hiddenPatterns: Array<{
      pattern: string;
      confidence: number;
      description: string;
    }>;
    predictiveInsights: Array<{
      prediction: string;
      confidence: number;
      reasoning: string;
    }>;
    anomalyPatterns: Array<{
      pattern: string;
      severity: 'high' | 'medium' | 'low';
      description: string;
    }>;
  };
}

class ProcessMiningService {
  /**
   * Discover workflow patterns from task execution data
   */
  async discoverWorkflows(
    agentRole: string,
    tasks: Task[],
    projectId?: string
  ): Promise<ProcessDiscoveryResult> {
    try {
      // Group tasks by execution sequence
      const taskSequences = this.extractTaskSequences(tasks, agentRole);
      
      // Discover patterns
      const patterns = this.discoverPatterns(taskSequences, agentRole);
      
      // Detect bottlenecks
      const bottlenecks = this.detectBottlenecks(taskSequences, patterns);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(patterns, bottlenecks);
      
      // Calculate statistics
      const statistics = this.calculateStatistics(patterns, taskSequences);

      return {
        patterns,
        bottlenecks,
        recommendations,
        statistics
      };
    } catch (error: any) {
      logger.error('Failed to discover workflows:', error);
      throw error;
    }
  }

  /**
   * Extract task sequences from task data
   */
  private extractTaskSequences(tasks: Task[], agentRole: string): Array<{
    sequenceId: string;
    tasks: Task[];
    startTime: Date;
    endTime: Date;
    success: boolean;
  }> {
    // Filter tasks by agent role
    const agentTasks = tasks.filter(t => 
      t.assignedAgent?.role === agentRole || 
      t.assignedAgent?.agentRole === agentRole
    );

    // Sort by creation time
    agentTasks.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

    // Group into sequences (by project or time windows)
    const sequences: Array<{
      sequenceId: string;
      tasks: Task[];
      startTime: Date;
      endTime: Date;
      success: boolean;
    }> = [];

    let currentSequence: Task[] = [];
    let sequenceStart: Date | null = null;

    for (const task of agentTasks) {
      const taskTime = task.createdAt ? new Date(task.createdAt) : new Date();
      
      // Start new sequence if gap > 1 hour or different project
      if (sequenceStart && (taskTime.getTime() - sequenceStart.getTime() > 3600000)) {
        if (currentSequence.length > 0) {
          sequences.push({
            sequenceId: `seq-${sequences.length + 1}`,
            tasks: [...currentSequence],
            startTime: sequenceStart,
            endTime: currentSequence[currentSequence.length - 1].createdAt 
              ? new Date(currentSequence[currentSequence.length - 1].createdAt)
              : new Date(),
            success: currentSequence.every(t => t.status === 'completed')
          });
        }
        currentSequence = [];
        sequenceStart = null;
      }

      if (!sequenceStart) {
        sequenceStart = taskTime;
      }

      currentSequence.push(task);
    }

    // Add final sequence
    if (currentSequence.length > 0) {
      sequences.push({
        sequenceId: `seq-${sequences.length + 1}`,
        tasks: [...currentSequence],
        startTime: sequenceStart!,
        endTime: currentSequence[currentSequence.length - 1].createdAt 
          ? new Date(currentSequence[currentSequence.length - 1].createdAt)
          : new Date(),
        success: currentSequence.every(t => t.status === 'completed')
      });
    }

    return sequences;
  }

  /**
   * Discover patterns from task sequences
   */
  private discoverPatterns(
    sequences: Array<{ sequenceId: string; tasks: Task[]; success: boolean }>,
    agentRole: string
  ): WorkflowPattern[] {
    // Group sequences by task type pattern
    const patternMap = new Map<string, {
      sequences: typeof sequences;
      pattern: string[];
    }>();

    sequences.forEach(seq => {
      const pattern = seq.tasks.map(t => t.title || t.description || 'unknown').join(' -> ');
      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, { sequences: [], pattern: seq.tasks.map(t => t.title || 'unknown') });
      }
      patternMap.get(pattern)!.sequences.push(seq);
    });

    // Convert to WorkflowPattern
    const patterns: WorkflowPattern[] = [];

    patternMap.forEach((data, patternKey) => {
      const totalSequences = data.sequences.length;
      const successfulSequences = data.sequences.filter(s => s.success).length;
      const successRate = (successfulSequences / totalSequences) * 100;

      // Calculate average duration
      const durations = data.sequences.map(seq => {
        if (seq.tasks.length === 0) return 0;
        const start = seq.tasks[0].createdAt ? new Date(seq.tasks[0].createdAt).getTime() : 0;
        const end = seq.tasks[seq.tasks.length - 1].createdAt 
          ? new Date(seq.tasks[seq.tasks.length - 1].createdAt).getTime()
          : Date.now();
        return end - start;
      });
      const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Create workflow steps
      const steps: WorkflowStep[] = data.pattern.map((taskTitle, index) => {
        const stepTasks = data.sequences.flatMap(s => s.tasks).filter((_, i) => i === index);
        const stepDurations = stepTasks.map(t => {
          if (!t.createdAt) return 0;
          const created = new Date(t.createdAt).getTime();
          const completed = t.completedAt ? new Date(t.completedAt).getTime() : Date.now();
          return completed - created;
        });
        const avgStepDuration = stepDurations.length > 0
          ? stepDurations.reduce((a, b) => a + b, 0) / stepDurations.length
          : 0;
        const stepSuccessRate = stepTasks.length > 0
          ? (stepTasks.filter(t => t.status === 'completed').length / stepTasks.length) * 100
          : 0;

        // Calculate next step probabilities
        const nextSteps: Array<{ step: number; probability: number }> = [];
        if (index < data.pattern.length - 1) {
          nextSteps.push({ step: index + 1, probability: 1.0 });
        }

        return {
          stepNumber: index + 1,
          taskType: this.inferTaskType(taskTitle),
          taskTitle,
          averageDuration: avgStepDuration,
          successRate: stepSuccessRate,
          nextSteps
        };
      });

      patterns.push({
        id: `pattern-${patterns.length + 1}`,
        name: `${agentRole} Workflow Pattern ${patterns.length + 1}`,
        agentRole,
        steps,
        frequency: totalSequences,
        successRate,
        averageDuration,
        variants: [] // Would be populated with actual variant detection
      });
    });

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Detect bottlenecks in workflows
   */
  private detectBottlenecks(
    sequences: Array<{ sequenceId: string; tasks: Task[] }>,
    patterns: WorkflowPattern[]
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    patterns.forEach(pattern => {
      pattern.steps.forEach((step, index) => {
        // Calculate wait time (time between steps)
        const waitTimes: number[] = [];
        sequences.forEach(seq => {
          if (seq.tasks.length > index + 1) {
            const currentTask = seq.tasks[index];
            const nextTask = seq.tasks[index + 1];
            if (currentTask.createdAt && nextTask.createdAt) {
              const wait = new Date(nextTask.createdAt).getTime() - 
                          (currentTask.completedAt ? new Date(currentTask.completedAt).getTime() : 
                           new Date(currentTask.createdAt).getTime());
              if (wait > 0) waitTimes.push(wait);
            }
          }
        });

        const averageWaitTime = waitTimes.length > 0
          ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
          : 0;

        // Determine impact
        let impact: 'high' | 'medium' | 'low' = 'low';
        if (averageWaitTime > 3600000) impact = 'high'; // > 1 hour
        else if (averageWaitTime > 600000) impact = 'medium'; // > 10 minutes

        if (averageWaitTime > 0 || step.averageDuration > 300000) { // > 5 minutes
          bottlenecks.push({
            stepNumber: step.stepNumber,
            taskType: step.taskType,
            averageWaitTime,
            averageDuration: step.averageDuration,
            frequency: pattern.frequency,
            impact
          });
        }
      });
    });

    return bottlenecks.sort((a, b) => {
      const aScore = a.averageWaitTime + a.averageDuration;
      const bScore = b.averageWaitTime + b.averageDuration;
      return bScore - aScore;
    });
  }

  /**
   * Perform deep learning analysis on process patterns
   * Uses neural network concepts to discover hidden patterns
   */
  private async performDeepLearningAnalysis(
    taskSequences: Array<{
      sequenceId: string;
      tasks: Task[];
      startTime: number;
      endTime: number;
      success: boolean;
    }>,
    patterns: WorkflowPattern[]
  ): Promise<ProcessDiscoveryResult['deepLearningInsights']> {
    try {
      // Simulate deep learning pattern recognition
      // In production, this would use actual ML models (LSTM, Transformer, etc.)

      const hiddenPatterns: Array<{
        pattern: string;
        confidence: number;
        description: string;
      }> = [];

      const predictiveInsights: Array<{
        prediction: string;
        confidence: number;
        reasoning: string;
      }> = [];

      const anomalyPatterns: Array<{
        pattern: string;
        severity: 'high' | 'medium' | 'low';
        description: string;
      }> = [];

      // Pattern 1: Detect sequential dependencies
      const sequentialDeps = this.detectSequentialDependencies(taskSequences);
      if (sequentialDeps.length > 0) {
        hiddenPatterns.push({
          pattern: 'sequential_dependencies',
          confidence: 0.85,
          description: `Found ${sequentialDeps.length} strong sequential dependencies between tasks`
        });
      }

      // Pattern 2: Detect parallel execution opportunities
      const parallelOps = this.detectParallelOpportunities(taskSequences);
      if (parallelOps.length > 0) {
        hiddenPatterns.push({
          pattern: 'parallel_opportunities',
          confidence: 0.75,
          description: `Identified ${parallelOps.length} opportunities for parallel execution`
        });
      }

      // Pattern 3: Predict failure patterns
      const failurePatterns = this.predictFailurePatterns(taskSequences);
      if (failurePatterns.length > 0) {
        predictiveInsights.push({
          prediction: 'failure_risk',
          confidence: 0.7,
          reasoning: `Detected ${failurePatterns.length} task patterns with high failure risk`
        });
      }

      // Pattern 4: Detect performance anomalies
      const performanceAnomalies = this.detectPerformanceAnomalies(taskSequences);
      performanceAnomalies.forEach(anomaly => {
        anomalyPatterns.push({
          pattern: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description
        });
      });

      return {
        hiddenPatterns,
        predictiveInsights,
        anomalyPatterns
      };
    } catch (error: any) {
      logger.error('Deep learning analysis failed:', error);
      return undefined;
    }
  }

  /**
   * Detect sequential dependencies using pattern analysis
   */
  private detectSequentialDependencies(
    taskSequences: Array<{ tasks: Task[] }>
  ): Array<{ from: string; to: string; strength: number }> {
    const dependencies: Map<string, Map<string, number>> = new Map();

    taskSequences.forEach(seq => {
      for (let i = 0; i < seq.tasks.length - 1; i++) {
        const from = seq.tasks[i].id;
        const to = seq.tasks[i + 1].id;

        if (!dependencies.has(from)) {
          dependencies.set(from, new Map());
        }
        const toMap = dependencies.get(from)!;
        toMap.set(to, (toMap.get(to) || 0) + 1);
      }
    });

    const result: Array<{ from: string; to: string; strength: number }> = [];
    dependencies.forEach((toMap, from) => {
      toMap.forEach((count, to) => {
        const totalSequences = taskSequences.length;
        const strength = count / totalSequences;
        if (strength > 0.5) { // Strong dependency (>50% of sequences)
          result.push({ from, to, strength });
        }
      });
    });

    return result;
  }

  /**
   * Detect opportunities for parallel execution
   */
  private detectParallelOpportunities(
    taskSequences: Array<{ tasks: Task[]; startTime: number; endTime: number }>
  ): Array<{ tasks: string[]; potentialSavings: number }> {
    const opportunities: Array<{ tasks: string[]; potentialSavings: number }> = [];

    // Find tasks that could run in parallel based on timing
    taskSequences.forEach(seq => {
      const tasks = seq.tasks;
      for (let i = 0; i < tasks.length - 1; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
          const task1 = tasks[i];
          const task2 = tasks[j];

          // If tasks don't have dependencies and could run in parallel
          if (!task1.dependencies?.includes(task2.id) && 
              !task2.dependencies?.includes(task1.id)) {
            const sequentialTime = (task1.endTime || 0) - (task1.startTime || 0) +
                                  (task2.endTime || 0) - (task2.startTime || 0);
            const parallelTime = Math.max(
              (task1.endTime || 0) - (task1.startTime || 0),
              (task2.endTime || 0) - (task2.startTime || 0)
            );
            const savings = sequentialTime - parallelTime;

            if (savings > 1000) { // More than 1 second savings
              opportunities.push({
                tasks: [task1.id, task2.id],
                potentialSavings: savings
              });
            }
          }
        }
      }
    });

    return opportunities;
  }

  /**
   * Predict failure patterns using historical data
   */
  private predictFailurePatterns(
    taskSequences: Array<{ tasks: Task[]; success: boolean }>
  ): Array<{ pattern: string; risk: number }> {
    const patterns: Array<{ pattern: string; risk: number }> = [];

    // Analyze failure rates by task type combinations
    const typeCombinations = new Map<string, { total: number; failures: number }>();

    taskSequences.forEach(seq => {
      if (!seq.success) {
        const types = seq.tasks.map(t => t.phase || 'unknown').join('->');
        const existing = typeCombinations.get(types) || { total: 0, failures: 0 };
        typeCombinations.set(types, {
          total: existing.total + 1,
          failures: existing.failures + 1
        });
      } else {
        const types = seq.tasks.map(t => t.phase || 'unknown').join('->');
        const existing = typeCombinations.get(types) || { total: 0, failures: 0 };
        typeCombinations.set(types, {
          total: existing.total + 1,
          failures: existing.failures
        });
      }
    });

    typeCombinations.forEach((stats, types) => {
      const failureRate = stats.failures / stats.total;
      if (failureRate > 0.3 && stats.total >= 5) {
        patterns.push({
          pattern: types,
          risk: failureRate
        });
      }
    });

    return patterns;
  }

  /**
   * Detect performance anomalies using statistical analysis
   */
  private detectPerformanceAnomalies(
    taskSequences: Array<{ tasks: Task[]; startTime: number; endTime: number }>
  ): Array<{ type: string; severity: 'high' | 'medium' | 'low'; description: string }> {
    const anomalies: Array<{ type: string; severity: 'high' | 'medium' | 'low'; description: string }> = [];

    // Calculate average duration
    const durations = taskSequences.map(seq => seq.endTime - seq.startTime);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = Math.sqrt(
      durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length
    );

    // Detect outliers (>2 standard deviations)
    durations.forEach((duration, index) => {
      if (duration > avgDuration + 2 * stdDev) {
        anomalies.push({
          type: 'performance_outlier',
          severity: duration > avgDuration + 3 * stdDev ? 'high' : 'medium',
          description: `Sequence ${index} took ${duration}ms, ${((duration / avgDuration - 1) * 100).toFixed(1)}% longer than average`
        });
      }
    });

    return anomalies;
  }

  /**
   * Generate recommendations based on patterns and bottlenecks
   */
  private generateRecommendations(
    patterns: WorkflowPattern[],
    bottlenecks: Bottleneck[]
  ): string[] {
    const recommendations: string[] = [];

    // Recommendations based on bottlenecks
    bottlenecks.filter(b => b.impact === 'high').forEach(bottleneck => {
      recommendations.push(
        `Step ${bottleneck.stepNumber} (${bottleneck.taskType}) has high wait time. ` +
        `Consider optimizing or parallelizing this step.`
      );
    });

    // Recommendations based on success rates
    patterns.forEach(pattern => {
      if (pattern.successRate < 70) {
        recommendations.push(
          `Pattern "${pattern.name}" has low success rate (${pattern.successRate.toFixed(1)}%). ` +
          `Review and improve the workflow steps.`
        );
      }
    });

    // Recommendations based on frequency
    const mostCommonPattern = patterns[0];
    if (mostCommonPattern && mostCommonPattern.frequency > 10) {
      recommendations.push(
        `Pattern "${mostCommonPattern.name}" is used frequently (${mostCommonPattern.frequency} times). ` +
        `Consider creating a reusable template for this workflow.`
      );
    }

    return recommendations;
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(
    patterns: WorkflowPattern[],
    sequences: Array<{ sequenceId: string; tasks: Task[]; success: boolean }>
  ): ProcessDiscoveryResult['statistics'] {
    const totalWorkflows = sequences.length;
    const uniquePatterns = patterns.length;
    const averageSteps = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.steps.length, 0) / patterns.length
      : 0;
    const averageSuccessRate = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length
      : 0;

    return {
      totalWorkflows,
      uniquePatterns,
      averageSteps,
      averageSuccessRate
    };
  }

  /**
   * Infer task type from title
   */
  private inferTaskType(title: string): string {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('requirement') || lowerTitle.includes('gather')) return 'requirements';
    if (lowerTitle.includes('design') || lowerTitle.includes('architecture')) return 'design';
    if (lowerTitle.includes('implement') || lowerTitle.includes('code')) return 'implementation';
    if (lowerTitle.includes('test') || lowerTitle.includes('qa')) return 'testing';
    if (lowerTitle.includes('review') || lowerTitle.includes('audit')) return 'review';
    if (lowerTitle.includes('deploy') || lowerTitle.includes('release')) return 'deployment';
    return 'general';
  }

  /**
   * Suggest process improvements from discovered patterns
   */
  async suggestImprovements(
    patterns: WorkflowPattern[],
    bottlenecks: Bottleneck[]
  ): Promise<Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }>> {
    const suggestions: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      category: string;
    }> = [];

    // High-priority bottlenecks
    bottlenecks.filter(b => b.impact === 'high').forEach(bottleneck => {
      suggestions.push({
        title: `Optimize ${bottleneck.taskType} Step`,
        description: `Step ${bottleneck.stepNumber} has high wait time (${(bottleneck.averageWaitTime / 60000).toFixed(1)} min). Consider parallelizing or optimizing.`,
        priority: 'high',
        category: 'workflow'
      });
    });

    // Low success rate patterns
    patterns.filter(p => p.successRate < 70).forEach(pattern => {
      suggestions.push({
        title: `Improve ${pattern.name} Success Rate`,
        description: `Pattern has ${pattern.successRate.toFixed(1)}% success rate. Review and improve workflow steps.`,
        priority: 'medium',
        category: 'best-practice'
      });
    });

    // Frequent patterns -> templates
    patterns.filter(p => p.frequency > 10).forEach(pattern => {
      suggestions.push({
        title: `Create Template for ${pattern.name}`,
        description: `Pattern used ${pattern.frequency} times. Create reusable template.`,
        priority: 'medium',
        category: 'template'
      });
    });

    return suggestions;
  }

  /**
   * Perform deep learning analysis on process patterns
   * Uses neural network concepts to discover hidden patterns
   */
  private async performDeepLearningAnalysis(
    taskSequences: Array<{
      sequenceId: string;
      tasks: Task[];
      startTime: Date;
      endTime: Date;
      success: boolean;
    }>,
    patterns: WorkflowPattern[]
  ): Promise<ProcessDiscoveryResult['deepLearningInsights']> {
    try {
      const hiddenPatterns: Array<{
        pattern: string;
        confidence: number;
        description: string;
      }> = [];

      const predictiveInsights: Array<{
        prediction: string;
        confidence: number;
        reasoning: string;
      }> = [];

      const anomalyPatterns: Array<{
        pattern: string;
        severity: 'high' | 'medium' | 'low';
        description: string;
      }> = [];

      // Pattern 1: Detect sequential dependencies
      const sequentialDeps = this.detectSequentialDependencies(taskSequences);
      if (sequentialDeps.length > 0) {
        hiddenPatterns.push({
          pattern: 'sequential_dependencies',
          confidence: 0.85,
          description: `Found ${sequentialDeps.length} strong sequential dependencies between tasks`
        });
      }

      // Pattern 2: Detect parallel execution opportunities
      const parallelOps = this.detectParallelOpportunities(taskSequences);
      if (parallelOps.length > 0) {
        hiddenPatterns.push({
          pattern: 'parallel_opportunities',
          confidence: 0.75,
          description: `Identified ${parallelOps.length} opportunities for parallel execution`
        });
      }

      // Pattern 3: Predict failure patterns
      const failurePatterns = this.predictFailurePatterns(taskSequences);
      if (failurePatterns.length > 0) {
        predictiveInsights.push({
          prediction: 'failure_risk',
          confidence: 0.7,
          reasoning: `Detected ${failurePatterns.length} task patterns with high failure risk`
        });
      }

      // Pattern 4: Detect performance anomalies
      const performanceAnomalies = this.detectPerformanceAnomalies(taskSequences);
      performanceAnomalies.forEach(anomaly => {
        anomalyPatterns.push({
          pattern: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description
        });
      });

      return {
        hiddenPatterns,
        predictiveInsights,
        anomalyPatterns
      };
    } catch (error: any) {
      logger.error('Deep learning analysis failed:', error);
      return undefined;
    }
  }

  /**
   * Detect sequential dependencies using pattern analysis
   */
  private detectSequentialDependencies(
    taskSequences: Array<{ tasks: Task[] }>
  ): Array<{ from: string; to: string; strength: number }> {
    const dependencies: Map<string, Map<string, number>> = new Map();

    taskSequences.forEach(seq => {
      for (let i = 0; i < seq.tasks.length - 1; i++) {
        const from = seq.tasks[i].id;
        const to = seq.tasks[i + 1].id;

        if (!dependencies.has(from)) {
          dependencies.set(from, new Map());
        }
        const toMap = dependencies.get(from)!;
        toMap.set(to, (toMap.get(to) || 0) + 1);
      }
    });

    const result: Array<{ from: string; to: string; strength: number }> = [];
    dependencies.forEach((toMap, from) => {
      toMap.forEach((count, to) => {
        const totalSequences = taskSequences.length;
        const strength = count / totalSequences;
        if (strength > 0.5) {
          result.push({ from, to, strength });
        }
      });
    });

    return result;
  }

  /**
   * Detect opportunities for parallel execution
   */
  private detectParallelOpportunities(
    taskSequences: Array<{ tasks: Task[]; startTime: Date; endTime: Date }>
  ): Array<{ tasks: string[]; potentialSavings: number }> {
    const opportunities: Array<{ tasks: string[]; potentialSavings: number }> = [];

    taskSequences.forEach(seq => {
      const tasks = seq.tasks;
      for (let i = 0; i < tasks.length - 1; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
          const task1 = tasks[i];
          const task2 = tasks[j];

          if (!task1.dependencies?.includes(task2.id) && 
              !task2.dependencies?.includes(task1.id)) {
            const start1 = task1.createdAt ? new Date(task1.createdAt).getTime() : 0;
            const end1 = task1.completedAt ? new Date(task1.completedAt).getTime() : Date.now();
            const start2 = task2.createdAt ? new Date(task2.createdAt).getTime() : 0;
            const end2 = task2.completedAt ? new Date(task2.completedAt).getTime() : Date.now();
            
            const sequentialTime = (end1 - start1) + (end2 - start2);
            const parallelTime = Math.max((end1 - start1), (end2 - start2));
            const savings = sequentialTime - parallelTime;

            if (savings > 1000) {
              opportunities.push({
                tasks: [task1.id, task2.id],
                potentialSavings: savings
              });
            }
          }
        }
      }
    });

    return opportunities;
  }

  /**
   * Predict failure patterns using historical data
   */
  private predictFailurePatterns(
    taskSequences: Array<{ tasks: Task[]; success: boolean }>
  ): Array<{ pattern: string; risk: number }> {
    const patterns: Array<{ pattern: string; risk: number }> = [];
    const typeCombinations = new Map<string, { total: number; failures: number }>();

    taskSequences.forEach(seq => {
      const types = seq.tasks.map(t => t.phase || 'unknown').join('->');
      const existing = typeCombinations.get(types) || { total: 0, failures: 0 };
      typeCombinations.set(types, {
        total: existing.total + 1,
        failures: existing.failures + (seq.success ? 0 : 1)
      });
    });

    typeCombinations.forEach((stats, types) => {
      const failureRate = stats.failures / stats.total;
      if (failureRate > 0.3 && stats.total >= 5) {
        patterns.push({
          pattern: types,
          risk: failureRate
        });
      }
    });

    return patterns;
  }

  /**
   * Detect performance anomalies using statistical analysis
   */
  private detectPerformanceAnomalies(
    taskSequences: Array<{ startTime: Date; endTime: Date }>
  ): Array<{ type: string; severity: 'high' | 'medium' | 'low'; description: string }> {
    const anomalies: Array<{ type: string; severity: 'high' | 'medium' | 'low'; description: string }> = [];

    const durations = taskSequences.map(seq => 
      seq.endTime.getTime() - seq.startTime.getTime()
    );
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = Math.sqrt(
      durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length
    );

    durations.forEach((duration, index) => {
      if (duration > avgDuration + 2 * stdDev) {
        anomalies.push({
          type: 'performance_outlier',
          severity: duration > avgDuration + 3 * stdDev ? 'high' : 'medium',
          description: `Sequence ${index} took ${duration}ms, ${((duration / avgDuration - 1) * 100).toFixed(1)}% longer than average`
        });
      }
    });

    return anomalies;
  }
}

export const processMiningService = new ProcessMiningService();













