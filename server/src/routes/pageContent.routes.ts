import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { PageContent } from '../models/PageContent.model.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/page-content/:pageKey
 * Get all sections for a specific page
 */
router.get('/:pageKey', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey } = req.params;
    
    const sections = await PageContent.find({ 
      pageKey,
      isActive: true 
    })
      .sort({ sortOrder: 1 })
      .lean();
    
    // Convert to object format keyed by sectionKey
    const sectionsMap: Record<string, any> = {};
    sections.forEach(section => {
      sectionsMap[section.sectionKey] = {
        id: section._id.toString(),
        pageKey: section.pageKey,
        sectionKey: section.sectionKey,
        content: section.content,
        isActive: section.isActive,
        sortOrder: section.sortOrder,
        metadata: section.metadata || {},
        createdAt: section.createdAt,
        updatedAt: section.updatedAt
      };
    });
    
    res.json({
      success: true,
      data: {
        pageKey,
        sections: sectionsMap
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get page content:', error);
    next(error);
  }
});

/**
 * GET /api/admin/page-content/:pageKey/:sectionKey
 * Get a specific section
 */
router.get('/:pageKey/:sectionKey', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey, sectionKey } = req.params;
    
    const section = await PageContent.findOne({ 
      pageKey,
      sectionKey 
    }).lean();
    
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        section: {
          id: section._id.toString(),
          pageKey: section.pageKey,
          sectionKey: section.sectionKey,
          content: section.content,
          isActive: section.isActive,
          sortOrder: section.sortOrder,
          metadata: section.metadata || {},
          createdAt: section.createdAt,
          updatedAt: section.updatedAt
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get page section:', error);
    next(error);
  }
});

/**
 * POST /api/admin/page-content
 * Create or update a page section (upsert)
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey, sectionKey, content, isActive, sortOrder } = req.body;
    
    if (!pageKey || !sectionKey) {
      throw new AppError('pageKey and sectionKey are required', 400);
    }
    
    // Upsert: find existing or create new
    const existing = await PageContent.findOne({ pageKey, sectionKey });
    
    const sectionData = {
      pageKey,
      sectionKey,
      content: content || {},
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder !== undefined ? sortOrder : 0,
      metadata: {
        lastEditedBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedAt: new Date(),
        version: existing ? ((existing.metadata?.version || 0) + 1) : 1
      }
    };
    
    let section;
    if (existing) {
      // Update existing
      section = await PageContent.findOneAndUpdate(
        { pageKey, sectionKey },
        { $set: sectionData },
        { new: true }
      ).lean();
      
      await logAudit(req, {
        action: 'page_content.updated',
        entityType: 'page_content',
        entityId: existing._id.toString(),
        details: { pageKey, sectionKey }
      });
      
      logger.info(`Admin ${req.admin?.email} updated page section ${pageKey}.${sectionKey}`);
    } else {
      // Create new
      section = await PageContent.create(sectionData);
      
      await logAudit(req, {
        action: 'page_content.created',
        entityType: 'page_content',
        entityId: section._id.toString(),
        details: { pageKey, sectionKey }
      });
      
      logger.info(`Admin ${req.admin?.email} created page section ${pageKey}.${sectionKey}`);
    }
    
    res.json({
      success: true,
      data: {
        section: {
          id: section._id.toString(),
          pageKey: section.pageKey,
          sectionKey: section.sectionKey,
          content: section.content,
          isActive: section.isActive,
          sortOrder: section.sortOrder,
          metadata: section.metadata || {},
          createdAt: section.createdAt,
          updatedAt: section.updatedAt
        }
      }
    });
  } catch (error: unknown) {
    await logAudit(req, {
      action: 'page_content.create',
      entityType: 'page_content',
      status: 'failed',
      errorMessage: error.message
    });
    logger.error('Failed to save page content:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/page-content/:pageKey/:sectionKey
 * Update a specific section
 */
router.put('/:pageKey/:sectionKey', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey, sectionKey } = req.params;
    const { content, isActive, sortOrder } = req.body;
    
    const existing = await PageContent.findOne({ pageKey, sectionKey });
    
    if (!existing) {
      throw new AppError('Section not found', 404);
    }
    
    const updates: any = {
      metadata: {
        ...existing.metadata,
        lastEditedBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedAt: new Date(),
        version: (existing.metadata?.version || 0) + 1
      }
    };
    
    if (content !== undefined) updates.content = content;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    
    const updated = await PageContent.findOneAndUpdate(
      { pageKey, sectionKey },
      { $set: updates },
      { new: true }
    ).lean();
    
    await logAudit(req, {
      action: 'page_content.updated',
      entityType: 'page_content',
      entityId: existing._id.toString(),
      details: { pageKey, sectionKey }
    });
    
    logger.info(`Admin ${req.admin?.email} updated page section ${pageKey}.${sectionKey}`);
    
    res.json({
      success: true,
      data: {
        section: {
          id: updated?._id.toString(),
          pageKey: updated?.pageKey,
          sectionKey: updated?.sectionKey,
          content: updated?.content,
          isActive: updated?.isActive,
          sortOrder: updated?.sortOrder,
          metadata: updated?.metadata || {},
          createdAt: updated?.createdAt,
          updatedAt: updated?.updatedAt
        }
      }
    });
  } catch (error: unknown) {
    await logAudit(req, {
      action: 'page_content.update',
      entityType: 'page_content',
      entityId: `${req.params.pageKey}.${req.params.sectionKey}`,
      status: 'failed',
      errorMessage: error.message
    });
    logger.error('Failed to update page content:', error);
    next(error);
  }
});

/**
 * DELETE /api/admin/page-content/:pageKey/:sectionKey
 * Delete (deactivate) a section
 */
router.delete('/:pageKey/:sectionKey', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey, sectionKey } = req.params;
    
    const section = await PageContent.findOne({ pageKey, sectionKey });
    
    if (!section) {
      throw new AppError('Section not found', 404);
    }
    
    // Soft delete - set isActive to false
    section.isActive = false;
    await section.save();
    
    await logAudit(req, {
      action: 'page_content.deleted',
      entityType: 'page_content',
      entityId: section._id.toString(),
      details: { pageKey, sectionKey }
    });
    
    logger.info(`Admin ${req.admin?.email} deleted page section ${pageKey}.${sectionKey}`);
    
    res.json({
      success: true,
      message: 'Section deactivated successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to delete page content:', error);
    next(error);
  }
});

/**
 * GET /api/admin/page-content/public/:pageKey
 * Get public page content (no auth required)
 */
router.get('/public/:pageKey', async (req, res, next) => {
  try {
    const { pageKey } = req.params;
    
    const sections = await PageContent.find({ 
      pageKey,
      isActive: true 
    })
      .sort({ sortOrder: 1 })
      .lean();
    
    // Convert to object format
    const sectionsMap: Record<string, any> = {};
    sections.forEach(section => {
      sectionsMap[section.sectionKey] = {
        content: section.content
      };
    });
    
    res.json({
      success: true,
      data: {
        pageKey,
        sections: sectionsMap
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get public page content:', error);
    next(error);
  }
});

export default router;

