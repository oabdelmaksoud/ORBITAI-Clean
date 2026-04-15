import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { GrapesPage, IGrapesPage } from '../models/GrapesPage.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/pages
 * Get all pages (with optional filters)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const query: any = {};
    if (status) {
      query.status = status;
    }

    const pages = await GrapesPage.find(query)
      .select('name slug status createdAt updatedAt publishedAt metadata.title')
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await GrapesPage.countDocuments(query);

    res.json({
      success: true,
      pages,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch pages:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch pages' },
    });
  }
});

/**
 * GET /api/pages/:slug
 * Get a single page by slug
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const page = await GrapesPage.findOne({ slug });
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: { message: 'Page not found' },
      });
    }

    res.json({
      success: true,
      page,
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch page:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch page' },
    });
  }
});

/**
 * POST /api/pages
 * Create a new page (admin only)
 */
router.post('/', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { name, slug, html, css, components, styles, metadata, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Page name is required' },
      });
    }

    // Generate slug from name if not provided
    const pageSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingPage = await GrapesPage.findOne({ slug: pageSlug });
    if (existingPage) {
      return res.status(400).json({
        success: false,
        error: { message: 'A page with this slug already exists' },
      });
    }

    const page = new GrapesPage({
      name,
      slug: pageSlug,
      html: html || '',
      css: css || '',
      components: components || '[]',
      styles: styles || '[]',
      metadata: metadata || {},
      status: status || 'draft',
      createdBy: req.admin?.userId,
    });

    await page.save();

    logger.info(`Page created: ${page.slug} by admin ${req.admin?.userId}`);

    res.status(201).json({
      success: true,
      page,
    });
  } catch (error: unknown) {
    logger.error('Failed to create page:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to create page' },
    });
  }
});

/**
 * PUT /api/pages/:slug
 * Update a page (admin only)
 */
router.put('/:slug', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { name, html, css, components, styles, metadata, status } = req.body;

    const page = await GrapesPage.findOne({ slug });
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: { message: 'Page not found' },
      });
    }

    // Update fields
    if (name !== undefined) page.name = name;
    if (html !== undefined) page.html = html;
    if (css !== undefined) page.css = css;
    if (components !== undefined) page.components = components;
    if (styles !== undefined) page.styles = styles;
    if (metadata !== undefined) page.metadata = { ...page.metadata, ...metadata };
    if (status !== undefined) {
      page.status = status;
      if (status === 'published' && !page.publishedAt) {
        page.publishedAt = new Date();
      }
    }
    
    page.updatedBy = req.admin?.userId as any;

    await page.save();

    logger.info(`Page updated: ${page.slug} by admin ${req.admin?.userId}`);

    res.json({
      success: true,
      page,
    });
  } catch (error: unknown) {
    logger.error('Failed to update page:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update page' },
    });
  }
});

/**
 * DELETE /api/pages/:slug
 * Delete a page (admin only)
 */
router.delete('/:slug', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { slug } = req.params;

    // Prevent deleting the home page
    if (slug === 'home') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete the home page' },
      });
    }

    const page = await GrapesPage.findOneAndDelete({ slug });
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: { message: 'Page not found' },
      });
    }

    logger.info(`Page deleted: ${slug} by admin ${req.admin?.userId}`);

    res.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Failed to delete page:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to delete page' },
    });
  }
});

/**
 * POST /api/pages/:slug/publish
 * Publish a page (admin only)
 */
router.post('/:slug/publish', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const page = await GrapesPage.findOne({ slug });
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: { message: 'Page not found' },
      });
    }

    page.status = 'published';
    page.publishedAt = new Date();
    page.updatedBy = req.admin?.userId as any;

    await page.save();

    logger.info(`Page published: ${slug} by admin ${req.admin?.userId}`);

    res.json({
      success: true,
      page,
    });
  } catch (error: unknown) {
    logger.error('Failed to publish page:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to publish page' },
    });
  }
});

/**
 * POST /api/pages/:slug/unpublish
 * Unpublish a page (set to draft) (admin only)
 */
router.post('/:slug/unpublish', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const page = await GrapesPage.findOne({ slug });
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: { message: 'Page not found' },
      });
    }

    page.status = 'draft';
    page.updatedBy = req.admin?.userId as any;

    await page.save();

    logger.info(`Page unpublished: ${slug} by admin ${req.admin?.userId}`);

    res.json({
      success: true,
      page,
    });
  } catch (error: unknown) {
    logger.error('Failed to unpublish page:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to unpublish page' },
    });
  }
});

/**
 * POST /api/pages/:slug/duplicate
 * Duplicate a page (admin only)
 */
router.post('/:slug/duplicate', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { newName, newSlug } = req.body;

    const originalPage = await GrapesPage.findOne({ slug });
    
    if (!originalPage) {
      return res.status(404).json({
        success: false,
        error: { message: 'Page not found' },
      });
    }

    // Generate new slug
    const duplicateSlug = newSlug || `${slug}-copy-${Date.now()}`;
    
    // Check if new slug exists
    const existingPage = await GrapesPage.findOne({ slug: duplicateSlug });
    if (existingPage) {
      return res.status(400).json({
        success: false,
        error: { message: 'A page with this slug already exists' },
      });
    }

    const duplicatePage = new GrapesPage({
      name: newName || `${originalPage.name} (Copy)`,
      slug: duplicateSlug,
      html: originalPage.html,
      css: originalPage.css,
      components: originalPage.components,
      styles: originalPage.styles,
      metadata: { ...originalPage.metadata },
      status: 'draft',
      createdBy: req.admin?.userId,
    });

    await duplicatePage.save();

    logger.info(`Page duplicated: ${slug} -> ${duplicateSlug} by admin ${req.admin?.userId}`);

    res.status(201).json({
      success: true,
      page: duplicatePage,
    });
  } catch (error: unknown) {
    logger.error('Failed to duplicate page:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to duplicate page' },
    });
  }
});

export default router;




