/**
 * Project Generation Integration Hooks
 * Ready-to-use integration for auto-generating game mechanics during project creation
 */

import gameMechanicsService from '../services/gameMechanicsService.js';
import { logger } from '../utils/logger.js';
import type { GameEngine } from '../types/gameMechanics.types.js';

/**
 * Detect if project should include game mechanics
 */
export function shouldGenerateMechanics(projectDescription: string): boolean {
    const description = projectDescription.toLowerCase();

    const gameKeywords = [
        'game', 'platformer', 'fps', 'rpg', 'shooter',
        'puzzle game', 'strategy game', 'action game',
        'combat', 'enemies', 'player', 'level'
    ];

    return gameKeywords.some(keyword => description.includes(keyword));
}

/**
 * Detect game engine from project description or type
 */
export function detectGameEngine(projectDescription: string, projectType?: string): GameEngine {
    const description = projectDescription.toLowerCase();

    if (description.includes('unity') || projectType === 'unity') {
        return 'unity';
    }

    if (description.includes('godot') || projectType === 'godot') {
        return 'godot';
    }

    if (description.includes('phaser') || description.includes('web game') || projectType === 'web') {
        return 'phaser';
    }

    // Default to Unity for general game requests
    return 'unity';
}

/**
 * Generate mechanics for a project
 * Call this during project generation workflow
 */
export async function generateMechanicsForProject(params: {
    projectId: string;
    projectDescription: string;
    projectType?: string;
    targetEngine?: GameEngine;
}) {
    try {
        // Detect if mechanics are needed
        if (!shouldGenerateMechanics(params.projectDescription)) {
            logger.info(`[ProjectIntegration] Project ${params.projectId} doesn't need mechanics`);
            return null;
        }

        // Detect game engine
        const engine = params.targetEngine || detectGameEngine(params.projectDescription, params.projectType);

        logger.info(`[ProjectIntegration] Generating mechanics for project ${params.projectId}, engine: ${engine}`);

        // Generate mechanics
        const mechanics = await gameMechanicsService.generateMechanics({
            gameDescription: params.projectDescription,
            targetEngine: engine,
            complexity: 'standard'
        });

        logger.info(`[ProjectIntegration] Generated ${mechanics.files.length} mechanic files for project ${params.projectId}`);

        return {
            mechanicsId: mechanics.mechanicsId,
            files: mechanics.files,
            instructions: mechanics.instructions,
            dependencies: mechanics.dependencies
        };

    } catch (error: any) {
        logger.error(`[ProjectIntegration] Failed to generate mechanics:`, error);
        return null; // Don't fail project creation if mechanics fail
    }
}

/**
 * Example usage in project generation service:
 * 
 * // In your projectGenerationService.ts or similar:
 * 
 * import { generateMechanicsForProject } from './hooks/projectMechanicsHook.js';
 * 
 * async function generateProject(params) {
 *   // ... existing project generation code ...
 *   
 *   // Auto-generate game mechanics if needed
 *   const mechanics = await generateMechanicsForProject({
 *     projectId: project.id,
 *     projectDescription: params.description,
 *     projectType: params.type
 *   });
 *   
 *   if (mechanics) {
 *     // Add mechanics files to project
 *     project.files.push(...mechanics.files);
 *     
 *     // Add dependencies
 *     project.dependencies.push(...mechanics.dependencies);
 *     
 *     // Add instructions to README
 *     project.readme += '\n\n## Game Mechanics\n\n' + mechanics.instructions;
 *   }
 *   
 *   return project;
 * }
 */
