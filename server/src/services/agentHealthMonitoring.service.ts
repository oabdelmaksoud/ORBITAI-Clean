/**
 * Agent Health Monitoring Service
 * Tracks agent success rates, execution times, error rates, and health scores
 */

import { logger } from '../utils/logger.js';
import { AgentExecution } from '../models/AgentExecution.model.js';

export interface AgentHealthMetrics {
  agentId: string;
  agentRole: string;
  successRate: number; // 0-100
  averageExecutionTime: number; // milliseconds
  errorRate: number; // 0-100
  tokenUsage: {
    total: number;
    average: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  costPerTask: number;
  healthScore: number; // 0-100
  lastExecuted: Date;
  trends: {
    successRate: number[]; // Last 30 days
    executionTime: number[];
    errorRate: number[];
  };
}

export interface AgentHealthReport {
  projectId?: string;
  agents: AgentHealthMetrics[];
  overallHealth: number; // 0-100
  unhealthyAgents: Array<{
    agentId: string;
    agentRole: string;
    healthScore: number;
    issues: string[];
  }>;
  generatedAt: Date;
}

class AgentHealthMonitoringService {
  /**
   * Calculate agent health metrics
   */
  async calculateHealthMetrics(
    agentId: string,
    agentRole: string,
    projectId?: string
  ): Promise<AgentHealthMetrics> {
    try {
      const query: any = { agentId };
      if (projectId) {
        query.projectId = projectId;
      }

      // Get recent executions (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const executions = await AgentExecution.find({
        ...query,
        startedAt: { $gte: thirtyDaysAgo }
      }).lean();

      if (executions.length === 0) {
        return {
          agentId,
          agentRole,
          successRate: 0,
          averageExecutionTime: 0,
          errorRate: 0,
          tokenUsage: {
            total: 0,
            average: 0,
            trend: 'stable'
          },
          costPerTask: 0,
          healthScore: 0,
          lastExecuted: new Date(0),
          trends: {
            successRate: [],
            executionTime: [],
            errorRate: []
          }
        };
      }

      // Calculate metrics
      const successful = executions.filter(e => e.status === 'completed').length;
      const failed = executions.filter(e => e.status === 'failed').length;
      const total = executions.length;

      const successRate = (successful / total) * 100;
      const errorRate = (failed / total) * 100;

      // Calculate average execution time
      const completedExecutions = executions.filter(e => 
        e.status === 'completed' && e.completedAt && e.startedAt
      );
      const executionTimes = completedExecutions.map(e => 
        new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime()
      );
      const averageExecutionTime = executionTimes.length > 0
        ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
        : 0;

      // Calculate health score
      const healthScore = this.calculateHealthScore(
        successRate,
        errorRate,
        averageExecutionTime
      );

      // Calculate trends
      const trends = this.calculateTrends(executions);

      return {
        agentId,
        agentRole,
        successRate: Math.round(successRate * 100) / 100,
        averageExecutionTime: Math.round(averageExecutionTime),
        errorRate: Math.round(errorRate * 100) / 100,
        tokenUsage: {
          total: 0, // Would track from execution logs
          average: 0,
          trend: 'stable'
        },
        costPerTask: 0, // Would calculate from token usage
        healthScore: Math.round(healthScore),
        lastExecuted: executions[0]?.startedAt || new Date(0),
        trends
      };
    } catch (error: any) {
      logger.error('Failed to calculate agent health metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(
    successRate: number,
    errorRate: number,
    averageExecutionTime: number
  ): number {
    let score = 100;

    // Penalize for low success rate
    score -= (100 - successRate) * 0.5;

    // Penalize for high error rate
    score -= errorRate * 0.3;

    // Penalize for slow execution (if > 10s average)
    if (averageExecutionTime > 10000) {
      score -= ((averageExecutionTime - 10000) / 1000) * 2;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate trends
   */
  private calculateTrends(
    executions: Array<{ status: string; startedAt: Date; completedAt?: Date }>
  ): AgentHealthMetrics['trends'] {
    // Group by day
    const dailyData = new Map<string, {
      success: number;
      total: number;
      executionTime: number[];
      errors: number;
    }>();

    for (const exec of executions) {
      const day = exec.startedAt.toISOString().split('T')[0];
      if (!dailyData.has(day)) {
        dailyData.set(day, { success: 0, total: 0, executionTime: [], errors: 0 });
      }

      const dayData = dailyData.get(day)!;
      dayData.total++;

      if (exec.status === 'completed') {
        dayData.success++;
        if (exec.completedAt) {
          const duration = new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();
          dayData.executionTime.push(duration);
        }
      } else if (exec.status === 'failed') {
        dayData.errors++;
      }
    }

    // Convert to arrays
    const successRate: number[] = [];
    const executionTime: number[] = [];
    const errorRate: number[] = [];

    for (const [_, data] of Array.from(dailyData.entries()).sort()) {
      successRate.push(data.total > 0 ? (data.success / data.total) * 100 : 0);
      executionTime.push(
        data.executionTime.length > 0
          ? data.executionTime.reduce((sum, t) => sum + t, 0) / data.executionTime.length
          : 0
      );
      errorRate.push(data.total > 0 ? (data.errors / data.total) * 100 : 0);
    }

    return { successRate, executionTime, errorRate };
  }

  /**
   * Generate health report
   */
  async generateHealthReport(projectId?: string): Promise<AgentHealthReport> {
    try {
      // Get all unique agents
      const query: any = {};
      if (projectId) {
        query.projectId = projectId;
      }

      const executions = await AgentExecution.find(query).lean();
      const agentIds = Array.from(new Set(executions.map(e => e.agentId)));
      const agentRoles = new Map<string, string>();
      
      for (const exec of executions) {
        agentRoles.set(exec.agentId, exec.agentRole);
      }

      const agents: AgentHealthMetrics[] = [];

      for (const agentId of agentIds) {
        const role = agentRoles.get(agentId) || 'Unknown';
        const metrics = await this.calculateHealthMetrics(agentId, role, projectId);
        agents.push(metrics);
      }

      // Calculate overall health
      const overallHealth = agents.length > 0
        ? agents.reduce((sum, a) => sum + a.healthScore, 0) / agents.length
        : 0;

      // Identify unhealthy agents
      const unhealthyAgents = agents
        .filter(a => a.healthScore < 70)
        .map(a => ({
          agentId: a.agentId,
          agentRole: a.agentRole,
          healthScore: a.healthScore,
          issues: this.identifyIssues(a)
        }));

      return {
        projectId,
        agents,
        overallHealth: Math.round(overallHealth),
        unhealthyAgents,
        generatedAt: new Date()
      };
    } catch (error: any) {
      logger.error('Failed to generate health report:', error);
      throw error;
    }
  }

  /**
   * Identify health issues
   */
  private identifyIssues(metrics: AgentHealthMetrics): string[] {
    const issues: string[] = [];

    if (metrics.successRate < 80) {
      issues.push(`Low success rate: ${metrics.successRate}%`);
    }

    if (metrics.errorRate > 10) {
      issues.push(`High error rate: ${metrics.errorRate}%`);
    }

    if (metrics.averageExecutionTime > 30000) {
      issues.push(`Slow execution: ${(metrics.averageExecutionTime / 1000).toFixed(1)}s average`);
    }

    if (metrics.healthScore < 50) {
      issues.push('Critical health issues detected');
    }

    return issues;
  }

  /**
   * Alert on degradation
   */
  async checkForDegradation(
    agentId: string,
    agentRole: string,
    threshold: number = 10
  ): Promise<boolean> {
    const metrics = await this.calculateHealthMetrics(agentId, agentRole);

    // Check if health score dropped significantly
    if (metrics.trends.successRate.length >= 2) {
      const recent = metrics.trends.successRate.slice(-7); // Last week
      const older = metrics.trends.successRate.slice(-14, -7); // Week before

      if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
        const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;

        const degradation = olderAvg - recentAvg;
        if (degradation > threshold) {
          logger.warn(`Agent ${agentRole} health degradation detected: ${degradation.toFixed(1)}%`);
          return true;
        }
      }
    }

    return false;
  }
}

export const agentHealthMonitoringService = new AgentHealthMonitoringService();



