/**
 * Process Simulation Service
 * Simulates processes to predict performance and identify risks
 * Inspired by SimPy concepts
 */

import { ProcessImprovement } from '../models/ProcessImprovement.model.js';
import { logger } from '../utils/logger.js';

export interface SimulationScenario {
  name: string;
  variables: Record<string, any>;
  assumptions: string[];
}

export interface SimulationResult {
  scenario: string;
  duration: number; // milliseconds
  success: boolean;
  steps: Array<{
    stepName: string;
    duration: number;
    success: boolean;
    resources: Record<string, number>;
  }>;
  metrics: {
    totalDuration: number;
    averageStepDuration: number;
    successRate: number;
    resourceUtilization: Record<string, number>;
  };
  risks: Risk[];
}

export interface Risk {
  type: 'time' | 'quality' | 'resource' | 'dependency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  probability: number; // 0-1
  impact: string;
  mitigation: string;
}

export interface WhatIfResult {
  scenario: string;
  changes: string[];
  predictedOutcome: {
    duration: number;
    successRate: number;
    cost: number;
    quality: number;
  };
  comparison: {
    durationChange: number; // percentage
    successRateChange: number;
    costChange: number;
    qualityChange: number;
  };
  risks: Risk[];
}

class ProcessSimulationService {
  /**
   * Simulate a process improvement
   */
  async simulate(
    improvementId: string,
    scenarios: SimulationScenario[]
  ): Promise<SimulationResult[]> {
    try {
      const improvement = await ProcessImprovement.findOne({ id: improvementId });
      if (!improvement) {
        throw new Error(`Process improvement not found: ${improvementId}`);
      }

      const results: SimulationResult[] = [];

      for (const scenario of scenarios) {
        const result = await this.runSimulation(improvement, scenario);
        results.push(result);
      }

      return results;
    } catch (error: unknown) {
      logger.error('Failed to simulate process:', error);
      throw error;
    }
  }

  /**
   * Run a single simulation
   */
  private async runSimulation(
    improvement: any,
    scenario: SimulationScenario
  ): Promise<SimulationResult> {
    const steps: SimulationResult['steps'] = [];
    let totalDuration = 0;
    let allSuccess = true;
    const resources: Record<string, number> = {};

    // Simulate structured steps if available
    if (improvement.structuredContent?.steps) {
      for (const step of improvement.structuredContent.steps) {
        // Simulate step execution
        const stepDuration = this.simulateStepDuration(step, scenario);
        const stepSuccess = this.simulateStepSuccess(step, scenario);
        
        totalDuration += stepDuration;
        allSuccess = allSuccess && stepSuccess;

        steps.push({
          stepName: step.title || `Step ${step.step}`,
          duration: stepDuration,
          success: stepSuccess,
          resources: {
            time: stepDuration,
            effort: stepDuration / 1000 // Convert to seconds
          }
        });

        // Track resources
        resources.time = (resources.time || 0) + stepDuration;
        resources.effort = (resources.effort || 0) + stepDuration / 1000;
      }
    } else {
      // Simulate without structured steps
      const estimatedSteps = Math.ceil(improvement.content.length / 500);
      for (let i = 0; i < estimatedSteps; i++) {
        const stepDuration = 1000 + Math.random() * 2000;
        const stepSuccess = Math.random() > 0.2; // 80% success rate

        totalDuration += stepDuration;
        allSuccess = allSuccess && stepSuccess;

        steps.push({
          stepName: `Step ${i + 1}`,
          duration: stepDuration,
          success: stepSuccess,
          resources: {
            time: stepDuration,
            effort: stepDuration / 1000
          }
        });
      }
    }

    // Calculate metrics
    const averageStepDuration = steps.length > 0 ? totalDuration / steps.length : 0;
    const successRate = steps.length > 0
      ? (steps.filter(s => s.success).length / steps.length) * 100
      : 0;

    // Identify risks
    const risks = this.identifyRisks(improvement, scenario, steps);

    return {
      scenario: scenario.name,
      duration: totalDuration,
      success: allSuccess,
      steps,
      metrics: {
        totalDuration,
        averageStepDuration,
        successRate,
        resourceUtilization: resources
      },
      risks
    };
  }

  /**
   * Simulate step duration
   */
  private simulateStepDuration(step: any, scenario: SimulationScenario): number {
    // Base duration from step description length
    const baseDuration = (step.description?.length || 100) * 10;
    
    // Adjust based on scenario variables
    let duration = baseDuration;
    
    if (scenario.variables.complexity === 'complex') {
      duration *= 1.5;
    } else if (scenario.variables.complexity === 'simple') {
      duration *= 0.7;
    }

    if (scenario.variables.experience === 'beginner') {
      duration *= 1.3;
    } else if (scenario.variables.experience === 'expert') {
      duration *= 0.8;
    }

    // Add some randomness
    duration *= (0.8 + Math.random() * 0.4);

    return Math.round(duration);
  }

  /**
   * Simulate step success
   */
  private simulateStepSuccess(_step: any, scenario: SimulationScenario): boolean {
    // Base success rate
    let successRate = 0.8;

    // Adjust based on scenario
    if (scenario.variables.complexity === 'complex') {
      successRate -= 0.1;
    }

    if (scenario.variables.experience === 'beginner') {
      successRate -= 0.1;
    } else if (scenario.variables.experience === 'expert') {
      successRate += 0.1;
    }

    return Math.random() < successRate;
  }

  /**
   * Identify risks
   */
  private identifyRisks(
    improvement: any,
    _scenario: SimulationScenario,
    steps: SimulationResult['steps']
  ): Risk[] {
    const risks: Risk[] = [];

    // Time risks
    const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
    if (totalDuration > 3600000) { // > 1 hour
      risks.push({
        type: 'time',
        severity: 'high',
        description: 'Process duration exceeds 1 hour',
        probability: 0.7,
        impact: 'May cause delays in project timeline',
        mitigation: 'Break down into smaller steps or parallelize'
      });
    }

    // Quality risks
    const failureRate = steps.filter(s => !s.success).length / steps.length;
    if (failureRate > 0.3) {
      risks.push({
        type: 'quality',
        severity: 'high',
        description: 'High failure rate in steps',
        probability: failureRate,
        impact: 'May result in poor outcomes',
        mitigation: 'Improve step clarity and add validation'
      });
    }

    // Resource risks
    if (steps.length > 10) {
      risks.push({
        type: 'resource',
        severity: 'medium',
        description: 'Process has many steps requiring significant resources',
        probability: 0.6,
        impact: 'May strain available resources',
        mitigation: 'Consider automation or resource allocation'
      });
    }

    // Dependency risks
    if (improvement.applicableTo?.agentRoles && improvement.applicableTo.agentRoles.length > 3) {
      risks.push({
        type: 'dependency',
        severity: 'medium',
        description: 'Process depends on multiple agent roles',
        probability: 0.5,
        impact: 'Coordination challenges may arise',
        mitigation: 'Define clear handoff points and responsibilities'
      });
    }

    return risks;
  }

  /**
   * What-if analysis
   */
  async whatIfAnalysis(
    improvementId: string,
    changes: Record<string, any>
  ): Promise<WhatIfResult> {
    try {
      const improvement = await ProcessImprovement.findOne({ id: improvementId });
      if (!improvement) {
        throw new Error(`Process improvement not found: ${improvementId}`);
      }

      // Baseline metrics
      const baseline = {
        duration: ((improvement as any).statistics)?.averageDuration || 1000,
        successRate: improvement.usage.successRate || 70,
        cost: 100, // Base cost
        quality: (
          (improvement.quality.completeness || 0) +
          (improvement.quality.clarity || 0) +
          (improvement.quality.usefulness || 0)
        ) / 3
      };

      // Apply changes and predict
      let predictedDuration = baseline.duration;
      let predictedSuccessRate = baseline.successRate;
      let predictedCost = baseline.cost;
      let predictedQuality = baseline.quality;
      const changeDescriptions: string[] = [];

      // Analyze each change
      if (changes.addSteps) {
        predictedDuration *= 1.2;
        predictedQuality += 5;
        changeDescriptions.push('Added structured steps');
      }

      if (changes.improveClarity) {
        predictedQuality += 10;
        predictedSuccessRate += 5;
        changeDescriptions.push('Improved content clarity');
      }

      if (changes.addExamples) {
        predictedSuccessRate += 8;
        predictedQuality += 5;
        changeDescriptions.push('Added examples');
      }

      if (changes.simplify) {
        predictedDuration *= 0.8;
        predictedSuccessRate += 5;
        changeDescriptions.push('Simplified process');
      }

      // Calculate changes
      const durationChange = ((predictedDuration - baseline.duration) / baseline.duration) * 100;
      const successRateChange = predictedSuccessRate - baseline.successRate;
      const costChange = ((predictedCost - baseline.cost) / baseline.cost) * 100;
      const qualityChange = predictedQuality - baseline.quality;

      // Identify risks
      const risks = this.identifyRisks(improvement, { name: 'what-if', variables: changes, assumptions: [] }, []);

      return {
        scenario: 'What-if Analysis',
        changes: changeDescriptions,
        predictedOutcome: {
          duration: predictedDuration,
          successRate: predictedSuccessRate,
          cost: predictedCost,
          quality: predictedQuality
        },
        comparison: {
          durationChange,
          successRateChange,
          costChange,
          qualityChange
        },
        risks
      };
    } catch (error: unknown) {
      logger.error('Failed to perform what-if analysis:', error);
      throw error;
    }
  }

  /**
   * Predict performance
   */
  async predictPerformance(
    improvementId: string,
    context: Record<string, any>
  ): Promise<{
    predictedDuration: number;
    predictedSuccessRate: number;
    confidence: number;
    factors: string[];
  }> {
    try {
      const improvement = await ProcessImprovement.findOne({ id: improvementId });
      if (!improvement) {
        throw new Error(`Process improvement not found: ${improvementId}`);
      }

      // Base predictions from historical data
      let predictedDuration = ((improvement as any).statistics)?.averageDuration || 1000;
      let predictedSuccessRate = improvement.usage.successRate || 70;
      const factors: string[] = [];

      // Adjust based on context
      if (context.complexity === 'complex') {
        predictedDuration *= 1.5;
        predictedSuccessRate -= 10;
        factors.push('Complexity increases duration and reduces success rate');
      }

      if (context.teamSize) {
        if (context.teamSize > 5) {
          predictedDuration *= 0.8; // Parallelization
          factors.push('Large team enables parallelization');
        } else if (context.teamSize < 2) {
          predictedDuration *= 1.2;
          factors.push('Small team increases duration');
        }
      }

      // Confidence based on usage
      const confidence = Math.min(90, 50 + (improvement.usage.timesUsed || 0) * 2);

      return {
        predictedDuration,
        predictedSuccessRate: Math.max(0, Math.min(100, predictedSuccessRate)),
        confidence,
        factors
      };
    } catch (error: unknown) {
      logger.error('Failed to predict performance:', error);
      throw error;
    }
  }
}

export const processSimulationService = new ProcessSimulationService();
















