/**
 * Enhanced Game Mechanics Service with LLM Integration
 * Adds advanced LLM-powered analysis and customization
 */

import { logger } from '../utils/logger.js';
import type {
    MechanicsRequest,
    GeneratedMechanics,
    GameAnalysis,
    MechanicsTemplate,
    MechanicsFile,
    MechanicsSummary
} from '../types/gameMechanics.types.js';
import { UNITY_2D_MOVEMENT_TEMPLATE, UNITY_2D_MOVEMENT_CONFIG } from '../templates/mechanics/unity/PlayerController.template.js';
import { GODOT_2D_MOVEMENT_TEMPLATE, GODOT_2D_MOVEMENT_CONFIG } from '../templates/mechanics/godot/player_controller.template.js';
import { PHASER_2D_MOVEMENT_TEMPLATE, PHASER_2D_MOVEMENT_CONFIG } from '../templates/mechanics/phaser/PlayerController.template.js';
import { UNITY_COMBAT_TEMPLATE, UNITY_COMBAT_CONFIG } from '../templates/mechanics/unity/CombatSystem.template.js';
import { UNITY_ENEMY_AI_CODE, UNITY_ENEMY_AI_CONFIG } from '../templates/mechanics/unity/EnemyAI.template.js';
import { GODOT_ENEMY_AI_CODE, GODOT_ENEMY_AI_CONFIG } from '../templates/mechanics/godot/enemy_ai.template.js';
import { PHASER_ENEMY_AI_CODE, PHASER_ENEMY_AI_CONFIG } from '../templates/mechanics/phaser/EnemyAI.template.js';
import { UNITY_XP_SYSTEM_CODE, UNITY_XP_SYSTEM_CONFIG } from '../templates/mechanics/unity/XPSystem.template.js';
import { UNITY_INVENTORY_SYSTEM_CODE, UNITY_INVENTORY_SYSTEM_CONFIG } from '../templates/mechanics/unity/InventorySystem.template.js';
import { UNITY_QUEST_SYSTEM_CODE, UNITY_QUEST_SYSTEM_CONFIG } from '../templates/mechanics/unity/QuestSystem.template.js';
import { v4 as uuidv4 } from 'uuid';

// LLM Analysis Prompt for advanced analysis
const GAME_ANALYSIS_PROMPT = `Analyze this game description and identify required mechanics.

Game Description: {{description}}

Return a JSON object with this exact structure (no additional text):
{
  "gameType": "2d-platformer" | "2d-topdown" | "3d-fps" | "3d-thirdperson" | "puzzle" | "strategy",
  "requiredMechanics": {
    "movement": {
      "type": "platformer" | "topdown" | "fps" | "grid",
      "features": ["walk", "jump", "sprint"]
    },
    "combat": {
      "type": "melee" | "ranged" | "hybrid",
      "features": ["attack", "health", "damage"]
    },
    "enemies": {
      "count": 3,
      "behavior": "patrol" | "chase" | "stationary",
      "hasAI": true
    }
  },
  "targetEngine": "unity" | "godot" | "phaser",
  "complexity": "simple" | "standard" | "advanced"
}`;

class GameMechanicsService {
    private templates: Map<string, MechanicsTemplate> = new Map();
    private useLLM: boolean = false; // Toggle for LLM vs pattern matching

    constructor() {
        this.loadTemplates();
        // Enable LLM if available (can be configured via env var)
        this.useLLM = process.env.USE_LLM_ANALYSIS === 'true';
    }

    /**
     * Load and validate all templates
     */
    private loadTemplates(): void {
        const templatesToLoad = [
            { config: UNITY_2D_MOVEMENT_CONFIG, code: UNITY_2D_MOVEMENT_TEMPLATE },
            { config: UNITY_COMBAT_CONFIG, code: UNITY_COMBAT_TEMPLATE },
            { config: UNITY_ENEMY_AI_CONFIG, code: UNITY_ENEMY_AI_CODE },
            { config: GODOT_2D_MOVEMENT_CONFIG, code: GODOT_2D_MOVEMENT_TEMPLATE },
            { config: GODOT_ENEMY_AI_CONFIG, code: GODOT_ENEMY_AI_CODE },
            { config: PHASER_2D_MOVEMENT_CONFIG, code: PHASER_2D_MOVEMENT_TEMPLATE },
            { config: PHASER_ENEMY_AI_CONFIG, code: PHASER_ENEMY_AI_CODE },
            { config: UNITY_XP_SYSTEM_CONFIG, code: UNITY_XP_SYSTEM_CODE },
            { config: UNITY_INVENTORY_SYSTEM_CONFIG, code: UNITY_INVENTORY_SYSTEM_CODE },
            { config: UNITY_QUEST_SYSTEM_CONFIG, code: UNITY_QUEST_SYSTEM_CODE }
        ];

        templatesToLoad.forEach(({ config, code }) => {
            // Validate template before loading
            if (this.validateTemplate(config, code)) {
                this.templates.set(config.id, { ...config, code });
            } else {
                logger.warn(`[GameMechanics] Skipping invalid template: ${config.id}`);
            }
        });

        logger.info(`[GameMechanics] Loaded ${this.templates.size} templates`);
    }

    /**
     * Validate template structure
     */
    private validateTemplate(config: any, code: string): boolean {
        try {
            // Check required config fields
            if (!config.id || !config.name || !config.category || !config.engine) {
                return false;
            }

            // Check code has placeholders for all variables
            for (const variable of config.variables) {
                const placeholder = `{{${variable.name}}}`;
                if (!code.includes(placeholder)) {
                    logger.warn(`Template ${config.id} missing placeholder: ${placeholder}`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            logger.error(`Template validation error:`, error);
            return false;
        }
    }

    /**
     * Main entry point - Generate game mechanics from description
     */
    async generateMechanics(request: MechanicsRequest): Promise<GeneratedMechanics> {
        try {
            logger.info('[GameMechanics] Generating mechanics:', {
                description: request.gameDescription,
                engine: request.targetEngine,
                useLLM: this.useLLM
            });

            // Step 1: Analyze game description
            const analysis = this.useLLM
                ? await this.analyzeWithLLM(request)
                : await this.analyzeWithPatterns(request);

            // Step 2: Select appropriate templates
            const selectedTemplates = this.selectMechanicsTemplates(analysis);

            if (selectedTemplates.length === 0) {
                throw new Error('No suitable templates found for this game type');
            }

            // Step 3: Generate code files from templates
            const files = this.generateCodeFiles(selectedTemplates, request.customization);

            // Step 4: Create mechanics summary
            const mechanics = this.createMechanicsSummary(selectedTemplates, analysis);

            // Step 5: Generate instructions
            const instructions = this.generateInstructions(files, selectedTemplates);

            // Step 6: Collect dependencies
            const dependencies = this.collectDependencies(selectedTemplates);

            const result: GeneratedMechanics = {
                mechanicsId: uuidv4(),
                files,
                mechanics,
                instructions,
                dependencies,
                metadata: {
                    engine: request.targetEngine,
                    complexity: request.complexity || 'standard',
                    generatedAt: new Date()
                }
            };

            logger.info('[GameMechanics] Generation complete:', {
                mechanicsId: result.mechanicsId,
                fileCount: files.length
            });

            return result;

        } catch (error: any) {
            logger.error('[GameMechanics] Generation failed:', error);
            throw new Error(`Mechanics generation failed: ${error.message}`);
        }
    }

    /**
     * Analyze using LLM (advanced)
     */
    private async analyzeWithLLM(request: MechanicsRequest): Promise<GameAnalysis> {
        try {
            // Import LLM Router dynamically to avoid circular dependencies
            const { default: LLMRouter } = await import('./llm/LLMRouter.js');

            const prompt = GAME_ANALYSIS_PROMPT.replace('{{description}}', request.gameDescription);

            const response = await LLMRouter.generateResponse({
                messages: [{ role: 'user', content: prompt }],
                model: 'gemini-2.0-flash-exp', // Fast model for analysis
                responseFormat: 'json'
            });

            const analysisResult = JSON.parse(response.text);

            return {
                ...analysisResult,
                targetEngine: request.targetEngine,
                customFeatures: request.customization || []
            };

        } catch (error: any) {
            logger.warn('[GameMechanics] LLM analysis failed, falling back to patterns:', error.message);
            return this.analyzeWithPatterns(request);
        }
    }

    /**
     * Analyze using pattern matching (fallback)
     */
    private async analyzeWithPatterns(request: MechanicsRequest): Promise<GameAnalysis> {
        const description = request.gameDescription.toLowerCase();

        const is2DPlatformer = description.includes('platformer') ||
            (description.includes('2d') && (description.includes('jump') || description.includes('platform')));

        const hasEnemies = description.includes('enemy') || description.includes('enemies') || description.includes('combat');
        const hasCombat = description.includes('combat') || description.includes('fight') || description.includes('attack') || description.includes('damage');

        return {
            gameType: is2DPlatformer ? '2d-platformer' : '2d-topdown',
            targetEngine: request.targetEngine,
            complexity: request.complexity || 'standard',
            customFeatures: request.customization || [],
            requiredMechanics: {
                movement: {
                    type: is2DPlatformer ? 'platformer' : 'topdown',
                    features: is2DPlatformer ? ['walk', 'jump'] : ['walk']
                },
                ...(hasCombat && {
                    combat: {
                        type: 'melee',
                        features: ['attack', 'health', 'damage']
                    }
                }),
                ...(hasEnemies && {
                    enemies: {
                        count: 3,
                        behavior: 'patrol',
                        hasAI: true
                    }
                })
            }
        };
    }

    /**
     * Select appropriate templates based on analysis
     */
    private selectMechanicsTemplates(analysis: GameAnalysis): MechanicsTemplate[] {
        const selected: MechanicsTemplate[] = [];

        // Select movement template
        if (analysis.requiredMechanics.movement) {
            const movementType = analysis.requiredMechanics.movement.type;

            if (movementType === 'platformer') {
                switch (analysis.targetEngine) {
                    case 'unity':
                        const unityMovement = this.templates.get('unity-2d-movement');
                        if (unityMovement) selected.push(unityMovement);
                        break;
                    case 'godot':
                        const godotMovement = this.templates.get('godot-2d-movement');
                        if (godotMovement) selected.push(godotMovement);
                        break;
                    case 'phaser':
                        const phaserMovement = this.templates.get('phaser-2d-movement');
                        if (phaserMovement) selected.push(phaserMovement);
                        break;
                }
            }
        }

        // Select combat template
        if (analysis.requiredMechanics.combat) {
            if (analysis.targetEngine === 'unity') {
                const unityCombat = this.templates.get('unity-combat-system');
                if (unityCombat) selected.push(unityCombat);
            }
        }

        return selected;
    }

    /**
     * Generate code files from templates with optional customization
     */
    private generateCodeFiles(templates: MechanicsTemplate[], customizations?: string[]): MechanicsFile[] {
        return templates.map(template => {
            let code = template.code;

            // Replace variables with defaults or custom values
            template.variables.forEach(variable => {
                const placeholder = `{{${variable.name}}}`;
                let value = variable.default;

                // Check for customizations (e.g., "double jump")
                if (customizations && variable.name === 'MAX_JUMPS') {
                    if (customizations.some(c => c.toLowerCase().includes('double jump'))) {
                        value = 2;
                    }
                }

                code = code.replace(new RegExp(placeholder, 'g'), String(value));
            });

            return {
                filename: this.getFilenameForTemplate(template),
                content: code,
                description: template.name,
                language: template.language
            };
        });
    }

    private getFilenameForTemplate(template: MechanicsTemplate): string {
        if (template.id.includes('combat')) {
            return template.engine === 'unity' ? 'CombatSystem.cs' : 'CombatSystem.txt';
        }

        switch (template.engine) {
            case 'unity': return 'PlayerController.cs';
            case 'godot': return 'player_controller.gd';
            case 'phaser':
            case 'vanilla': return 'PlayerController.js';
            default: return 'PlayerController.txt';
        }
    }

    private createMechanicsSummary(templates: MechanicsTemplate[], analysis: GameAnalysis): MechanicsSummary {
        return {
            movement: templates.some(t => t.category === 'movement'),
            combat: templates.some(t => t.category === 'combat'),
            ai: templates.some(t => t.category === 'ai'),
            progression: templates.some(t => t.category === 'progression'),
            details: {
                movementType: analysis.requiredMechanics.movement?.type,
                combatType: analysis.requiredMechanics.combat?.type,
                aiType: analysis.requiredMechanics.enemies?.behavior as any,
                progressionType: analysis.requiredMechanics.progression?.type
            }
        };
    }

    private generateInstructions(files: MechanicsFile[], templates: MechanicsTemplate[]): string {
        const templateInstructions = templates.map(t => t.instructions).join('\n\n---\n\n');

        return `# Generated Game Mechanics - Setup Instructions

## Files Generated
${files.map((f, i) => `${i + 1}. **${f.filename}** - ${f.description}`).join('\n')}

## Setup Instructions

${templateInstructions}

## Next Steps
1. Import these scripts into your project
2. Follow the setup instructions for each file
3. Test your game mechanics
4. Customize as needed

Generated by ORBITAI Game Mechanics Service
`;
    }

    private collectDependencies(templates: MechanicsTemplate[]): string[] {
        const allDeps = new Set<string>();
        templates.forEach(template => {
            template.dependencies.forEach(dep => allDeps.add(dep));
        });
        return Array.from(allDeps);
    }

    getAvailableTemplates(): MechanicsTemplate[] {
        return Array.from(this.templates.values());
    }

    getTemplate(templateId: string): MechanicsTemplate | undefined {
        return this.templates.get(templateId);
    }

    /**
     * Enable/disable LLM analysis
     */
    setLLMEnabled(enabled: boolean): void {
        this.useLLM = enabled;
        logger.info(`[GameMechanics] LLM analysis ${enabled ? 'enabled' : 'disabled'}`);
    }
}

export const gameMechanicsService = new GameMechanicsService();
export default gameMechanicsService;
