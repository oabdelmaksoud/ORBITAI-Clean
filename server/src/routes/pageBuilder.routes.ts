import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { Page } from '../models/Page.model.js';
import { PageRevision } from '../models/PageRevision.model.js';
import { PageTheme } from '../models/PageTheme.model.js';
import { PageTemplate } from '../models/PageTemplate.model.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  publishPage,
  rollbackToRevision,
  createAutoSaveRevision,
  getDefaultTheme,
} from '../services/pageBuilder.service.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/page-builder/blocks/registry
 * Get block registry schema
 */
router.get('/blocks/registry', async (_req: AdminRequest, res, next) => {
  try {
    // This will be populated from the frontend block registry
    // For now, return a basic structure
    const registry = {
      blocks: [
        {
          type: 'Container',
          category: 'Layout',
          icon: 'Layout',
          defaultProps: {
            padding: 'medium',
            backgroundColor: 'transparent',
          },
          schema: {
            padding: { type: 'select', options: ['none', 'small', 'medium', 'large'] },
            backgroundColor: { type: 'color' },
          },
        },
        {
          type: 'Text',
          category: 'Content',
          icon: 'Type',
          defaultProps: {
            content: 'Enter text here',
            fontSize: 'medium',
            fontWeight: 'normal',
            textAlign: 'left',
          },
          schema: {
            content: { type: 'richText' },
            fontSize: { type: 'select', options: ['small', 'medium', 'large', 'xl'] },
            fontWeight: { type: 'select', options: ['normal', 'medium', 'bold'] },
            textAlign: { type: 'select', options: ['left', 'center', 'right', 'justify'] },
          },
        },
        {
          type: 'Heading',
          category: 'Content',
          icon: 'Heading',
          defaultProps: {
            level: 1,
            content: 'Heading',
            textAlign: 'left',
          },
          schema: {
            level: { type: 'number', min: 1, max: 6 },
            content: { type: 'text' },
            textAlign: { type: 'select', options: ['left', 'center', 'right'] },
          },
        },
        {
          type: 'Image',
          category: 'Media',
          icon: 'Image',
          defaultProps: {
            src: '',
            alt: '',
            width: '100%',
            height: 'auto',
          },
          schema: {
            src: { type: 'image' },
            alt: { type: 'text' },
            width: { type: 'text' },
            height: { type: 'text' },
          },
        },
        {
          type: 'Button',
          category: 'Content',
          icon: 'MousePointer',
          defaultProps: {
            text: 'Click me',
            link: '#',
            variant: 'primary',
            size: 'medium',
          },
          schema: {
            text: { type: 'text' },
            link: { type: 'url' },
            variant: { type: 'select', options: ['primary', 'secondary', 'outline'] },
            size: { type: 'select', options: ['small', 'medium', 'large'] },
          },
        },
        {
          type: 'Hero',
          category: 'Sections',
          icon: 'Star',
          defaultProps: {
            title: 'Hero Title',
            subtitle: 'Hero subtitle',
            description: 'Hero description',
            backgroundImage: '',
            ctaText: 'Get Started',
            ctaLink: '#',
          },
          schema: {
            title: { type: 'text' },
            subtitle: { type: 'text' },
            description: { type: 'richText' },
            backgroundImage: { type: 'image' },
            ctaText: { type: 'text' },
            ctaLink: { type: 'url' },
          },
        },
      ],
    };

    res.json({
      success: true,
      data: registry,
    });
  } catch (error: unknown) {
    logger.error('Failed to get block registry:', error);
    next(error);
  }
});

/**
 * GET /api/admin/page-builder/pages
 * List all pages
 */
router.get('/pages', async (req: AdminRequest, res, next) => {
  try {
    const { status, search } = req.query;
    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      const safeSearch = (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { pageKey: { $regex: safeSearch, $options: 'i' } },
        { slug: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const pages = await Page.find(query).sort({ updatedAt: -1 }).lean();

    res.json({
      success: true,
      data: { pages },
    });
  } catch (error: unknown) {
    logger.error('Failed to list pages:', error);
    next(error);
  }
});

/**
 * GET /api/admin/page-builder/pages/:pageKey
 * Get a specific page
 */
router.get('/pages/:pageKey', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey } = req.params;
    const page = await Page.findOne({ pageKey }).lean();

    if (!page) {
      throw new AppError('Page not found', 404);
    }

    res.json({
      success: true,
      data: { page },
    });
  } catch (error: unknown) {
    logger.error('Failed to get page:', error);
    next(error);
  }
});

/**
 * POST /api/admin/page-builder/pages
 * Create a new page
 */
router.post('/pages', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey, title, slug, blocks, themeId, templateId, seo, settings } = req.body;

    if (!pageKey || !title || !slug) {
      throw new AppError('pageKey, title, and slug are required', 400);
    }

    // Check if pageKey already exists
    const existing = await Page.findOne({ $or: [{ pageKey }, { slug }] });
    if (existing) {
      throw new AppError('Page with this key or slug already exists', 400);
    }

    const defaultTheme = await getDefaultTheme();

    const page = await Page.create({
      pageKey,
      title,
      slug,
      status: 'draft',
      blocks: blocks || {},
      themeId: themeId || defaultTheme._id,
      templateId,
      seo: seo || {},
      settings: settings || {},
      metadata: {
        createdBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedAt: new Date(),
        version: 1,
      },
    });

    await logAudit(req, {
      action: 'page.created',
      entityType: 'page',
      entityId: page._id.toString(),
      details: { pageKey, title },
    });

    res.json({
      success: true,
      data: { page: page.toObject() },
    });
  } catch (error: unknown) {
    logger.error('Failed to create page:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/page-builder/pages/:pageKey
 * Update a page
 */
router.put('/pages/:pageKey', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey } = req.params;
    const { title, slug, blocks, themeId, templateId, seo, settings, autoSave } = req.body;

    const page = await Page.findOne({ pageKey });
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    const updates: any = {
      'metadata.lastEditedBy': req.admin?.email || req.user?.email || 'unknown',
      'metadata.lastEditedAt': new Date(),
    };

    if (title !== undefined) updates.title = title;
    if (slug !== undefined) updates.slug = slug;
    if (blocks !== undefined) updates.blocks = blocks;
    if (themeId !== undefined) updates.themeId = themeId;
    if (templateId !== undefined) updates.templateId = templateId;
    if (seo !== undefined) updates.seo = seo;
    if (settings !== undefined) updates.settings = settings;

    const updatedPage = await Page.findOneAndUpdate({ pageKey }, { $set: updates }, { new: true });

    // Create auto-save revision if requested
    if (autoSave && blocks) {
      await createAutoSaveRevision(
        page._id.toString(),
        blocks,
        req.admin?.email || req.user?.email || 'unknown'
      ).catch(err => logger.warn('Auto-save revision failed:', err));
    }

    await logAudit(req, {
      action: 'page.updated',
      entityType: 'page',
      entityId: page._id.toString(),
      details: { pageKey, autoSave },
    });

    res.json({
      success: true,
      data: { page: updatedPage?.toObject() },
    });
  } catch (error: unknown) {
    logger.error('Failed to update page:', error);
    next(error);
  }
});

/**
 * POST /api/admin/page-builder/pages/:pageKey/publish
 * Publish a page
 */
router.post('/pages/:pageKey/publish', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey } = req.params;
    const { scheduledAt } = req.body;

    const page = await Page.findOne({ pageKey });
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    const result = await publishPage({
      pageId: page._id.toString(),
      publishedBy: req.admin?.email || req.user?.email || 'unknown',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });

    await logAudit(req, {
      action: 'page.published',
      entityType: 'page',
      entityId: page._id.toString(),
      details: { pageKey, scheduledAt },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Failed to publish page:', error);
    next(error);
  }
});

/**
 * GET /api/admin/page-builder/pages/:pageKey/revisions
 * Get page revision history
 */
router.get('/pages/:pageKey/revisions', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey } = req.params;
    const { limit = 50 } = req.query;

    const page = await Page.findOne({ pageKey });
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    const revisions = await PageRevision.find({ pageId: page._id })
      .sort({ revisionNumber: -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: { revisions },
    });
  } catch (error: unknown) {
    logger.error('Failed to get revisions:', error);
    next(error);
  }
});

/**
 * POST /api/admin/page-builder/pages/:pageKey/rollback/:revisionId
 * Rollback to a specific revision
 */
router.post('/pages/:pageKey/rollback/:revisionId', async (req: AdminRequest, res, next) => {
  try {
    const { pageKey, revisionId } = req.params;

    const page = await Page.findOne({ pageKey });
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    const result = await rollbackToRevision({
      pageId: page._id.toString(),
      revisionId,
      rolledBackBy: req.admin?.email || req.user?.email || 'unknown',
    });

    await logAudit(req, {
      action: 'page.rollback',
      entityType: 'page',
      entityId: page._id.toString(),
      details: { pageKey, revisionId },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Failed to rollback page:', error);
    next(error);
  }
});

/**
 * GET /api/admin/page-builder/themes
 * List all themes
 */
router.get('/themes', async (_req: AdminRequest, res, next) => {
  try {
    const themes = await PageTheme.find().sort({ isDefault: -1, createdAt: -1 }).lean();

    res.json({
      success: true,
      data: { themes },
    });
  } catch (error: unknown) {
    logger.error('Failed to list themes:', error);
    next(error);
  }
});

/**
 * POST /api/admin/page-builder/themes
 * Create a new theme
 */
router.post('/themes', async (req: AdminRequest, res, next) => {
  try {
    const { name, slug, description, designTokens, customCss, isDefault } = req.body;

    if (!name || !slug) {
      throw new AppError('Name and slug are required', 400);
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await PageTheme.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    }

    const theme = await PageTheme.create({
      name,
      slug,
      description,
      designTokens: designTokens || {},
      customCss,
      isDefault: isDefault || false,
      isSystem: false,
      metadata: {
        createdBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedAt: new Date(),
      },
    });

    await logAudit(req, {
      action: 'theme.created',
      entityType: 'theme',
      entityId: theme._id.toString(),
      details: { name, slug },
    });

    res.json({
      success: true,
      data: { theme: theme.toObject() },
    });
  } catch (error: unknown) {
    logger.error('Failed to create theme:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/page-builder/themes/:themeId
 * Update a theme
 */
router.put('/themes/:themeId', async (req: AdminRequest, res, next) => {
  try {
    const { themeId } = req.params;
    const { name, slug, description, designTokens, customCss, isDefault } = req.body;

    const theme = await PageTheme.findById(themeId);
    if (!theme) {
      throw new AppError('Theme not found', 404);
    }

    if (theme.isSystem && (name || slug)) {
      throw new AppError('Cannot modify system theme name or slug', 400);
    }

    const updates: any = {
      'metadata.lastEditedBy': req.admin?.email || req.user?.email || 'unknown',
      'metadata.lastEditedAt': new Date(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (designTokens !== undefined) updates.designTokens = designTokens;
    if (customCss !== undefined) updates.customCss = customCss;

    // Handle default flag
    if (isDefault !== undefined && isDefault !== theme.isDefault) {
      if (isDefault) {
        await PageTheme.updateMany({ isDefault: true }, { $set: { isDefault: false } });
      }
      updates.isDefault = isDefault;
    }

    const updatedTheme = await PageTheme.findByIdAndUpdate(
      themeId,
      { $set: updates },
      { new: true }
    );

    await logAudit(req, {
      action: 'theme.updated',
      entityType: 'theme',
      entityId: themeId,
      details: { name: theme.name },
    });

    res.json({
      success: true,
      data: { theme: updatedTheme?.toObject() },
    });
  } catch (error: unknown) {
    logger.error('Failed to update theme:', error);
    next(error);
  }
});

/**
 * DELETE /api/admin/page-builder/themes/:themeId
 * Delete a theme
 */
router.delete('/themes/:themeId', async (req: AdminRequest, res, next) => {
  try {
    const { themeId } = req.params;

    const theme = await PageTheme.findById(themeId);
    if (!theme) {
      throw new AppError('Theme not found', 404);
    }

    if (theme.isSystem) {
      throw new AppError('Cannot delete system theme', 400);
    }

    await PageTheme.findByIdAndDelete(themeId);

    await logAudit(req, {
      action: 'theme.deleted',
      entityType: 'theme',
      entityId: themeId,
      details: { name: theme.name },
    });

    res.json({
      success: true,
      message: 'Theme deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Failed to delete theme:', error);
    next(error);
  }
});

/**
 * GET /api/admin/page-builder/templates
 * List all templates
 */
router.get('/templates', async (req: AdminRequest, res, next) => {
  try {
    const { category, search } = req.query;
    const query: any = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      const safeSearch = (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { tags: { $in: [new RegExp(safeSearch, 'i')] } as any },
      ];
    }

    const templates = await PageTemplate.find(query)
      .sort({ 'metadata.usageCount': -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { templates },
    });
  } catch (error: unknown) {
    logger.error('Failed to list templates:', error);
    next(error);
  }
});

/**
 * POST /api/admin/page-builder/templates
 * Create a new template
 */
router.post('/templates', async (req: AdminRequest, res, next) => {
  try {
    const { name, slug, description, category, thumbnail, blocks, themeId, tags, isPublic } =
      req.body;

    if (!name || !slug || !blocks) {
      throw new AppError('Name, slug, and blocks are required', 400);
    }

    const template = await PageTemplate.create({
      name,
      slug,
      description,
      category: category || 'custom',
      thumbnail,
      blocks,
      themeId,
      tags: tags || [],
      isPublic: isPublic !== undefined ? isPublic : true,
      isSystem: false,
      metadata: {
        createdBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedAt: new Date(),
        usageCount: 0,
      },
    });

    await logAudit(req, {
      action: 'template.created',
      entityType: 'template',
      entityId: template._id.toString(),
      details: { name, slug },
    });

    res.json({
      success: true,
      data: { template: template.toObject() },
    });
  } catch (error: unknown) {
    logger.error('Failed to create template:', error);
    next(error);
  }
});

/**
 * POST /api/admin/page-builder/templates/:templateId/use
 * Use a template to create a page
 */
router.post('/templates/:templateId/use', async (req: AdminRequest, res, next) => {
  try {
    const { templateId } = req.params;
    const { pageKey, title, slug } = req.body;

    if (!pageKey || !title || !slug) {
      throw new AppError('pageKey, title, and slug are required', 400);
    }

    const template = await PageTemplate.findById(templateId);
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // Check if pageKey already exists
    const existing = await Page.findOne({ $or: [{ pageKey }, { slug }] });
    if (existing) {
      throw new AppError('Page with this key or slug already exists', 400);
    }

    const defaultTheme = await getDefaultTheme();

    const page = await Page.create({
      pageKey,
      title,
      slug,
      status: 'draft',
      blocks: template.blocks,
      themeId: template.themeId || defaultTheme._id,
      templateId: template._id,
      metadata: {
        createdBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedBy: req.admin?.email || req.user?.email || 'unknown',
        lastEditedAt: new Date(),
        version: 1,
      },
    });

    // Increment usage count
    await PageTemplate.findByIdAndUpdate(templateId, {
      $inc: { 'metadata.usageCount': 1 },
    });

    await logAudit(req, {
      action: 'template.used',
      entityType: 'template',
      entityId: templateId,
      details: { pageKey, title },
    });

    res.json({
      success: true,
      data: { page: page.toObject() },
    });
  } catch (error: unknown) {
    logger.error('Failed to use template:', error);
    next(error);
  }
});

export default router;
