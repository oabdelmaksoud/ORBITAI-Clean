/**
 * Hosting Service
 * Manages hosting plans, pricing, and hosted projects
 */

import { logger } from '../utils/logger.js';
import { HostingPlan } from '../models/HostingPlan.model.js';
import { HostedProject } from '../models/HostedProject.model.js';
import { Project } from '../models/Project.model.js';
import { deploymentService } from './deployment.service.js';

export interface HostingPricing {
  platform: string;
  projectType: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  setupFee: number;
  features: string[];
}

export interface CreateHostingRequest {
  projectId: string;
  platform: string;
  environment: 'development' | 'staging' | 'production';
  hostingPlanId?: string;
}

class HostingService {
  /**
   * Get available hosting plans for a project
   */
  async getHostingPlans(
    projectType?: string,
    platform?: string
  ): Promise<HostingPricing[]> {
    try {
      const query: any = { isActive: true };
      if (platform && platform !== 'all') {
        query.platform = { $in: [platform, 'all'] };
      }
      if (projectType && projectType !== 'all') {
        query.projectType = { $in: [projectType, 'all'] };
      }

      const plans = await HostingPlan.find(query).lean();

      return plans.map(plan => ({
        platform: plan.platform,
        projectType: plan.projectType,
        monthlyPrice: plan.price.monthly,
        yearlyPrice: plan.price.yearly,
        setupFee: plan.price.setup || 0,
        features: plan.features || []
      }));
    } catch (error: unknown) {
      logger.error('Failed to get hosting plans:', error);
      return [];
    }
  }

  /**
   * Create hosting for a project
   */
  async createHosting(
    userId: string,
    request: CreateHostingRequest
  ): Promise<any> {
    try {
      const project = await Project.findById(request.projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Get hosting plan if specified
      let hostingPlan = null;
      if (request.hostingPlanId) {
        hostingPlan = await HostingPlan.findById(request.hostingPlanId);
      }

      // Deploy project
      const deploymentResult = await deploymentService.deployProject(
        request.projectId,
        {
          platform: request.platform as any,
          environment: request.environment,
          envVars: {}
        }
      );

      if (!deploymentResult.success) {
        throw new Error(`Deployment failed: ${deploymentResult.error}`);
      }

      // Create hosted project record
      const hostedProject = await HostedProject.create({
        userId,
        projectId: request.projectId,
        projectName: project.name,
        platform: request.platform,
        environment: request.environment,
        url: deploymentResult.url,
        status: 'active',
        hostingPlanId: request.hostingPlanId,
        deploymentId: deploymentResult.deploymentId,
        resourceUsage: {
          compute: 0,
          storage: 0,
          bandwidth: 0,
          buildMinutes: 0
        },
        billing: {
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          amount: hostingPlan?.price.monthly || 0,
          currency: 'USD'
        }
      });

      // Update project status
      await Project.findByIdAndUpdate(request.projectId, {
        status: 'deployed',
        lastModified: new Date()
      });

      logger.info(`Created hosting for project ${request.projectId} on ${request.platform}`);

      return hostedProject;
    } catch (error: unknown) {
      logger.error('Failed to create hosting:', error);
      throw error;
    }
  }

  /**
   * Get user's hosted projects
   */
  async getUserHostedProjects(userId: string): Promise<any[]> {
    try {
      return await HostedProject.find({ userId, status: 'active' }).lean();
    } catch (error: unknown) {
      logger.error('Failed to get hosted projects:', error);
      return [];
    }
  }

  /**
   * Suspend hosting
   */
  async suspendHosting(hostedProjectId: string, userId: string): Promise<void> {
    try {
      const hostedProject = await HostedProject.findOne({
        _id: hostedProjectId,
        userId
      });

      if (!hostedProject) {
        throw new Error('Hosted project not found');
      }

      hostedProject.status = 'suspended';
      await hostedProject.save();

      logger.info(`Suspended hosting: ${hostedProjectId}`);
    } catch (error: unknown) {
      logger.error('Failed to suspend hosting:', error);
      throw error;
    }
  }

  /**
   * Terminate hosting
   */
  async terminateHosting(hostedProjectId: string, userId: string): Promise<void> {
    try {
      const hostedProject = await HostedProject.findOne({
        _id: hostedProjectId,
        userId
      });

      if (!hostedProject) {
        throw new Error('Hosted project not found');
      }

      hostedProject.status = 'terminated';
      await hostedProject.save();

      // Update project status
      await Project.findByIdAndUpdate(hostedProject.projectId, {
        status: 'completed', // Revert to completed
        lastModified: new Date()
      });

      logger.info(`Terminated hosting: ${hostedProjectId}`);
    } catch (error: unknown) {
      logger.error('Failed to terminate hosting:', error);
      throw error;
    }
  }
}

export const hostingService = new HostingService();




