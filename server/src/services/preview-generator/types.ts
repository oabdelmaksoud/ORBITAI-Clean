// Preview Generator Types
// Extracted from enhancedPreviewGenerator.service.ts

export interface ExtractedRequirements {
    requirements: string[];
    features: string[];
    constraints: string[];
    preferences: string[];
    targetPlatforms: string[]; // e.g., ['Web', 'iOS', 'Android', 'Desktop']
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
    // Multi-view support
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

export interface BrainstormingContext {
    ideas?: Array<{ label: string; description: string }>;
    keyInsights?: string[];
    nextSteps?: string;
    selectedStandards?: string[];
    messages?: any[];
    projectPreview?: any;
}

export interface ConversationMessage {
    sender: string;
    text: string;
}

export type SupportedMethodology =
    | 'V-Model'
    | 'Agile'
    | 'Waterfall'
    | 'Spiral'
    | 'DevOps'
    | 'Iterative'
    | 'Prototyping'
    | 'RAD'
    | 'Scrum'
    | 'Lean'
    | 'ASD';

export type ProjectDomain =
    | 'e-commerce'
    | 'game'
    | 'saas'
    | 'social'
    | 'healthcare'
    | 'education'
    | 'finance'
    | 'general';
