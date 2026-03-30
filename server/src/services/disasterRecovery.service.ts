/**
 * Disaster Recovery Service
 * Generates backup strategies and recovery procedures
 */

import { logger } from '../utils/logger.js';
import { DisasterRecoveryPlan, IDisasterRecoveryPlan } from '../models/DisasterRecoveryPlan.model.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export interface DRPlanRequest {
  projectId: string;
  projectName: string;
  platform: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  rto?: number; // Recovery Time Objective (minutes)
  rpo?: number; // Recovery Point Objective (minutes)
}

class DisasterRecoveryService {
  /**
   * Generate disaster recovery plan
   */
  async generatePlan(request: DRPlanRequest): Promise<IDisasterRecoveryPlan> {
    try {
      logger.info(`Generating disaster recovery plan for project ${request.projectId}`);

      // Determine RTO/RPO based on criticality
      const rto = request.rto || this.getRTOForCriticality(request.criticality);
      const rpo = request.rpo || this.getRPOForCriticality(request.criticality);

      // Generate backup strategy
      const backupStrategy = this.generateBackupStrategy(request.criticality, request.platform);

      // Generate recovery procedures
      const recoveryProcedures = await this.generateRecoveryProcedures(request);

      // Generate failover procedures
      const failoverProcedures = await this.generateFailoverProcedures(request);

      const plan = new DisasterRecoveryPlan({
        projectId: request.projectId,
        planName: `DR Plan for ${request.projectName}`,
        rto,
        rpo,
        backupStrategy,
        recoveryProcedures,
        failoverProcedures
      });

      await plan.save();
      return plan;
    } catch (error: any) {
      logger.error('Failed to generate disaster recovery plan:', error);
      throw error;
    }
  }

  /**
   * Get RTO for criticality
   */
  private getRTOForCriticality(criticality: string): number {
    switch (criticality) {
      case 'critical': return 15; // 15 minutes
      case 'high': return 60; // 1 hour
      case 'medium': return 240; // 4 hours
      case 'low': return 1440; // 24 hours
      default: return 240;
    }
  }

  /**
   * Get RPO for criticality
   */
  private getRPOForCriticality(criticality: string): number {
    switch (criticality) {
      case 'critical': return 5; // 5 minutes
      case 'high': return 15; // 15 minutes
      case 'medium': return 60; // 1 hour
      case 'low': return 1440; // 24 hours
      default: return 60;
    }
  }

  /**
   * Generate backup strategy
   */
  private generateBackupStrategy(
    criticality: string,
    platform: string
  ): IDisasterRecoveryPlan['backupStrategy'] {
    const frequency = criticality === 'critical' ? 'hourly' :
                      criticality === 'high' ? 'daily' :
                      'daily';

    const retention = criticality === 'critical' ? 90 :
                      criticality === 'high' ? 30 :
                      7;

    const locations = platform === 'aws' ? ['s3', 's3-glacier'] :
                      platform === 'gcp' ? ['cloud-storage', 'cloud-storage-archive'] :
                      platform === 'azure' ? ['blob-storage', 'blob-storage-archive'] :
                      ['primary', 'secondary'];

    return {
      frequency,
      retention,
      locations
    };
  }

  /**
   * Generate recovery procedures
   */
  private async generateRecoveryProcedures(
    request: DRPlanRequest
  ): Promise<IDisasterRecoveryPlan['recoveryProcedures']> {
    const prompt = `Generate disaster recovery procedures for:

Project: ${request.projectName}
Platform: ${request.platform}
RTO: ${request.rto} minutes
RPO: ${request.rpo} minutes
Criticality: ${request.criticality}

Create step-by-step recovery procedures including:
1. Assessment and damage evaluation
2. Backup restoration
3. Service restart
4. Data synchronization
5. Verification and testing

Return as JSON array with steps.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        procedures: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              step: { type: Type.NUMBER },
              description: { type: Type.STRING },
              estimatedTime: { type: Type.NUMBER }
            },
            required: ['step', 'description', 'estimatedTime']
          }
        }
      },
      required: ['procedures']
    };

    try {
      const response = await llmRouter.routeAndExecute({
        prompt,
        taskType: 'documentation',
        agentRole: 'Notebook Agent',
        context: {
          agentRole: 'Notebook Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return (parsed.procedures || []).map((p: any) => ({
        step: p.step,
        description: p.description,
        estimatedTime: p.estimatedTime,
        dependencies: []
      }));
    } catch (error: any) {
      logger.warn('LLM recovery procedure generation failed, using template:', error.message);
      return this.getDefaultRecoveryProcedures();
    }
  }

  /**
   * Generate failover procedures
   */
  private async generateFailoverProcedures(
    request: DRPlanRequest
  ): Promise<IDisasterRecoveryPlan['failoverProcedures']> {
    return [
      {
        scenario: 'Primary region failure',
        steps: [
          'Detect primary region failure',
          'Activate secondary region',
          'Update DNS/routing',
          'Verify service health',
          'Monitor for issues'
        ],
        estimatedTime: 10
      },
      {
        scenario: 'Database failure',
        steps: [
          'Detect database failure',
          'Switch to backup database',
          'Verify data integrity',
          'Update connection strings',
          'Monitor replication lag'
        ],
        estimatedTime: 15
      }
    ];
  }

  /**
   * Get default recovery procedures
   */
  private getDefaultRecoveryProcedures(): IDisasterRecoveryPlan['recoveryProcedures'] {
    return [
      {
        step: 1,
        description: 'Assess damage and identify affected systems',
        estimatedTime: 5
      },
      {
        step: 2,
        description: 'Restore from most recent backup',
        estimatedTime: 10
      },
      {
        step: 3,
        description: 'Restart services and verify functionality',
        estimatedTime: 5
      },
      {
        step: 4,
        description: 'Synchronize data and verify integrity',
        estimatedTime: 10
      },
      {
        step: 5,
        description: 'Run health checks and monitoring',
        estimatedTime: 5
      }
    ];
  }

  /**
   * Test recovery procedures
   */
  async testRecoveryProcedures(projectId: string): Promise<{
    rtoAchieved: boolean;
    rpoAchieved: boolean;
    issues: string[];
  }> {
    const plan = await DisasterRecoveryPlan.findOne({ projectId });
    if (!plan) {
      throw new Error('Disaster recovery plan not found');
    }

    // Simulate recovery (would actually test in staging)
    const totalTime = plan.recoveryProcedures.reduce((sum, p) => sum + p.estimatedTime, 0);
    const rtoAchieved = totalTime <= plan.rto;

    // RPO would be tested by checking backup frequency
    const rpoAchieved = this.checkBackupFrequency(plan.backupStrategy.frequency, plan.rpo);

    const issues: string[] = [];
    if (!rtoAchieved) {
      issues.push(`Recovery time (${totalTime}min) exceeds RTO (${plan.rto}min)`);
    }
    if (!rpoAchieved) {
      issues.push(`Backup frequency may not meet RPO requirement`);
    }

    plan.lastTested = new Date();
    plan.testResults = {
      rtoAchieved,
      rpoAchieved,
      issues
    };
    await plan.save();

    return { rtoAchieved, rpoAchieved, issues };
  }

  /**
   * Check backup frequency meets RPO
   */
  private checkBackupFrequency(frequency: string, rpo: number): boolean {
    const frequencyMinutes = frequency === 'hourly' ? 60 :
                            frequency === 'daily' ? 1440 :
                            1440;

    return frequencyMinutes <= rpo;
  }
}

export const disasterRecoveryService = new DisasterRecoveryService();



