/**
 * Game Mechanics API Routes
 * RESTful endpoints for AI-powered game mechanics generation
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import gameMechanicsService from '../services/gameMechanicsService.js';
import { logger } from '../utils/logger.js';
import type { MechanicsRequest } from '../types/gameMechanics.types.js';

const router = express.Router();

/**
 * POST /api/game-mechanics/generate
 * Generate game mechanics from description
 */
router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { gameDescription, targetEngine, complexity, customization }: MechanicsRequest = req.body;

        if (!gameDescription || !targetEngine) {
            res.status(400).json({
                success: false,
                error: 'gameDescription and targetEngine are required'
            });
            return;
        }

        logger.info(`[GameMechanics API] Generation request from user ${req.user?.id}`);

        const mechanics = await gameMechanicsService.generateMechanics({
            gameDescription,
            targetEngine,
            complexity,
            customization
        });

        res.status(200).json({
            success: true,
            data: mechanics,
            message: 'Game mechanics generated successfully'
        });

    } catch (error: unknown) {
        logger.error('[GameMechanics API] Generation failed:', error);
        res.status(500).json({
            success: false,
            error: (error instanceof Error ? error.message : String(error)) || 'Failed to generate game mechanics'
        });
    }
});

/**
 * GET /api/game-mechanics/templates
 * List all available mechanics templates
 */
router.get('/templates', authenticateToken, async (_req: AuthRequest, res: Response) => {
    try {
        const templates = gameMechanicsService.getAvailableTemplates();

        // Return template metadata only (not full code)
        const templateSummaries = templates.map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            engine: t.engine,
            language: t.language,
            variables: t.variables
        }));

        res.status(200).json({
            success: true,
            data: {
                templates: templateSummaries,
                count: templateSummaries.length
            }
        });

    } catch (error: unknown) {
        logger.error('[GameMechanics API] Failed to list templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list templates'
        });
    }
});

/**
 * GET /api/game-mechanics/templates/:templateId
 * Get details of a specific template
 */
router.get('/templates/:templateId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { templateId } = req.params;
        const template = gameMechanicsService.getTemplate(templateId);

        if (!template) {
            res.status(404).json({
                success: false,
                error: 'Template not found'
            });
            return;
        }

        // Return template with code preview
        res.status(200).json({
            success: true,
            data: {
                template: {
                    ...template,
                    codePreview: template.code.substring(0, 500) + '...' // First 500 chars
                }
            }
        });

    } catch (error: unknown) {
        logger.error('[GameMechanics API] Failed to get template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get template'
        });
    }
});

export default router;
