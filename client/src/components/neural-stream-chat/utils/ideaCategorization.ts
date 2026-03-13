// Idea Categorization Utilities
// Extracted from NeuralStreamChat.tsx

import { Idea } from '@src/OrbGraph';
import {
    IdeaCategory,
    VisualizationCategory,
    VALID_VIZ_CATEGORIES
} from '../types';

/**
 * Category mapping from common invalid categories to valid ones
 */
const CATEGORY_MAP: Record<string, IdeaCategory> = {
    'tech': 'technology',
    'technologies': 'technology',
    'architecture': 'technology',
    'architectural': 'technology',
    'implementation': 'technology',
    'user experience': 'ux',
    'ui': 'ux',
    'ui/ux': 'ux',
    'business model': 'business',
    'monetization': 'business',
    'analytics': 'data',
    'social': 'community',
    'mobile': 'platform',
    'web': 'platform',
    'desktop': 'platform',
    'cross-platform': 'platform',
    'recommendation': 'improvement',
    'recommendations': 'improvement',
    'suggestion': 'improvement',
    'suggestions': 'improvement',
    'best practice': 'improvement',
    'best practices': 'improvement',
    'standard': 'requirement',
    'standards': 'requirement',
    'requirement': 'requirement',
    'requirements': 'requirement',
    'design': 'ux',
    'pattern': 'technology',
    'patterns': 'technology'
};

/**
 * Valid categories list for validation
 */
const VALID_CATEGORIES: IdeaCategory[] = [
    'feature', 'technology', 'ux', 'data', 'business', 'community',
    'platform', 'constraint', 'opportunity', 'risk', 'requirement',
    'improvement', 'idea', 'other'
];

/**
 * Normalize idea categories before saving to database
 * Maps various formats to standard category types
 */
export const normalizeIdeaCategory = (cat: string | undefined): IdeaCategory => {
    if (!cat) return 'idea';
    const catLower = cat.toLowerCase();

    // Check if it's already a valid category
    if (VALID_CATEGORIES.includes(catLower as IdeaCategory)) {
        return catLower as IdeaCategory;
    }

    // Check category map
    if (CATEGORY_MAP[catLower]) {
        return CATEGORY_MAP[catLower];
    }

    // Substring matching for fallback
    if (catLower.includes('tech') || catLower.includes('arch')) return 'technology';
    if (catLower.includes('ux') || catLower.includes('design') || catLower.includes('interface')) return 'ux';
    if (catLower.includes('data') || catLower.includes('analytic')) return 'data';
    if (catLower.includes('business') || catLower.includes('revenue') || catLower.includes('profit')) return 'business';
    if (catLower.includes('communit') || catLower.includes('social')) return 'community';
    if (catLower.includes('plat') || catLower.includes('mobile') || catLower.includes('ios') || catLower.includes('android')) return 'platform';
    if (catLower.includes('risk')) return 'risk';
    if (catLower.includes('feature')) return 'feature';
    if (catLower.includes('req')) return 'requirement';

    return 'idea';
};

/**
 * AI-powered category inference using LLM
 * Provides intelligent categorization based on idea content
 */
export const categorizeIdeaWithAI = async (
    label: string,
    description?: string
): Promise<VisualizationCategory> => {
    try {
        const response = await fetch('/api/llm/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Categorize this idea into ONE of these categories: feature, technology, ux, data, business, community, platform, risk, opportunity, constraint, requirement, improvement.

Idea: "${label}"${description ? `\nDescription: "${description}"` : ''}

Output ONLY the category name (lowercase, single word). No explanation.`,
                history: [],
                contextType: 'wizard',
                preferFastModel: true,
                maxTokens: 20
            })
        });

        const data = await response.json();
        if (data.success && data.response) {
            const category = data.response.trim().toLowerCase().replace(/[^a-z]/g, '') as VisualizationCategory;
            if (VALID_VIZ_CATEGORIES.includes(category)) {
                return category;
            }
        }
    } catch (error) {
        console.warn('AI categorization failed, using fallback:', error);
    }

    // Fallback to 'feature' if AI fails
    return 'feature';
};

/**
 * Quick keyword-based fallback for immediate display
 * Used while AI processes for a snappier UX
 */
export const inferCategoryQuickFallback = (label: string): VisualizationCategory => {
    const text = label.toLowerCase();
    if (/\b(api|database|server|cloud|ai|ml|auth)\b/.test(text)) return 'technology';
    if (/\b(ui|ux|design|layout|theme)\b/.test(text)) return 'ux';
    if (/\b(data|analytics|metric|report)\b/.test(text)) return 'data';
    if (/\b(payment|pricing|revenue|monetiz)\b/.test(text)) return 'business';
    if (/\b(social|community|share|chat)\b/.test(text)) return 'community';
    if (/\b(platform|mobile|ios|android)\b/.test(text)) return 'platform';
    if (/\b(security|risk|privacy|compliance)\b/.test(text)) return 'risk';
    return 'feature';
};

/**
 * Normalize all ideas in an array with quick fallback categories
 * This is synchronous - uses quick fallback initially
 */
export const normalizeIdeas = (ideas: Idea[]): Idea[] => {
    return ideas.map(idea => {
        let category = normalizeIdeaCategory(idea.category);

        // If category is 'idea' or 'other', use quick fallback for immediate display
        if (category === 'idea' || category === 'other') {
            category = inferCategoryQuickFallback(idea.label) as IdeaCategory;
        }

        return {
            ...idea,
            category
        };
    });
};

/**
 * Async function to re-categorize ideas using AI
 * Call this after initial render for more accurate categorization
 */
export const recategorizeIdeasWithAI = async (
    ideas: Idea[],
    setIdeas: React.Dispatch<React.SetStateAction<Idea[]>>
): Promise<void> => {
    const ideasNeedingAI = ideas.filter(idea => {
        const cat = idea.category?.toLowerCase();
        return !cat || cat === 'idea' || cat === 'other' || cat === 'feature';
    });

    if (ideasNeedingAI.length === 0) return;

    // Process in parallel with a limit
    const batchSize = 5;
    for (let i = 0; i < ideasNeedingAI.length; i += batchSize) {
        const batch = ideasNeedingAI.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async idea => {
                const aiCategory = await categorizeIdeaWithAI(idea.label, idea.description);
                return { id: idea.id, category: aiCategory };
            })
        );

        // Update ideas with AI categories
        setIdeas(prev => prev.map(idea => {
            const result = results.find(r => r.id === idea.id);
            if (result) {
                return { ...idea, category: result.category as Idea['category'] };
            }
            return idea;
        }));
    }
};
