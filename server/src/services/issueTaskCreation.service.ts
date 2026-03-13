/**
 * Issue Task Creation Service
 * Automatically creates tasks when agents detect issues during code review, quality checks, or analysis
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import { TaskStatus, AgentRoleType, AgentRole } from '@orbitai/shared';
import { v4 as uuidv4 } from 'uuid';

export interface DetectedIssue {
  type: 'security' | 'performance' | 'quality' | 'best-practice' | 'bug' | 'compliance' | 'requirement';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location?: string; // File/line reference
  recommendation?: string;
  agentRole: AgentRoleType;
  artifactId?: string; // Related artifact if applicable
  relatedTaskId?: string; // Related task if this is a follow-up issue
}

export interface TaskCreationResult {
  taskId: string;
  created: boolean;
  message: string;
}

class IssueTaskCreationService {
  /**
   * Create a task for a detected issue
   */
  async createTaskForIssue(
    projectId: string,
    issue: DetectedIssue,
    userId: string
  ): Promise<TaskCreationResult> {
    try {
      // Find project
      const project = await Project.findById(projectId);
      if (!project) {
        return {
          taskId: '',
          created: false,
          message: 'Project not found'
        };
      }

      // Check if similar task already exists (prevent duplicates)
      const existingTask = project.tasks?.find((t: any) =>
        t.title.toLowerCase().includes(issue.title.toLowerCase().substring(0, 30)) ||
        (t.description && t.description.toLowerCase().includes(issue.description.toLowerCase().substring(0, 50)))
      );

      if (existingTask) {
        logger.debug(`Similar task already exists for issue: ${issue.title}`);
        return {
          taskId: existingTask.id || existingTask._id?.toString() || '',
          created: false,
          message: 'Similar task already exists'
        };
      }

      // Determine appropriate agent for the issue type
      const assignedAgent = this.selectAgentForIssue(issue);

      // Determine priority based on severity
      const priority = this.mapSeverityToPriority(issue.severity);

      // Determine phase based on issue type
      const phase = this.determinePhaseForIssue(issue);

      // Create task
      const newTask = {
        id: uuidv4(),
        title: `Fix: ${issue.title}`,
        description: this.buildTaskDescription(issue),
        status: TaskStatus.PENDING,
        assignedTo: assignedAgent,
        phase: phase,
        priority: priority,
        createdAt: Date.now(),
        dependencies: issue.relatedTaskId ? [issue.relatedTaskId] : [],
        logs: [],
        progress: 0,
        // Initialize evaluation with pending status (will be calculated when task is executed)
        evaluation: {
          score: 0,
          reasoning: 'Quality score will be calculated when task is executed.',
          criteria: [],
          timestamp: Date.now()
        },
        metadata: {
          issueType: issue.type,
          severity: issue.severity,
          detectedBy: issue.agentRole,
          location: issue.location,
          artifactId: issue.artifactId,
          autoCreated: true
        }
      };

      // Add task to project
      if (!project.tasks) {
        project.tasks = [];
      }
      project.tasks.push(newTask);
      await project.save();

      logger.info(`Created task for issue: ${issue.title} (Task ID: ${newTask.id})`);

      return {
        taskId: newTask.id,
        created: true,
        message: `Task created successfully: ${newTask.title}`
      };
    } catch (error: unknown) {
      logger.error('Failed to create task for issue:', error);
      return {
        taskId: '',
        created: false,
        message: `Failed to create task: ${error.message}`
      };
    }
  }

  /**
   * Create tasks for multiple issues
   */
  async createTasksForIssues(
    projectId: string,
    issues: DetectedIssue[],
    userId: string
  ): Promise<TaskCreationResult[]> {
    const results: TaskCreationResult[] = [];

    for (const issue of issues) {
      const result = await this.createTaskForIssue(projectId, issue, userId);
      results.push(result);
    }

    return results;
  }

  /**
   * Create tasks from code quality review results
   */
  async createTasksFromCodeReview(
    projectId: string,
    reviewResult: {
      securityIssues?: Array<{ severity: string; type: string; description: string; location?: string; recommendation?: string }>;
      bestPractices?: Array<{ status: string; principle: string; description: string; location?: string }>;
      performanceMetrics?: { potentialBottlenecks: string[]; optimizationSuggestions: string[] };
      codeStyle?: { formatting: string[]; naming: string[]; structure: string[] };
    },
    artifactId: string,
    userId: string
  ): Promise<TaskCreationResult[]> {
    const issues: DetectedIssue[] = [];

    // Convert security issues to tasks
    if (reviewResult.securityIssues) {
      for (const issue of reviewResult.securityIssues) {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          issues.push({
            type: 'security',
            severity: issue.severity as any,
            title: `Security: ${issue.type}`,
            description: issue.description,
            location: issue.location,
            recommendation: issue.recommendation,
            agentRole: AgentRole.QA_AUDIT_AGENT,
            artifactId
          });
        }
      }
    }

    // Convert best practice failures to tasks
    if (reviewResult.bestPractices) {
      for (const check of reviewResult.bestPractices) {
        if (check.status === 'fail') {
          issues.push({
            type: 'best-practice',
            severity: 'medium',
            title: `Best Practice: ${check.principle}`,
            description: check.description,
            location: check.location,
            agentRole: AgentRole.QA_AUDIT_AGENT,
            artifactId
          });
        }
      }
    }

    // Convert performance bottlenecks to tasks
    if (reviewResult.performanceMetrics?.potentialBottlenecks) {
      for (const bottleneck of reviewResult.performanceMetrics.potentialBottlenecks) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          title: `Performance: ${bottleneck.substring(0, 50)}`,
          description: bottleneck,
          agentRole: AgentRole.QA_AUDIT,
          artifactId
        });
      }
    }

    // Create tasks for all issues
    return await this.createTasksForIssues(projectId, issues, userId);
  }

  /**
   * Create tasks from requirements compliance issues
   */
  async createTasksFromComplianceIssues(
    projectId: string,
    missingRequirements: Array<{ id: string; description: string; type: string; priority: string }>,
    userId: string
  ): Promise<TaskCreationResult[]> {
    const issues: DetectedIssue[] = missingRequirements.map(req => ({
      type: 'requirement',
      severity: req.priority === 'critical' ? 'critical' : req.priority === 'high' ? 'high' : 'medium',
      title: `Missing Requirement: ${req.id}`,
      description: req.description,
      agentRole: AgentRole.REQUIREMENTS_AGENT,
      relatedTaskId: undefined
    }));

    return await this.createTasksForIssues(projectId, issues, userId);
  }

  /**
   * Select appropriate agent for issue type
   */
  private selectAgentForIssue(issue: DetectedIssue): AgentRoleType {
    switch (issue.type) {
      case 'security':
      case 'compliance':
        return AgentRole.QA_AUDIT_AGENT;
      case 'performance':
        return AgentRole.IMPLEMENTATION_AGENT;
      case 'quality':
      case 'best-practice':
        return AgentRole.QA_AUDIT_AGENT;
      case 'bug':
        return AgentRole.REMEDIATION_AGENT;
      case 'requirement':
        return AgentRole.REQUIREMENTS_AGENT;
      default:
        return AgentRole.ORCHESTRATOR;
    }
  }

  /**
   * Map severity to task priority
   */
  private mapSeverityToPriority(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Determine phase for issue
   */
  private determinePhaseForIssue(issue: DetectedIssue): string {
    switch (issue.type) {
      case 'requirement':
        return 'Requirements';
      case 'security':
      case 'compliance':
        return 'Testing';
      case 'performance':
      case 'quality':
      case 'best-practice':
      case 'bug':
        return 'Implementation';
      default:
        return 'Implementation';
    }
  }

  /**
   * Build task description from issue
   */
  private buildTaskDescription(issue: DetectedIssue): string {
    let description = issue.description;

    if (issue.location) {
      description += `\n\nLocation: ${issue.location}`;
    }

    if (issue.recommendation) {
      description += `\n\nRecommendation: ${issue.recommendation}`;
    }

    description += `\n\nIssue Type: ${issue.type}`;
    description += `\nSeverity: ${issue.severity}`;
    description += `\nDetected by: ${issue.agentRole}`;

    if (issue.artifactId) {
      description += `\nRelated Artifact ID: ${issue.artifactId}`;
    }

    return description;
  }
}

export const issueTaskCreationService = new IssueTaskCreationService();



