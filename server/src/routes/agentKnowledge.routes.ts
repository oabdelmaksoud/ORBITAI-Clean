import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AgentKnowledge } from '../models/AgentKnowledge.model.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/agent-knowledge
 * Get knowledge and skill matrix for all agents
 */
router.get('/', async (_req: AdminRequest, res, next) => {
  try {
    const agents = await AgentKnowledge.find({})
      .sort({ 'metrics.totalTasksCompleted': -1 })
      .lean();

    // Get model usage statistics for each agent
    const modelUsageStats = await LLMUsage.aggregate([
      {
        $group: {
          _id: '$agentRole',
          modelUsage: {
            $push: {
              modelId: '$modelId',
              provider: '$provider',
              success: '$success',
              latencyMs: '$latencyMs',
              timestamp: '$timestamp'
            }
          }
        }
      }
    ]);

    // Calculate model preferences per agent from usage stats
    const agentsWithModelStats = agents.map(agent => {
      const usageForAgent = modelUsageStats.find(stat => stat._id === agent.agentRole);
      
      if (usageForAgent) {
        // Calculate model statistics
        const modelMap = new Map<string, {
          usageCount: number;
          successCount: number;
          totalLatency: number;
          lastUsed?: Date;
        }>();

        usageForAgent.modelUsage.forEach((usage: any) => {
          const key = `${usage.provider}:${usage.modelId}`;
          const existing = modelMap.get(key) || {
            usageCount: 0,
            successCount: 0,
            totalLatency: 0,
            lastUsed: undefined
          };
          
          existing.usageCount++;
          if (usage.success) existing.successCount++;
          if (usage.latencyMs) existing.totalLatency += usage.latencyMs;
          if (usage.timestamp && (!existing.lastUsed || usage.timestamp > existing.lastUsed)) {
            existing.lastUsed = usage.timestamp;
          }
          
          modelMap.set(key, existing);
        });

        // Convert to preferredModels format
        const preferredModels = Array.from(modelMap.entries()).map(([key, stats]) => {
          const [provider, modelId] = key.split(':');
          return {
            modelId,
            provider,
            usageCount: stats.usageCount,
            successRate: stats.usageCount > 0 ? (stats.successCount / stats.usageCount) * 100 : 0,
            averageLatency: stats.usageCount > 0 ? stats.totalLatency / stats.usageCount : 0,
            lastUsed: stats.lastUsed
          };
        }).sort((a, b) => b.usageCount - a.usageCount);

        return {
          ...agent,
          preferredModels: [...(agent.preferredModels || []), ...preferredModels]
            .reduce((acc, model) => {
              const existing = acc.find(m => m.modelId === model.modelId && m.provider === model.provider);
              if (existing) {
                existing.usageCount += model.usageCount;
                existing.successRate = (existing.successRate + model.successRate) / 2;
                existing.averageLatency = (existing.averageLatency + model.averageLatency) / 2;
                if (model.lastUsed && (!existing.lastUsed || model.lastUsed > existing.lastUsed)) {
                  existing.lastUsed = model.lastUsed;
                }
              } else {
                acc.push(model);
              }
              return acc;
            }, [] as any[])
            .sort((a, b) => b.usageCount - a.usageCount)
        };
      }

      return agent;
    });

    res.json({
      success: true,
      data: {
        agents: agentsWithModelStats,
        totalAgents: agents.length,
        summary: {
          totalTasksCompleted: agents.reduce((sum, a) => sum + (a.metrics?.totalTasksCompleted || 0), 0),
          averageQuality: agents.length > 0
            ? agents.reduce((sum, a) => sum + (a.metrics?.averageTaskQuality || 0), 0) / agents.length
            : 0,
          totalSkills: agents.reduce((sum, a) => sum + (a.skills?.length || 0), 0),
          totalKnowledgeDomains: agents.reduce((sum, a) => sum + (a.knowledgeDomains?.length || 0), 0)
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get agent knowledge matrix:', error);
    next(error);
  }
});

/**
 * GET /api/admin/agent-knowledge/:agentRole
 * Get knowledge and skill matrix for a specific agent role
 */
router.get('/:agentRole', async (req: AdminRequest, res, next) => {
  try {
    const { agentRole } = req.params;
    
    const agent = await AgentKnowledge.findOne({ agentRole }).lean();
    
    if (!agent) {
      res.status(404).json({
        success: false,
        message: 'Agent knowledge not found'
      });
      return;
    }

    res.json({
      success: true,
      data: { agent }
    });
  } catch (error: unknown) {
    logger.error('Failed to get agent knowledge:', error);
    next(error);
  }
});

/**
 * GET /api/admin/agent-knowledge/matrix/global
 * Get global knowledge and skill matrix view
 */
router.get('/matrix/global', async (_req: AdminRequest, res, next) => {
  try {
    const agents = await AgentKnowledge.find({})
      .sort({ agentRole: 1 })
      .lean();

    // Build global skill matrix
    const skillMatrix: Record<string, {
      skill: string;
      category: string;
      agents: Array<{
        agentRole: string;
        proficiency: number;
        experienceLevel: string;
        tasksCompleted?: number;
      }>;
      averageProficiency: number;
    }> = {};

    // Build knowledge domain matrix
    const knowledgeMatrix: Record<string, {
      domain: string;
      agents: Array<{
        agentRole: string;
        level: number;
        lastUpdated?: Date;
      }>;
      averageLevel: number;
    }> = {};

    agents.forEach(agent => {
      // Process skills
      if (agent.skills) {
        agent.skills.forEach(skill => {
          const key = `${skill.category}:${skill.skill}`;
          if (!skillMatrix[key]) {
            skillMatrix[key] = {
              skill: skill.skill,
              category: skill.category,
              agents: [],
              averageProficiency: 0
            };
          }
          skillMatrix[key].agents.push({
            agentRole: agent.agentRole,
            proficiency: skill.proficiency,
            experienceLevel: skill.experienceLevel,
            tasksCompleted: skill.tasksCompleted
          });
        });
      }

      // Process knowledge domains
      if (agent.knowledgeDomains) {
        agent.knowledgeDomains.forEach(domain => {
          if (!knowledgeMatrix[domain.domain]) {
            knowledgeMatrix[domain.domain] = {
              domain: domain.domain,
              agents: [],
              averageLevel: 0
            };
          }
          knowledgeMatrix[domain.domain].agents.push({
            agentRole: agent.agentRole,
            level: domain.level,
            lastUpdated: domain.lastUpdated
          });
        });
      }
    });

    // Calculate averages
    Object.values(skillMatrix).forEach(matrix => {
      const sum = matrix.agents.reduce((s, a) => s + a.proficiency, 0);
      matrix.averageProficiency = matrix.agents.length > 0 ? sum / matrix.agents.length : 0;
    });

    Object.values(knowledgeMatrix).forEach(matrix => {
      const sum = matrix.agents.reduce((s, a) => s + a.level, 0);
      matrix.averageLevel = matrix.agents.length > 0 ? sum / matrix.agents.length : 0;
    });

    res.json({
      success: true,
      data: {
        agents: agents.map(a => ({
          agentRole: a.agentRole,
          metrics: a.metrics,
          specializations: a.specializations || []
        })),
        skillMatrix: Object.values(skillMatrix).sort((a, b) => b.averageProficiency - a.averageProficiency),
        knowledgeMatrix: Object.values(knowledgeMatrix).sort((a, b) => b.averageLevel - a.averageLevel),
        summary: {
          totalAgents: agents.length,
          totalSkills: Object.keys(skillMatrix).length,
          totalKnowledgeDomains: Object.keys(knowledgeMatrix).length
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get global knowledge matrix:', error);
    next(error);
  }
});

export default router;

