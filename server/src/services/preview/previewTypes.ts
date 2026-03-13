/**
 * Preview Types
 * Shared type definitions for preview generation services
 */

export interface ExtractedRequirements {
    requirements: string[];
    features: string[];
    constraints: string[];
    preferences: string[];
    targetPlatforms: string[];
    projectType: 'web' | 'mobile' | 'api' | 'desktop' | 'game' | 'unknown';
}

export interface PreviewGenerationProgress {
    stage: string;
    progress: number;
    message: string;
}

export interface PreviewComponent {
    summary?: string;
    techStack?: string[];
    architectureDiagram?: string;
    wireframeCode?: string;
    risks?: string[];
    projectName?: string;
    recommendedMethodology?: string;
    recommendedStandards?: string[];
    views?: {
        endUser?: {
            preview: string;
            wireframe?: string;
        };
        adminConsole?: {
            preview: string;
            wireframe?: string;
        };
    };
}

export interface PreviewValidationResult {
    score: number;
    issues: Array<{
        field: string;
        severity: 'critical' | 'warning' | 'info';
        reason: string;
    }>;
}

export type ProjectType = 'web' | 'mobile' | 'api' | 'desktop' | 'game' | 'unknown';

export type ViewType = 'endUser' | 'adminConsole';

export interface WireframeGenerationOptions {
    userGoal: string;
    requirements: ExtractedRequirements;
    techStack: string[];
    architecture: string;
    fullPrompt: string;
    isRegeneration?: boolean;
    brainstormingContext?: unknown;
    viewType?: ViewType;
}

export interface PreviewGenerationOptions {
    userGoal: string;
    conversationHistory: Array<{ sender: string; text: string }>;
    useInternet?: boolean;
    progressCallback?: (stage: string, progress: number, message: string) => void;
    userId?: string;
    projectId?: string;
    isRegeneration?: boolean;
    brainstormingContext?: unknown;
    generationSessionId?: string;
}
