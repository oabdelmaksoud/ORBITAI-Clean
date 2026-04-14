/**
 * Agent Knowledge Enhanced Routes
 * Provides confidence scores, version history, and shared knowledge
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AgentKnowledge } from '../models/AgentKnowledge.model.js';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/agentKnowledgeEnhanced/confidence?agentRole=&agentId=
 * Returns per-domain confidence scores from knowledgeDomains array
 */
router.get('/confidence', async (req: AuthRequest, res, next) => {
  try {
    const { agentRole, agentId } = req.query;

    const query: Record<string, any> = {};
    if (agentRole) query.agentRole = agentRole;
    if (agentId) query.agentId = agentId;

    const records = await AgentKnowledge.find(query).lean();

    const scores = records.flatMap(record =>
      (record.knowledgeDomains || []).map(domain => ({
        domain: domain.domain,
        level: domain.level,
        confidence: domain.confidence,
        lastUpdated: domain.lastUpdated,
        trend: 'stable' as const,
      }))
    );

    res.json({ success: true, data: scores });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentKnowledgeEnhanced/versions?agentRole=&agentId=
 * Returns version history derived from metadata and training history
 */
router.get('/versions', async (req: AuthRequest, res, next) => {
  try {
    const { agentRole, agentId } = req.query;

    const query: Record<string, any> = {};
    if (agentRole) query.agentRole = agentRole;
    if (agentId) query.agentId = agentId;

    const records = await AgentKnowledge.find(query).lean();

    const versions = records.map(record => ({
      version: record.metadata?.version || 1,
      content: record.metadata?.notes || '',
      changedBy: 'system',
      changeReason: record.metadata?.trainingData || 'Knowledge update',
      timestamp: record.metadata?.lastTrained || record.updatedAt,
      status: 'active' as const,
      skills: (record.skills || []).map(s => ({
        skill: s.skill,
        lastUsed: s.lastUsed,
      })),
    }));

    res.json({ success: true, data: versions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentKnowledgeEnhanced/shared?projectId=&scope=
 * Returns shared knowledge entries (all records since no isPublic/projectId field)
 */
router.get('/shared', async (req: AuthRequest, res, next) => {
  try {
    const { scope } = req.query;

    const records = await AgentKnowledge.find({}).sort({ updatedAt: -1 }).lean();

    const shared = records.map(record => ({
      _id: record._id,
      knowledgeId: String(record._id),
      sourceProjectId: 'global',
      sourceProjectName: record.agentRole,
      scope: (scope && scope !== 'all' ? scope : 'global') as
        | 'project'
        | 'user'
        | 'global',
      qualityScore: record.metrics?.averageTaskQuality || 0,
      sharedAt: record.updatedAt,
      sharedBy: 'system',
    }));

    res.json({ success: true, data: shared });
  } catch (error) {
    next(error);
  }
});

export default router;
