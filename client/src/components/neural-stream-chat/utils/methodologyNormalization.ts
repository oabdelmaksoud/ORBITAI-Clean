// Methodology Normalization Utilities
// Extracted from NeuralStreamChat.tsx

import { ValidMethodology } from '../types';
import { ProjectPreview } from '@src/services/geminiService';

/**
 * Map methodology strings to valid enum values
 */
const METHODOLOGY_MAP: Record<string, ValidMethodology> = {
    'v-model': 'V-Model',
    'vmodel': 'V-Model',
    'agile': 'Agile',
    'waterfall': 'Waterfall',
    'spiral': 'Spiral',
    'devops': 'DevOps',
    'dev-ops': 'DevOps',
    'iterative': 'Iterative',
    'prototyping': 'Prototyping',
    'prototype': 'Prototyping',
    'rad': 'RAD',
    'rapid application development': 'RAD',
    'scrum': 'Scrum',
    'lean': 'Lean',
    'asd': 'ASD',
    'adaptive software development': 'ASD',
    'langgraph': 'Agile',  // LangGraph is a framework, not an SDLC methodology
    'lang-graph': 'Agile'
};

/**
 * Normalize recommendedMethodology to valid enum values
 * Supports all SDLC methodologies: V-Model, Agile, Waterfall, Spiral, DevOps, 
 * Iterative, Prototyping, RAD, Scrum, Lean, ASD
 * 
 * @param methodology - Raw methodology string from AI or user input
 * @returns Normalized ValidMethodology or undefined
 */
export const normalizeMethodology = (
    methodology: string | undefined
): ValidMethodology | undefined => {
    if (!methodology) return undefined;
    const methodLower = methodology.toLowerCase().trim();

    // Check exact matches first
    if (METHODOLOGY_MAP[methodLower]) {
        return METHODOLOGY_MAP[methodLower];
    }

    // Check partial matches (e.g., "scrum-based", "agile methodology")
    for (const [key, value] of Object.entries(METHODOLOGY_MAP)) {
        if (methodLower.includes(key) || key.includes(methodLower)) {
            return value;
        }
    }

    // Check for common framework variants
    if (methodLower.includes('scrum')) return 'Scrum';
    if (methodLower.includes('kanban') && !methodLower.includes('lean')) return 'Lean';
    if (methodLower.includes('xp') || methodLower.includes('extreme programming')) return 'Agile';
    if (methodLower.includes('rapid') && methodLower.includes('development')) return 'RAD';
    if (methodLower.includes('adaptive') && methodLower.includes('development')) return 'ASD';

    // Default to 'Agile' for unknown methodologies
    return 'Agile';
};

/**
 * Normalize projectPreview to ensure valid methodology
 * 
 * @param preview - ProjectPreview object that may have invalid methodology
 * @returns Normalized ProjectPreview with valid methodology
 */
export const normalizeProjectPreview = (
    preview: ProjectPreview | null | undefined
): ProjectPreview | null | undefined => {
    if (!preview) return preview;

    return {
        ...preview,
        recommendedMethodology: preview.recommendedMethodology
            ? normalizeMethodology(preview.recommendedMethodology)
            : undefined
    };
};

/**
 * Get all valid methodologies for display in UI
 */
export const getValidMethodologies = (): ValidMethodology[] => [
    'V-Model',
    'Agile',
    'Waterfall',
    'Spiral',
    'DevOps',
    'Iterative',
    'Prototyping',
    'RAD',
    'Scrum',
    'Lean',
    'ASD'
];

/**
 * Get methodology description for UI display
 */
export const getMethodologyDescription = (methodology: ValidMethodology): string => {
    const descriptions: Record<ValidMethodology, string> = {
        'V-Model': 'Verification and Validation model - sequential with testing emphasis',
        'Agile': 'Iterative development with continuous feedback and adaptation',
        'Waterfall': 'Linear sequential phases from requirements to deployment',
        'Spiral': 'Risk-driven iterative development combining waterfall and prototyping',
        'DevOps': 'Continuous development, integration, and deployment practices',
        'Iterative': 'Cyclic development with repeated refinement phases',
        'Prototyping': 'Rapid prototype creation for requirements validation',
        'RAD': 'Rapid Application Development - quick prototyping and iteration',
        'Scrum': 'Agile framework with sprints and defined roles',
        'Lean': 'Eliminate waste and optimize value delivery',
        'ASD': 'Adaptive Software Development - speculation, collaboration, learning'
    };
    return descriptions[methodology];
};
