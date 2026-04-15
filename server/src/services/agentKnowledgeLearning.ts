/**
 * Agent Knowledge Learning Service
 * Automatically enhances agent knowledge based on executed tasks, audits, and platform activities
 */

import { AgentKnowledge } from '../models/AgentKnowledge.model.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { Project } from '../models/Project.model.js';
import { logger } from '../utils/logger.js';

export interface TaskExecutionData {
  agentRole: string;
  taskTitle: string;
  taskDescription: string;
  success: boolean;
  evaluation?: {
    score: number;
    criteria: string[];
  };
  skillsUsed?: string[];
  domainsUsed?: string[];
  modelUsed?: string;
  provider?: string;
  latency?: number;
  tokensUsed?: number;
}

export interface AuditResult {
  agentRole: string;
  auditType: string;
  passed: boolean;
  findings: string[];
  score?: number;
  domain?: string;
}

export class AgentKnowledgeLearningService {
  /**
   * Update agent knowledge based on task execution
   */
  async learnFromTaskExecution(data: TaskExecutionData): Promise<void> {
    try {
      let agentKnowledge = await AgentKnowledge.findOne({ agentRole: data.agentRole });

      if (!agentKnowledge) {
        // Try to discover agent information from projects
        const { agentDiscovery } = await import('./agentDiscovery.service.js');
        
        // Try to find agent in projects to get initial data
        const projects = await Project.find({
          'agents.role': data.agentRole
        }).limit(1).lean();

        let discoveredAgent: any = null;
        if (projects.length > 0 && projects[0].agents) {
          const agent = projects[0].agents.find((a: any) => (a.role || a.agentRole) === data.agentRole);
          if (agent) {
            discoveredAgent = {
              agentRole: data.agentRole,
              name: agent.name,
              description: agent.description,
              goal: agent.goal,
              backstory: agent.backstory
            };
          }
        }

        // Create knowledge profile using discovery service
        await agentDiscovery.ensureAgentKnowledgeProfile(discoveredAgent || {
          agentRole: data.agentRole
        });
        
        // Reload the created agent knowledge
        agentKnowledge = await AgentKnowledge.findOne({ agentRole: data.agentRole });
        
        if (!agentKnowledge) {
          // Final fallback - create minimal profile
          agentKnowledge = await AgentKnowledge.create({
            agentRole: data.agentRole,
            knowledgeDomains: [],
            skills: [],
            specializations: [],
            metrics: {
              totalTasksCompleted: 0,
              averageTaskQuality: 0,
              averageResponseTime: 0
            },
            preferredModels: [],
            knowledgeBaseRefs: [],
            metadata: { 
              version: 1,
              notes: `Auto-created during task execution`
            }
          });
        }
        
        logger.info(`Auto-created knowledge profile for new agent: ${data.agentRole}`);
      }

      // Update metrics
      const totalTasks = agentKnowledge.metrics.totalTasksCompleted + 1;
      const currentQuality = agentKnowledge.metrics.averageTaskQuality;
      const newQuality = data.evaluation?.score || (data.success ? 85 : 60);
      const avgQuality = ((currentQuality * (totalTasks - 1)) + newQuality) / totalTasks;

      const currentLatency = agentKnowledge.metrics.averageResponseTime || 0;
      const newLatency = data.latency || 0;
      const avgLatency = totalTasks > 1
        ? ((currentLatency * (totalTasks - 1)) + newLatency) / totalTasks
        : newLatency;

      agentKnowledge.metrics.totalTasksCompleted = totalTasks;
      agentKnowledge.metrics.averageTaskQuality = Math.round(avgQuality * 100) / 100;
      if (newLatency > 0) {
        agentKnowledge.metrics.averageResponseTime = Math.round(avgLatency);
      }
      agentKnowledge.metrics.lastActiveDate = new Date();

      // Update skills based on task execution
      if (data.skillsUsed && data.skillsUsed.length > 0) {
        for (const skillName of data.skillsUsed) {
          const existingSkill = agentKnowledge.skills.find(s => s.skill === skillName);
          
          if (existingSkill) {
            // Update existing skill
            existingSkill.tasksCompleted = (existingSkill.tasksCompleted || 0) + 1;
            existingSkill.lastUsed = new Date();
            
            // Improve proficiency based on success and evaluation
            if (data.success && data.evaluation?.score) {
              const improvement = this.calculateSkillImprovement(
                existingSkill.proficiency,
                data.evaluation.score,
                data.success
              );
              existingSkill.proficiency = Math.min(100, Math.max(0, existingSkill.proficiency + improvement));
              
              // Update experience level if proficiency increased significantly
              if (existingSkill.proficiency >= 90 && existingSkill.experienceLevel !== 'expert') {
                existingSkill.experienceLevel = 'expert';
              } else if (existingSkill.proficiency >= 75 && existingSkill.experienceLevel === 'beginner') {
                existingSkill.experienceLevel = 'intermediate';
              } else if (existingSkill.proficiency >= 60 && existingSkill.experienceLevel === 'beginner') {
                existingSkill.experienceLevel = 'intermediate';
              }
            }
            
            // Update success rate
            const currentSuccessRate = existingSkill.successRate || 100;
            const successCount = Math.floor((currentSuccessRate / 100) * (existingSkill.tasksCompleted - 1));
            const newSuccessRate = data.success 
              ? ((successCount + 1) / existingSkill.tasksCompleted) * 100
              : (successCount / existingSkill.tasksCompleted) * 100;
            existingSkill.successRate = Math.round(newSuccessRate * 100) / 100;
          } else {
            // Add new skill discovered from task
            const initialProficiency = data.success && data.evaluation?.score
              ? Math.max(60, data.evaluation.score)
              : data.success ? 70 : 50;
            
            agentKnowledge.skills.push({
              skill: skillName,
              category: this.inferCategory(skillName),
              proficiency: initialProficiency,
              experienceLevel: initialProficiency >= 75 ? 'intermediate' : 'beginner',
              lastUsed: new Date(),
              successRate: data.success ? 100 : 0,
              tasksCompleted: 1
            });
          }
        }
      }

      // Update knowledge domains
      if (data.domainsUsed && data.domainsUsed.length > 0) {
        for (const domainName of data.domainsUsed) {
          const existingDomain = agentKnowledge.knowledgeDomains.find(d => d.domain === domainName);
          
          if (existingDomain) {
            // Improve domain level based on successful execution
            if (data.success && data.evaluation?.score) {
              const improvement = this.calculateDomainImprovement(
                existingDomain.level,
                data.evaluation.score
              );
              existingDomain.level = Math.min(100, Math.max(0, existingDomain.level + improvement));
              existingDomain.lastUpdated = new Date();
            }
          } else {
            // Add new domain discovered
            const initialLevel = data.success && data.evaluation?.score
              ? Math.max(50, data.evaluation.score)
              : data.success ? 60 : 40;
            
            agentKnowledge.knowledgeDomains.push({
              domain: domainName,
              level: initialLevel,
              lastUpdated: new Date(),
              examples: []
            });
          }
        }
      }

      // Update preferred models based on usage and performance
      if (data.modelUsed && data.provider) {
        const existingModel = agentKnowledge.preferredModels.find(
          m => m.modelId === data.modelUsed && m.provider === data.provider
        );

        if (existingModel) {
          existingModel.usageCount += 1;
          existingModel.lastUsed = new Date();
          
          if (data.latency) {
            const currentAvgLatency = existingModel.averageLatency || 0;
            const newAvgLatency = existingModel.usageCount > 1
              ? ((currentAvgLatency * (existingModel.usageCount - 1)) + data.latency) / existingModel.usageCount
              : data.latency;
            existingModel.averageLatency = Math.round(newAvgLatency);
          }

          // Update success rate
          const currentSuccessRate = existingModel.successRate || 100;
          const successCount = Math.floor((currentSuccessRate / 100) * (existingModel.usageCount - 1));
          const newSuccessRate = data.success
            ? ((successCount + 1) / existingModel.usageCount) * 100
            : (successCount / existingModel.usageCount) * 100;
          existingModel.successRate = Math.round(newSuccessRate * 100) / 100;
        } else {
          // Add new model preference
          agentKnowledge.preferredModels.push({
            modelId: data.modelUsed,
            provider: data.provider,
            usageCount: 1,
            successRate: data.success ? 100 : 0,
            averageLatency: data.latency || 0,
            lastUsed: new Date()
          });
        }

        // Sort by usage count
        agentKnowledge.preferredModels.sort((a, b) => b.usageCount - a.usageCount);
      }

      await agentKnowledge.save();
      
      logger.info(`Updated knowledge for agent ${data.agentRole} from task execution`);

      // ENHANCEMENT: Auto-generate process improvement from successful high-quality tasks
      if (data.success && data.evaluation && data.evaluation.score >= 70) {
        try {
          const { processImprovementService } = await import('./processImprovement.service.js');
          await processImprovementService.generateFromAgentLearning(data.agentRole, {
            taskTitle: data.taskTitle,
            taskDescription: data.taskDescription,
            success: data.success,
            evaluation: data.evaluation,
            skillsUsed: data.skillsUsed,
            domainsUsed: data.domainsUsed
          });
          logger.debug(`Attempted to generate process improvement from ${data.agentRole} task`);
        } catch (improvementError: any) {
          logger.debug('Process improvement generation skipped (non-critical):', improvementError.message);
        }
      }
    } catch (error: unknown) {
      logger.error(`Failed to learn from task execution for ${data.agentRole}:`, error);
      // Don't throw - learning failures shouldn't break task execution
    }
  }

  /**
   * Learn from audit results
   */
  async learnFromAudit(audit: AuditResult): Promise<void> {
    try {
      let agentKnowledge = await AgentKnowledge.findOne({ agentRole: audit.agentRole });

      if (!agentKnowledge) {
        return; // Skip if agent knowledge doesn't exist
      }

      // Update relevant domain based on audit
      if (audit.domain) {
        const domain = agentKnowledge.knowledgeDomains.find(d => d.domain === audit.domain);
        if (domain) {
          // Improve domain level if audit passed
          if (audit.passed) {
            const improvement = audit.score ? audit.score / 10 : 2;
            domain.level = Math.min(100, domain.level + improvement);
          } else {
            // Slight decrease if failed, but with learning opportunity
            domain.level = Math.max(0, domain.level - 1);
          }
          domain.lastUpdated = new Date();
          
          // Add audit findings as examples if passed
          if (audit.passed && audit.findings.length > 0 && domain.examples) {
            audit.findings.forEach(finding => {
              if (domain.examples && !domain.examples.includes(finding)) {
                domain.examples.push(finding);
                // Keep only last 10 examples
                if (domain.examples.length > 10) {
                  domain.examples.shift();
                }
              }
            });
          }
        }
      }

      // Update metrics based on audit
      if (audit.score !== undefined) {
        const totalTasks = agentKnowledge.metrics.totalTasksCompleted || 0;
        if (totalTasks > 0) {
          const currentQuality = agentKnowledge.metrics.averageTaskQuality;
          const newQuality = audit.score;
          const avgQuality = ((currentQuality * totalTasks) + newQuality) / (totalTasks + 1);
          agentKnowledge.metrics.averageTaskQuality = Math.round(avgQuality * 100) / 100;
        }
      }

      await agentKnowledge.save();
      
      logger.info(`Updated knowledge for agent ${audit.agentRole} from audit: ${audit.auditType}`);
    } catch (error: unknown) {
      logger.error(`Failed to learn from audit for ${audit.agentRole}:`, error);
    }
  }

  /**
   * Aggregate learning from all platform activities
   */
  async aggregatePlatformLearning(): Promise<void> {
    try {
      logger.info('Starting platform-wide knowledge aggregation...');

      // Get all agents
      const agents = await AgentKnowledge.find({});
      
      // Get LLM usage stats from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const usageStats = await LLMUsage.aggregate([
        {
          $match: {
            timestamp: { $gte: sevenDaysAgo },
            agentRole: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$agentRole',
            totalCalls: { $sum: 1 },
            successfulCalls: { $sum: { $cond: ['$success', 1, 0] } },
            avgLatency: { $avg: '$latencyMs' },
            models: {
              $push: {
                modelId: '$modelId',
                provider: '$provider',
                success: '$success',
                latency: '$latencyMs'
              }
            }
          }
        }
      ]);

      // Update each agent's knowledge based on aggregated stats
      for (const stat of usageStats) {
        const agent = agents.find(a => a.agentRole === stat._id);
        if (!agent) continue;

        // Update metrics
        const successRate = stat.totalCalls > 0
          ? (stat.successfulCalls / stat.totalCalls) * 100
          : 0;

        // Update preferred models based on usage
        const modelMap = new Map<string, {
          count: number;
          success: number;
          latency: number[];
        }>();

        stat.models.forEach((m: any) => {
          const key = `${m.provider}:${m.modelId}`;
          const existing = modelMap.get(key) || { count: 0, success: 0, latency: [] };
          existing.count++;
          if (m.success) existing.success++;
          if (m.latency) existing.latency.push(m.latency);
          modelMap.set(key, existing);
        });

        // Update or add preferred models
        for (const [key, data] of modelMap.entries()) {
          const [provider, modelId] = key.split(':');
          const existing = agent.preferredModels.find(
            m => m.modelId === modelId && m.provider === provider
          );

          if (existing) {
            existing.usageCount += data.count;
            existing.successRate = (existing.successRate + (data.success / data.count * 100)) / 2;
            if (data.latency.length > 0) {
              const avgLatency = data.latency.reduce((a, b) => a + b, 0) / data.latency.length;
              existing.averageLatency = (existing.averageLatency + avgLatency) / 2;
            }
            existing.lastUsed = new Date();
          } else {
            agent.preferredModels.push({
              modelId,
              provider,
              usageCount: data.count,
              successRate: (data.success / data.count) * 100,
              averageLatency: data.latency.length > 0
                ? data.latency.reduce((a, b) => a + b, 0) / data.latency.length
                : 0,
              lastUsed: new Date()
            });
          }
        }

        agent.preferredModels.sort((a, b) => b.usageCount - a.usageCount);
        await agent.save();
      }

      logger.info(`Aggregated learning for ${usageStats.length} agents`);
    } catch (error: unknown) {
      logger.error('Failed to aggregate platform learning:', error);
    }
  }

  /**
   * Extract skills and domains from task description using keyword matching
   */
  extractSkillsFromTask(taskTitle: string, taskDescription: string, agentRole: string): string[] {
    const skills: string[] = [];
    const description = `${taskTitle} ${taskDescription}`.toLowerCase();

    // Common skill keywords mapping
    const skillKeywords: Record<string, string[]> = {
      'React Development': ['react', 'jsx', 'component', 'hook', 'state'],
      'Node.js': ['node', 'express', 'server', 'api', 'backend'],
      'TypeScript': ['typescript', 'ts', 'type', 'interface'],
      'API Design': ['api', 'endpoint', 'rest', 'graphql', 'route'],
      'Database Design': ['database', 'sql', 'mongodb', 'schema', 'model'],
      'Testing': ['test', 'jest', 'cypress', 'unit', 'integration'],
      'Security Auditing': ['security', 'vulnerability', 'audit', 'owasp'],
      'UI Design': ['ui', 'ux', 'design', 'wireframe', 'prototype'],
      'Code Review': ['review', 'refactor', 'code quality'],
      'Deployment': ['deploy', 'ci/cd', 'docker', 'kubernetes']
    };

    for (const [skill, keywords] of Object.entries(skillKeywords)) {
      if (keywords.some(keyword => description.includes(keyword))) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * Extract knowledge domains from task
   */
  extractDomainsFromTask(taskTitle: string, taskDescription: string): string[] {
    const domains: string[] = [];
    const description = `${taskTitle} ${taskDescription}`.toLowerCase();

    const domainKeywords: Record<string, string[]> = {
      'Frontend Development': ['frontend', 'ui', 'client', 'browser'],
      'Backend Development': ['backend', 'server', 'api', 'database'],
      'Security': ['security', 'authentication', 'authorization', 'encryption'],
      'Testing': ['test', 'qa', 'quality'],
      'DevOps': ['deploy', 'infrastructure', 'ci/cd', 'devops'],
      'Architecture': ['architecture', 'design pattern', 'system design'],
      'Project Management': ['project', 'planning', 'coordination']
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => description.includes(keyword))) {
        domains.push(domain);
      }
    }

    return domains;
  }

  /**
   * Calculate skill improvement based on performance
   */
  private calculateSkillImprovement(currentProficiency: number, evaluationScore: number, success: boolean): number {
    if (!success) return -0.5; // Small decrease for failure

    const scoreDiff = evaluationScore - currentProficiency;
    // Improve by 1-2% based on how much better the score is
    if (scoreDiff > 20) return 2;
    if (scoreDiff > 10) return 1.5;
    if (scoreDiff > 0) return 1;
    if (scoreDiff > -5) return 0.5;
    return 0; // No improvement if score is worse
  }

  /**
   * Calculate domain improvement
   */
  private calculateDomainImprovement(currentLevel: number, evaluationScore: number): number {
    const scoreDiff = evaluationScore - currentLevel;
    if (scoreDiff > 15) return 1.5;
    if (scoreDiff > 5) return 1;
    if (scoreDiff > 0) return 0.5;
    return 0;
  }

  /**
   * Infer category from skill name
   */
  private inferCategory(skillName: string): string {
    const lower = skillName.toLowerCase();
    if (lower.includes('test') || lower.includes('qa')) return 'Testing';
    if (lower.includes('security') || lower.includes('audit')) return 'Security';
    if (lower.includes('design') || lower.includes('ui')) return 'Design';
    if (lower.includes('deploy') || lower.includes('devops')) return 'DevOps';
    if (lower.includes('react') || lower.includes('vue') || lower.includes('angular')) return 'Frontend';
    if (lower.includes('node') || lower.includes('api') || lower.includes('server')) return 'Backend';
    return 'Technical';
  }
}

export const agentKnowledgeLearning = new AgentKnowledgeLearningService();

