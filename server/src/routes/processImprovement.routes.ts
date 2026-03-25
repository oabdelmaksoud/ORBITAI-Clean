/**
 * Process Improvement Routes
 * API endpoints for managing process improvements, guidelines, templates, and knowledge base
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { processImprovementService } from '../services/processImprovement.service.js';
import { ProcessImprovement } from '../models/ProcessImprovement.model.js';
import { KnowledgeBase } from '../models/KnowledgeBase.model.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/process-improvements
 * List all process improvements with filters
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const {
      search,
      category,
      type,
      status,
      agentRole,
      methodology,
      tags,
      limit = 20,
      offset = 0
    } = req.query;

    const result = await processImprovementService.searchImprovements({
      search: search as string,
      category: category as string,
      type: type as string,
      status: status as string,
      agentRole: agentRole as string,
      methodology: methodology as string,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: {
        improvements: result.improvements,
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/process-improvements
 * Create new process improvement
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const improvement = await processImprovementService.createImprovement(
      req.body,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      data: improvement
    });
  } catch (error: any) {
    next(error);
  }
});

// ============ KNOWLEDGE BASE ROUTES ============
// IMPORTANT: These routes must be defined BEFORE /:id routes to prevent route conflicts

/**
 * GET /api/admin/process-improvements/knowledge-base
 * List all knowledge base entries
 */
router.get('/knowledge-base', async (req: AdminRequest, res, next) => {
  try {
    const {
      search,
      category,
      status,
      agentRole,
      parentId,
      limit = 20,
      offset = 0
    } = req.query;

    const filter: any = {};

    if (search) {
      filter.$text = { $search: search as string };
    }
    if (category) {
      filter.category = category;
    }
    if (status) {
      filter.status = status;
    }
    if (agentRole) {
      filter['applicableTo.agentRoles'] = agentRole;
    }
    if (parentId) {
      filter.parentId = parentId;
    } else if (parentId === null || parentId === 'null') {
      filter.parentId = { $exists: false };
    }

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const [entries, total] = await Promise.all([
      KnowledgeBase.find(filter)
        .sort({ priority: -1, 'usage.views': -1, createdAt: -1 })
        .limit(limitNum)
        .skip(offsetNum)
        .lean(),
      KnowledgeBase.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        entries,
        total,
        limit: limitNum,
        offset: offsetNum
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/knowledge-base/:id
 * Get specific knowledge base entry
 */
router.get('/knowledge-base/:id', async (req: AdminRequest, res, next) => {
  try {
    const entry = await KnowledgeBase.findOne({ id: req.params.id });
    
    if (!entry) {
      throw new AppError('Knowledge base entry not found', 404);
    }

    // Increment view count
    entry.usage.views += 1;
    entry.usage.lastViewed = new Date();
    await entry.save();

    res.json({
      success: true,
      data: entry
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/knowledge-base
 * Create new knowledge base entry
 */
router.post('/knowledge-base', async (req: AdminRequest, res, next) => {
  try {
    const entry = await processImprovementService.createKnowledgeBase(
      req.body,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      data: entry
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/knowledge-base/:id
 * Update knowledge base entry
 */
router.put('/knowledge-base/:id', async (req: AdminRequest, res, next) => {
  try {
    const entry = await KnowledgeBase.findOne({ id: req.params.id });
    
    if (!entry) {
      throw new AppError('Knowledge base entry not found', 404);
    }

    const oldVersion = entry.version;
    const changes: string[] = [];

    if (req.body.name && req.body.name !== entry.name) {
      changes.push(`Name: "${entry.name}" → "${req.body.name}"`);
    }
    if (req.body.content && req.body.content !== entry.content) {
      changes.push('Content updated');
    }

    Object.assign(entry, req.body);
    entry.version = oldVersion + 1;
    entry.updatedBy = req.user!.id;

    if (changes.length > 0) {
      entry.improvementHistory.push({
        version: entry.version,
        changedBy: req.user!.id,
        changeDate: new Date(),
        changeReason: req.body.changeReason || 'Updated by admin',
        changes: changes.join('; ')
      });
    }

    await entry.save();

    res.json({
      success: true,
      data: entry
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/admin/knowledge-base/:id
 * Delete knowledge base entry (soft delete - archive)
 */
router.delete('/knowledge-base/:id', async (req: AdminRequest, res, next) => {
  try {
    const entry = await KnowledgeBase.findOne({ id: req.params.id });
    
    if (!entry) {
      throw new AppError('Knowledge base entry not found', 404);
    }

    entry.status = 'archived';
    entry.updatedBy = req.user!.id;
    await entry.save();

    res.json({
      success: true,
      message: 'Knowledge base entry archived'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/process-improvements/agent/:agentRole
 * Get improvements for specific agent
 */
router.get('/agent/:agentRole', async (req: AdminRequest, res, next) => {
  try {
    const improvements = await processImprovementService.getImprovementsForAgent(
      req.params.agentRole
    );

    res.json({
      success: true,
      data: improvements
    });
  } catch (error: any) {
    next(error);
  }
});

// ============ PROCESS IMPROVEMENT CRUD ROUTES ============
// These routes must come AFTER specific routes like /knowledge-base and /agent/:agentRole

/**
 * GET /api/admin/process-improvements/:id
 * Get specific process improvement
 */
router.get('/:id', async (req: AdminRequest, res, next) => {
  try {
    const improvement = await ProcessImprovement.findOne({ id: req.params.id });
    
    if (!improvement) {
      throw new AppError('Process improvement not found', 404);
    }

    res.json({
      success: true,
      data: improvement
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/process-improvements/:id
 * Update process improvement
 */
router.put('/:id', async (req: AdminRequest, res, next) => {
  try {
    const { changeReason, ...updates } = req.body;
    const improvement = await processImprovementService.updateImprovement(
      req.params.id,
      updates,
      req.user!.id,
      changeReason
    );

    res.json({
      success: true,
      data: improvement
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/admin/process-improvements/:id
 * Delete process improvement (soft delete - archive)
 */
router.delete('/:id', async (req: AdminRequest, res, next) => {
  try {
    const improvement = await ProcessImprovement.findOne({ id: req.params.id });
    
    if (!improvement) {
      throw new AppError('Process improvement not found', 404);
    }

    improvement.status = 'archived';
    improvement.updatedBy = req.user!.id;
    await improvement.save();

    res.json({
      success: true,
      message: 'Process improvement archived'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/process-improvements/:id/approve
 * Approve process improvement
 */
router.post('/:id/approve', async (req: AdminRequest, res, next) => {
  try {
    const improvement = await ProcessImprovement.findOne({ id: req.params.id });
    
    if (!improvement) {
      throw new AppError('Process improvement not found', 404);
    }

    improvement.approval = {
      ...improvement.approval,
      status: 'approved',
      approvedBy: req.user!.id,
      approvedAt: new Date()
    };
    
    if (improvement.status === 'draft') {
      improvement.status = 'active';
    }

    await improvement.save();

    res.json({
      success: true,
      data: improvement
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/process-improvements/:id/reject
 * Reject process improvement
 */
router.post('/:id/reject', async (req: AdminRequest, res, next) => {
  try {
    const { reason } = req.body;
    const improvement = await ProcessImprovement.findOne({ id: req.params.id });
    
    if (!improvement) {
      throw new AppError('Process improvement not found', 404);
    }

    improvement.approval = {
      ...improvement.approval,
      status: 'rejected',
      rejectedReason: reason || 'Rejected by admin'
    };

    await improvement.save();

    res.json({
      success: true,
      data: improvement
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/process-improvements/:id/usage
 * Record usage of improvement
 */
router.post('/:id/usage', async (req: AdminRequest, res, next) => {
  try {
    const { success } = req.body;
    await processImprovementService.recordUsage(req.params.id, success === true);

    res.json({
      success: true,
      message: 'Usage recorded'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/process-improvements/assess-pending
 * Trigger agent assessment for all pending process improvements
 */
router.post('/assess-pending', async (req: AdminRequest, res, next) => {
  try {
    // Trigger assessment in background (don't wait for completion)
    processImprovementService.assessAllPendingImprovements().catch((error: unknown) => {
      logger.error('Failed to assess pending improvements:', error);
    });

    res.json({
      success: true,
      message: 'Agent assessment initiated for all pending improvements. This will run in the background.'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/process-improvements/:id/assess
 * Trigger agent assessment for a specific process improvement
 */
router.post('/:id/assess', async (req: AdminRequest, res, next) => {
  try {
    const improvement = await ProcessImprovement.findOne({ id: req.params.id });
    
    if (!improvement) {
      throw new AppError('Process improvement not found', 404);
    }

    // Trigger assessment in background (don't wait for completion)
    processImprovementService.triggerAgentAssessmentForImprovement(req.params.id).catch((error: unknown) => {
      logger.error(`Failed to assess improvement ${req.params.id}:`, error);
    });

    res.json({
      success: true,
      message: 'Agent assessment initiated. This will run in the background.',
      data: improvement
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/process-improvements/cleanup-stuck
 * Clean up stuck improvements that are in agent-assessing or agent-refining status
 */
router.post('/cleanup-stuck', async (req: AdminRequest, res, next) => {
  try {
    const { timeoutMinutes = 5 } = req.body;
    
    logger.info(`Admin ${req.admin?.email} triggered stuck improvements cleanup (timeout: ${timeoutMinutes} minutes)`);
    
    const result = await processImprovementService.cleanupStuckImprovements(timeoutMinutes);

    res.json({
      success: true,
      message: `Cleaned up ${result.cleaned} stuck improvements`,
      data: result
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/process-improvements/stuck
 * Get list of stuck improvements
 */
router.get('/stuck', async (req: AdminRequest, res, next) => {
  try {
    const { timeoutMinutes = 5 } = req.query;
    const cutoffTime = new Date(Date.now() - parseInt(timeoutMinutes as string) * 60 * 1000);
    
    const stuckImprovements = await ProcessImprovement.find({
      'approval.status': { $in: ['agent-assessing', 'agent-refining'] },
      updatedAt: { $lt: cutoffTime }
    }).select('_id title approval.status updatedAt createdAt');

    res.json({
      success: true,
      data: {
        count: stuckImprovements.length,
        improvements: stuckImprovements,
        cutoffTime: cutoffTime.toISOString()
      }
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;



