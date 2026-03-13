/**
 * Game Mechanics Type Definitions
 * Types for AI-powered game mechanics generation
 */

// ==================== REQUEST TYPES ====================

export interface MechanicsRequest {
    gameDescription: string;      // "2D platformer with enemies"
    targetEngine: GameEngine;
    complexity?: ComplexityLevel;
    customization?: string[];     // ["add double jump", "health regen"]
}

export type GameEngine = 'unity' | 'godot' | 'phaser' | 'vanilla';
export type ComplexityLevel = 'simple' | 'standard' | 'advanced';

// ==================== RESPONSE TYPES ====================

export interface GeneratedMechanics {
    mechanicsId: string;
    files: MechanicsFile[];
    mechanics: MechanicsSummary;
    instructions: string;
    dependencies: string[];
    metadata: {
        engine: GameEngine;
        complexity: ComplexityLevel;
        generatedAt: Date;
    };
}

export interface MechanicsFile {
    filename: string;
    content: string;
    description: string;
    language: 'csharp' | 'gdscript' | 'javascript' | 'typescript';
}

export interface MechanicsSummary {
    movement: boolean;
    combat: boolean;
    ai: boolean;
    progression: boolean;
    details: {
        movementType?: 'platformer' | 'topdown' | 'fps' | 'grid';
        combatType?: 'melee' | 'ranged' | 'hybrid';
        aiType?: 'patrol' | 'chase' | 'state-machine';
        progressionType?: 'xp' | 'stats' | 'inventory';
    };
}

// ==================== ANALYSIS TYPES ====================

export interface GameAnalysis {
    gameType: GameType;
    requiredMechanics: RequiredMechanics;
    targetEngine: GameEngine;
    complexity: ComplexityLevel;
    customFeatures: string[];
}

export type GameType =
    | '2d-platformer'
    | '2d-topdown'
    | '3d-fps'
    | '3d-thirdperson'
    | 'puzzle'
    | 'strategy';

export interface RequiredMechanics {
    movement: MovementMechanics;
    combat?: CombatMechanics;
    enemies?: EnemyMechanics;
    progression?: ProgressionMechanics;
}

export interface MovementMechanics {
    type: 'platformer' | 'topdown' | 'fps' | 'grid';
    features: string[];  // ["walk", "jump", "sprint", "crouch"]
}

export interface CombatMechanics {
    type: 'melee' | 'ranged' | 'hybrid';
    features: string[];  // ["attack", "health", "damage", "defense"]
}

export interface EnemyMechanics {
    count: number;
    behavior: 'patrol' | 'chase' | 'stationary' | 'advanced';
    hasAI: boolean;
}

export interface ProgressionMechanics {
    type: 'xp' | 'stats' | 'inventory' | 'quests';
    features: string[];  // ["levelup", "skillpoints", "items"]
}

// ==================== TEMPLATE TYPES ====================

export interface MechanicsTemplate {
    id: string;              // "unity-2d-movement"
    name: string;            // "2D Platformer Movement"
    category: TemplateCategory;
    engine: GameEngine;
    language: 'csharp' | 'gdscript' | 'javascript' | 'typescript';
    variables: TemplateVariable[];
    code: string;            // Template with {{placeholders}}
    dependencies: string[];
    instructions: string;
}

export type TemplateCategory = 'movement' | 'combat' | 'ai' | 'progression' | 'utility';

export interface TemplateVariable {
    name: string;            // "JUMP_FORCE"
    type: 'number' | 'string' | 'boolean';
    default: any;
    description: string;
    min?: number;
    max?: number;
}

// ==================== DATABASE TYPES ====================

export interface SavedMechanics {
    id: string;
    userId: string;
    projectId?: string;
    gameType: string;
    engine: GameEngine;
    mechanics: MechanicsSummary;
    files: MechanicsFile[];
    createdAt: Date;
    updatedAt: Date;
}

// ==================== ERROR TYPES ====================

export class MechanicsGenerationError extends Error {
    constructor(
        message: string,
        public code: MechanicsErrorCode,
        public details?: any
    ) {
        super(message);
        this.name = 'MechanicsGenerationError';
    }
}

export type MechanicsErrorCode =
    | 'ANALYSIS_FAILED'
    | 'TEMPLATE_NOT_FOUND'
    | 'GENERATION_FAILED'
    | 'CUSTOMIZATION_FAILED'
    | 'INVALID_REQUEST';
