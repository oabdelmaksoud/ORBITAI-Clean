import express from 'express';
import { Template } from '../models/Template.model.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/templates
 * Get all templates for the authenticated user - protected by template_use feature flag
 */
router.get('/', checkFeatureAccess('template_use'), async (req: FeatureRequest, res, next) => {
  try {
    const userId = req.user!.id;
    
    const templates = await Template.find({ 
      $or: [
        { userId },
        { isPublic: true }
      ]
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      data: {
        templates: templates.map(t => ({
          id: t._id.toString(),
          name: t.name,
          description: t.description,
          category: t.category,
          methodology: t.methodology,
          estimatedSprints: t.estimatedSprints,
          agents: t.agents,
          selectedStandards: t.selectedStandards || [],
          mcpServers: t.mcpServers,
          budget: t.budget,
          tags: t.tags || [],
          createdAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
          isPublic: t.isPublic
        }))
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/templates/:id
 * Get a specific template - protected by template_use feature flag
 */
router.get('/:id', checkFeatureAccess('template_use'), async (req: FeatureRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id;

    const template = await Template.findOne({
      _id: templateId,
      $or: [
        { userId },
        { isPublic: true }
      ]
    }).lean();

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    res.json({
      success: true,
      data: {
        template: {
          id: template._id.toString(),
          name: template.name,
          description: template.description,
          category: template.category,
          methodology: template.methodology,
          estimatedSprints: template.estimatedSprints,
          agents: template.agents,
          selectedStandards: template.selectedStandards || [],
          mcpServers: template.mcpServers,
          budget: template.budget,
          tags: template.tags || [],
          createdAt: template.createdAt ? new Date(template.createdAt).getTime() : Date.now(),
          isPublic: template.isPublic
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/templates
 * Create a new template - protected by template_creation feature flag
 */
router.post('/', checkFeatureAccess('template_creation'), async (req: FeatureRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const {
      name,
      description,
      category,
      methodology,
      estimatedSprints,
      agents,
      selectedStandards,
      mcpServers,
      budget,
      tags,
      isPublic
    } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('Template name is required', 400);
    }

    const template = await Template.create({
      userId,
      name: name.trim(),
      description: description || '',
      category,
      methodology,
      estimatedSprints,
      agents: agents || [],
      selectedStandards: selectedStandards || [],
      mcpServers: mcpServers || [],
      budget: budget || {
        total: 50.00,
        used: 0,
        currency: 'USD',
        totalTokens: 0,
        lastUpdated: Date.now()
      },
      tags: tags || [],
      isPublic: isPublic || false
    });

    res.status(201).json({
      success: true,
      data: {
        template: {
          id: template._id.toString(),
          name: template.name,
          description: template.description,
          category: template.category,
          methodology: template.methodology,
          estimatedSprints: template.estimatedSprints,
          agents: template.agents,
          selectedStandards: template.selectedStandards,
          mcpServers: template.mcpServers,
          budget: template.budget,
          tags: template.tags,
          createdAt: template.createdAt ? new Date(template.createdAt).getTime() : Date.now(),
          isPublic: template.isPublic
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/templates/:id
 * Update a template - protected by template_creation feature flag
 */
router.put('/:id', checkFeatureAccess('template_creation'), async (req: FeatureRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id;

    const template = await Template.findOne({ _id: templateId, userId });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    const {
      name,
      description,
      category,
      methodology,
      estimatedSprints,
      agents,
      selectedStandards,
      mcpServers,
      budget,
      tags,
      isPublic
    } = req.body;

    if (name !== undefined) template.name = name.trim();
    if (description !== undefined) template.description = description;
    if (category !== undefined) template.category = category;
    if (methodology !== undefined) template.methodology = methodology;
    if (estimatedSprints !== undefined) template.estimatedSprints = estimatedSprints;
    if (agents !== undefined) template.agents = agents;
    if (selectedStandards !== undefined) template.selectedStandards = selectedStandards;
    if (mcpServers !== undefined) template.mcpServers = mcpServers;
    if (budget !== undefined) template.budget = budget;
    if (tags !== undefined) template.tags = tags;
    if (isPublic !== undefined) template.isPublic = isPublic;

    await template.save();

    res.json({
      success: true,
      data: {
        template: {
          id: template._id.toString(),
          name: template.name,
          description: template.description,
          category: template.category,
          methodology: template.methodology,
          estimatedSprints: template.estimatedSprints,
          agents: template.agents,
          selectedStandards: template.selectedStandards,
          mcpServers: template.mcpServers,
          budget: template.budget,
          tags: template.tags,
          createdAt: template.createdAt ? new Date(template.createdAt).getTime() : Date.now(),
          isPublic: template.isPublic
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a template - protected by template_creation feature flag
 */
router.delete('/:id', checkFeatureAccess('template_creation'), async (req: FeatureRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id;

    const template = await Template.findOneAndDelete({ _id: templateId, userId });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/templates/:id/share
 * Toggle template sharing (make public/private) - protected by template_sharing feature flag
 */
router.put('/:id/share', checkFeatureAccess('template_sharing'), async (req: FeatureRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id;
    const { isPublic } = req.body;

    const template = await Template.findOne({ _id: templateId, userId });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    template.isPublic = isPublic !== undefined ? isPublic : !template.isPublic;
    await template.save();

    res.json({
      success: true,
      data: {
        template: {
          id: template._id.toString(),
          name: template.name,
          isPublic: template.isPublic
        }
      },
      message: template.isPublic ? 'Template is now public' : 'Template is now private'
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;









