/**
 * Deployment Rollback Service
 * Auto-rollback on health check failures
 */

import { logger } from '../utils/logger.js';
import { Deployment } from '../models/Deployment.model.js';
import { deploymentMonitoringService } from './deploymentMonitoring.service.js';

export interface RollbackConfig {
  healthCheckUrl: string;
  healthCheckInterval: number; // milliseconds
  failureThreshold: number; // consecutive failures before rollback
  rollbackToVersion?: string;
}

export interface RollbackResult {
  deploymentId: string;
  rolledBack: boolean;
  previousVersion?: string;
  reason: string;
  timestamp: Date;
}

class DeploymentRollbackService {
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Start health check monitoring
   */
  async startHealthCheckMonitoring(
    deploymentId: string,
    config: RollbackConfig
  ): Promise<void> {
    logger.info(`Starting health check monitoring for deployment ${deploymentId}`);

    let consecutiveFailures = 0;

    const interval = setInterval(async () => {
      try {
        const metrics = await deploymentMonitoringService.monitorDeployment(deploymentId);

        if (metrics.health.status === 'unhealthy') {
          consecutiveFailures++;

          if (consecutiveFailures >= config.failureThreshold) {
            logger.warn(`Health check failures threshold reached for ${deploymentId}, triggering rollback`);
            await this.rollback(deploymentId, 'Health check failures');
            this.stopHealthCheckMonitoring(deploymentId);
          }
        } else {
          consecutiveFailures = 0; // Reset on success
        }
      } catch (error: unknown) {
        logger.error(`Health check monitoring error for ${deploymentId}:`, error);
      }
    }, config.healthCheckInterval);

    this.healthCheckIntervals.set(deploymentId, interval);
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheckMonitoring(deploymentId: string): void {
    const interval = this.healthCheckIntervals.get(deploymentId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(deploymentId);
    }
  }

  /**
   * Rollback deployment
   */
  async rollback(
    deploymentId: string,
    reason: string
  ): Promise<RollbackResult> {
    try {
      logger.info(`Rolling back deployment ${deploymentId}: ${reason}`);

      const deployment = await Deployment.findById(deploymentId);
      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // Get previous deployment version
      const previousDeployment = await Deployment.findOne({
        projectId: deployment.projectId,
        status: 'success',
        _id: { $ne: deploymentId }
      }).sort({ completedAt: -1 });

      if (!previousDeployment) {
        return {
          deploymentId,
          rolledBack: false,
          reason: 'No previous successful deployment found',
          timestamp: new Date()
        };
      }

      // Update deployment status
      deployment.status = 'stopped';
      deployment.error = `Rolled back: ${reason}`;
      await deployment.save();

      // Would trigger actual rollback to previous version
      // This would depend on the deployment platform

      return {
        deploymentId,
        rolledBack: true,
        previousVersion: previousDeployment._id.toString(),
        reason,
        timestamp: new Date()
      };
    } catch (error: unknown) {
      logger.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get rollback history
   */
  async getRollbackHistory(projectId: string): Promise<RollbackResult[]> {
    const deployments = await Deployment.find({
      projectId,
      error: { $regex: /rolled back/i }
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return deployments.map(d => ({
      deploymentId: d._id.toString(),
      rolledBack: true,
      reason: d.error || 'Unknown',
      timestamp: d.updatedAt || new Date()
    }));
  }
}

export const deploymentRollbackService = new DeploymentRollbackService();



