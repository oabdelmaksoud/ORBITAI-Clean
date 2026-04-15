/**
 * Environment Management Service
 * Manages dev/staging/production environments
 */

import { logger } from '../utils/logger.js';
import { Environment, IEnvironment } from '../models/Environment.model.js';

export interface EnvironmentConfig {
  projectId: string;
  name: 'development' | 'staging' | 'production';
  platform: string;
  envVars: Record<string, string>;
  resourceSizing?: {
    cpu?: string;
    memory?: string;
    instances?: number;
  };
  featureFlags?: Record<string, boolean>;
}

class EnvironmentManagementService {
  /**
   * Create or update environment
   */
  async createEnvironment(config: EnvironmentConfig): Promise<IEnvironment> {
    try {
      logger.info(`Creating/updating ${config.name} environment for project ${config.projectId}`);

      const environment = await Environment.findOneAndUpdate(
        { projectId: config.projectId, name: config.name },
        {
          projectId: config.projectId,
          name: config.name,
          platform: config.platform,
          configuration: {
            envVars: config.envVars,
            resourceSizing: config.resourceSizing || {
              cpu: this.getDefaultCPU(config.name),
              memory: this.getDefaultMemory(config.name),
              instances:
                (config.resourceSizing as any)?.instances || this.getDefaultInstances(config.name),
            },
            featureFlags: config.featureFlags || {},
          },
          status: 'inactive',
        },
        { upsert: true, new: true }
      );

      return environment;
    } catch (error: unknown) {
      logger.error('Failed to create environment:', error);
      throw error;
    }
  }

  /**
   * Promote environment (dev -> staging -> production)
   */
  async promoteEnvironment(
    projectId: string,
    from: 'development' | 'staging',
    to: 'staging' | 'production'
  ): Promise<IEnvironment> {
    try {
      const sourceEnv = await Environment.findOne({ projectId, name: from });
      if (!sourceEnv) {
        throw new Error(`Source environment ${from} not found`);
      }

      // Create target environment with source configuration
      const targetEnv = await this.createEnvironment({
        projectId,
        name: to,
        platform: sourceEnv.platform,
        envVars: sourceEnv.configuration.envVars,
        resourceSizing:
          to === 'production'
            ? this.scaleForProduction(sourceEnv.configuration.resourceSizing)
            : sourceEnv.configuration.resourceSizing,
        featureFlags: sourceEnv.configuration.featureFlags,
      });

      logger.info(`Promoted environment from ${from} to ${to}`);
      return targetEnv;
    } catch (error: unknown) {
      logger.error('Failed to promote environment:', error);
      throw error;
    }
  }

  /**
   * Get default CPU for environment
   */
  private getDefaultCPU(env: string): string {
    switch (env) {
      case 'production':
        return '2';
      case 'staging':
        return '1';
      case 'development':
        return '0.5';
      default:
        return '1';
    }
  }

  /**
   * Get default memory for environment
   */
  private getDefaultMemory(env: string): string {
    switch (env) {
      case 'production':
        return '4GB';
      case 'staging':
        return '2GB';
      case 'development':
        return '1GB';
      default:
        return '2GB';
    }
  }

  /**
   * Get default instances for environment
   */
  private getDefaultInstances(env: string): number {
    switch (env) {
      case 'production':
        return 3;
      case 'staging':
        return 2;
      case 'development':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Scale for production
   */
  private scaleForProduction(resourceSizing: any): any {
    return {
      cpu: String(parseFloat(resourceSizing.cpu || '1') * 2),
      memory: resourceSizing.memory ? this.scaleMemory(resourceSizing.memory) : '4GB',
      instances: (resourceSizing.instances || 1) * 2,
    };
  }

  /**
   * Scale memory
   */
  private scaleMemory(memory: string): string {
    const match = memory.match(/(\d+)(GB|MB)/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      return `${value * 2}${unit}`;
    }
    return '4GB';
  }

  /**
   * Get environment secrets
   */
  async getEnvironmentSecrets(
    projectId: string,
    environment: string
  ): Promise<Record<string, string>> {
    const env = await Environment.findOne({ projectId, name: environment });
    if (!env) {
      return {};
    }

    // Return secrets (would decrypt in production)
    const secrets: Record<string, string> = {};
    for (const secret of env.secrets) {
      secrets[secret.key] = `[${secret.source}]`; // Placeholder
    }

    return secrets;
  }
}

export const environmentManagementService = new EnvironmentManagementService();
