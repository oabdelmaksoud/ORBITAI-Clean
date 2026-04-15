import { Page } from '../models/Page.model.js';
import { PageRevision } from '../models/PageRevision.model.js';
import { PageTheme } from '../models/PageTheme.model.js';
import { logger } from '../utils/logger.js';

export interface PublishOptions {
  pageId: string;
  publishedBy: string;
  scheduledAt?: Date;
}

export interface RollbackOptions {
  pageId: string;
  revisionId: string;
  rolledBackBy: string;
}

/**
 * Publish a page (or schedule for later)
 */
export async function publishPage(options: PublishOptions): Promise<{ page: any; revision: any }> {
  const { pageId, publishedBy, scheduledAt } = options;

  const page = await Page.findById(pageId);
  if (!page) {
    throw new Error('Page not found');
  }

  // Create revision before publishing
  const latestRevision = await PageRevision.findOne({ pageId })
    .sort({ revisionNumber: -1 })
    .lean() as any;

  const nextRevisionNumber = (latestRevision?.revisionNumber || 0) + 1;

  const revision = await PageRevision.create({
    pageId: page._id,
    pageKey: page.pageKey,
    revisionNumber: nextRevisionNumber,
    blocks: page.blocks,
    status: scheduledAt ? 'draft' : 'published',
    title: page.title,
    slug: page.slug,
    themeId: page.themeId,
    templateId: page.templateId,
    seo: page.seo,
    settings: page.settings,
    metadata: {
      createdBy: publishedBy,
      createdAt: new Date(),
      note: scheduledAt ? `Scheduled for ${scheduledAt.toISOString()}` : 'Published',
      isAutoSave: false
    }
  });

  // Update page status
  const updateData: any = {
    status: scheduledAt ? 'draft' : 'published',
    'metadata.lastEditedBy': publishedBy,
    'metadata.lastEditedAt': new Date(),
    'metadata.version': nextRevisionNumber
  };

  if (scheduledAt) {
    updateData.scheduledPublishAt = scheduledAt;
  } else {
    updateData.publishedAt = new Date();
    updateData.scheduledPublishAt = undefined;
  }

  const updatedPage = await Page.findByIdAndUpdate(pageId, { $set: updateData }, { new: true });

  logger.info(`Page ${page.pageKey} published by ${publishedBy}`);

  return {
    page: updatedPage?.toObject(),
    revision: revision.toObject()
  };
}

/**
 * Rollback to a specific revision
 */
export async function rollbackToRevision(options: RollbackOptions): Promise<{ page: any; revision: any }> {
  const { pageId, revisionId, rolledBackBy } = options;

  const page = await Page.findById(pageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const targetRevision = await PageRevision.findById(revisionId);
  if (!targetRevision || targetRevision.pageId.toString() !== pageId) {
    throw new Error('Revision not found or does not belong to this page');
  }

  // Create a new revision from the rollback
  const latestRevision = await PageRevision.findOne({ pageId })
    .sort({ revisionNumber: -1 })
    .lean() as any;

  const nextRevisionNumber = (latestRevision?.revisionNumber || 0) + 1;

  const rollbackRevision = await PageRevision.create({
    pageId: page._id,
    pageKey: page.pageKey,
    revisionNumber: nextRevisionNumber,
    blocks: targetRevision.blocks,
    status: page.status,
    title: targetRevision.title,
    slug: targetRevision.slug,
    themeId: targetRevision.themeId,
    templateId: targetRevision.templateId,
    seo: targetRevision.seo,
    settings: targetRevision.settings,
    metadata: {
      createdBy: rolledBackBy,
      createdAt: new Date(),
      note: `Rolled back to revision ${targetRevision.revisionNumber}`,
      isAutoSave: false
    }
  });

  // Restore page from revision
  const updatedPage = await Page.findByIdAndUpdate(
    pageId,
    {
      $set: {
        blocks: targetRevision.blocks,
        title: targetRevision.title,
        slug: targetRevision.slug,
        themeId: targetRevision.themeId,
        templateId: targetRevision.templateId,
        seo: targetRevision.seo,
        settings: targetRevision.settings,
        'metadata.lastEditedBy': rolledBackBy,
        'metadata.lastEditedAt': new Date(),
        'metadata.version': nextRevisionNumber
      }
    },
    { new: true }
  );

  logger.info(`Page ${page.pageKey} rolled back to revision ${targetRevision.revisionNumber} by ${rolledBackBy}`);

  return {
    page: updatedPage?.toObject(),
    revision: rollbackRevision.toObject()
  };
}

/**
 * Create auto-save revision
 */
export async function createAutoSaveRevision(
  pageId: string,
  blocks: any,
  editedBy: string
): Promise<void> {
  const page = await Page.findById(pageId);
  if (!page) {
    return;
  }

  const latestRevision = await PageRevision.findOne({ pageId })
    .sort({ revisionNumber: -1 })
    .lean() as any;

  const nextRevisionNumber = (latestRevision?.revisionNumber || 0) + 1;

  await PageRevision.create({
    pageId: page._id,
    pageKey: page.pageKey,
    revisionNumber: nextRevisionNumber,
    blocks,
    status: page.status,
    title: page.title,
    slug: page.slug,
    themeId: page.themeId,
    templateId: page.templateId,
    seo: page.seo,
    settings: page.settings,
    metadata: {
      createdBy: editedBy,
      createdAt: new Date(),
      isAutoSave: true
    }
  });

  // Update page blocks without changing status
  await Page.findByIdAndUpdate(pageId, {
    $set: {
      blocks,
      'metadata.lastEditedBy': editedBy,
      'metadata.lastEditedAt': new Date()
    }
  });
}

/**
 * Get default theme or create one if none exists
 */
export async function getDefaultTheme(): Promise<any> {
  let defaultTheme = await PageTheme.findOne({ isDefault: true }).lean() as any;

  if (!defaultTheme) {
    // Create a default theme
    defaultTheme = await PageTheme.create({
      name: 'Default Theme',
      slug: 'default',
      description: 'Default system theme',
      isDefault: true,
      isSystem: true,
      designTokens: {
        colors: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          accent: '#10b981',
          background: '#ffffff',
          surface: '#f9fafb',
          text: '#111827',
          textSecondary: '#6b7280',
          border: '#e5e7eb',
          error: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
          info: '#3b82f6'
        },
        typography: {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontFamilyHeading: 'system-ui, -apple-system, sans-serif',
          fontSizeBase: '16px',
          fontSizeScale: 1.25,
          lineHeight: 1.5,
          fontWeightNormal: 400,
          fontWeightBold: 700
        },
        spacing: {
          unit: 8,
          scale: [0, 4, 8, 16, 24, 32, 48, 64, 96, 128]
        },
        borderRadius: {
          small: '4px',
          medium: '8px',
          large: '12px'
        },
        shadows: {
          small: '0 1px 2px rgba(0,0,0,0.05)',
          medium: '0 4px 6px rgba(0,0,0,0.1)',
          large: '0 10px 15px rgba(0,0,0,0.1)'
        }
      }
    });

    logger.info('Created default theme');
  }

  return defaultTheme;
}




