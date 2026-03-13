/**
 * Scope Detection Service
 * Auto-detects project complexity from user input to prevent overengineering
 */

import { logger } from '../utils/logger.js';

export type ProjectScope = 'mvp' | 'simple' | 'standard' | 'full';

export interface ScopeDetectionResult {
    scope: ProjectScope;
    confidence: number; // 0-1
    reasoning: string;
    suggestedFeatureCount: { min: number; max: number };
}

// Keyword patterns for each scope level
const SCOPE_KEYWORDS: Record<ProjectScope, RegExp[]> = {
    mvp: [
        /\bmvp\b/i,
        /\bminimum viable\b/i,
        /\bquick\s+(demo|prototype|test)\b/i,
        /\bjust\s+want\s+to\s+(try|test|demo)\b/i,
        /\bproof\s+of\s+concept\b/i,
        /\bpoc\b/i,
        /\bbasic\s+(version|demo|prototype)\b/i,
        /\bkeep\s+it\s+simple\b/i,
        /\bno\s+frills\b/i,
        /\bbare\s+bones\b/i,
        /\bsimplest\s+possible\b/i,
    ],
    simple: [
        /\bsimple\b/i,
        /\bbasic\b/i,
        /\bpersonal\s+project\b/i,
        /\blearning\b/i,
        /\bstarter\b/i,
        /\bminimal\b/i,
        /\bbeginner\b/i,
        /\bsmall\s+project\b/i,
        /\bfor\s+fun\b/i,
        /\bhobby\b/i,
        /\bside\s+project\b/i,
        /\bjust\s+a\b/i,
        /\bonly\s+need\b/i,
    ],
    standard: [
        /\bstandard\b/i,
        /\bproduction\b/i,
        /\bstartup\b/i,
        /\bbusiness\b/i,
        /\bprofessional\b/i,
        /\breal\s+app\b/i,
        /\blaunch\b/i,
        /\busers\b/i,
        /\bcustomers\b/i,
        /\bteam\b/i,
    ],
    full: [
        /\benterprise\b/i,
        /\bfull[\s-]featured\b/i,
        /\bcomprehensive\b/i,
        /\bscale\b/i,
        /\bscalable\b/i,
        /\bmicroservices\b/i,
        /\bmulti[\s-]tenant\b/i,
        /\bglobal\b/i,
        /\bfortune\s+500\b/i,
        /\blarge[\s-]scale\b/i,
        /\bhigh[\s-]availability\b/i,
        /\bhigh[\s-]traffic\b/i,
        /\bmillions?\s+(of\s+)?users\b/i,
        /\b24\/7\b/i,
    ],
};

// Complexity indicators from feature requests
const COMPLEXITY_FEATURES: { pattern: RegExp; weight: number }[] = [
    // High complexity indicators (+2)
    { pattern: /\bmicroservices?\b/i, weight: 2 },
    { pattern: /\bmulti[\s-]tenant\b/i, weight: 2 },
    { pattern: /\breal[\s-]time\b/i, weight: 1 },
    { pattern: /\banalytics\b/i, weight: 1 },
    { pattern: /\breporting\b/i, weight: 1 },
    { pattern: /\bsso\b/i, weight: 2 },
    { pattern: /\boauth\b/i, weight: 1 },
    { pattern: /\bpayment(s)?\b/i, weight: 2 },
    { pattern: /\bstripe\b/i, weight: 2 },
    { pattern: /\bsubscription\b/i, weight: 2 },
    { pattern: /\be[\s-]?commerce\b/i, weight: 2 },
    { pattern: /\bshipping\b/i, weight: 1 },
    { pattern: /\bmachine\s+learning\b/i, weight: 2 },
    { pattern: /\bai\s+(powered|features?)\b/i, weight: 1 },
    { pattern: /\bapi\s+(gateway|management)\b/i, weight: 2 },
    { pattern: /\bwebhooks?\b/i, weight: 1 },
    { pattern: /\bintegrat(e|ion)(s)?\b/i, weight: 1 },
    { pattern: /\bnotifications?\b/i, weight: 1 },
    { pattern: /\b(push|email|sms)\s+notif/i, weight: 1 },
    { pattern: /\badmin\s+(panel|dashboard|console)\b/i, weight: 1 },
    { pattern: /\broles?\s+(and\s+)?permissions?\b/i, weight: 1 },
    { pattern: /\baudit\s+(log|trail)\b/i, weight: 1 },

    // Low complexity indicators (-1)
    { pattern: /\bjust\s+one\b/i, weight: -1 },
    { pattern: /\bonly\s+(one|a\s+few)\b/i, weight: -1 },
    { pattern: /\bno\s+database\b/i, weight: -1 },
    { pattern: /\bstatic\s+(site|page)\b/i, weight: -2 },
    { pattern: /\blanding\s+page\b/i, weight: -2 },
];

class ScopeDetectionService {
    private initialized: boolean = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('✅ Scope Detection Service initialized');
    }

    /**
     * Detect project scope from user input
     */
    detectScope(userInput: string): ScopeDetectionResult {
        const input = userInput.toLowerCase();

        // Score each scope level
        const scores: Record<ProjectScope, number> = {
            mvp: 0,
            simple: 0,
            standard: 0,
            full: 0,
        };

        // Check keyword matches
        for (const [scope, patterns] of Object.entries(SCOPE_KEYWORDS) as [ProjectScope, RegExp[]][]) {
            for (const pattern of patterns) {
                if (pattern.test(input)) {
                    scores[scope] += 2;
                }
            }
        }

        // Calculate complexity score from features
        let complexityScore = 0;
        for (const { pattern, weight } of COMPLEXITY_FEATURES) {
            if (pattern.test(input)) {
                complexityScore += weight;
            }
        }

        // Adjust scores based on complexity
        if (complexityScore >= 5) {
            scores.full += 3;
        } else if (complexityScore >= 3) {
            scores.standard += 2;
        } else if (complexityScore >= 1) {
            scores.simple += 1;
        } else if (complexityScore <= -2) {
            scores.mvp += 2;
        }

        // Check input length as a heuristic
        // Longer descriptions often indicate more complex projects
        const wordCount = input.split(/\s+/).length;
        if (wordCount > 100) {
            scores.full += 1;
        } else if (wordCount > 50) {
            scores.standard += 1;
        } else if (wordCount < 15) {
            scores.simple += 1;
        }

        // Find the highest scoring scope
        const entries = Object.entries(scores) as [ProjectScope, number][];
        entries.sort((a, b) => b[1] - a[1]);

        const topScope = entries[0][0];
        const topScore = entries[0][1];
        const secondScore = entries[1]?.[1] || 0;

        // Calculate confidence based on score difference
        let confidence = 0.7; // Default confidence
        if (topScore === 0) {
            // No matches - default to standard with low confidence
            confidence = 0.3;
        } else if (topScore > secondScore + 2) {
            confidence = 0.9;
        } else if (topScore > secondScore) {
            confidence = 0.7;
        } else {
            confidence = 0.5;
        }

        // Generate reasoning
        const reasoning = this.generateReasoning(topScope, complexityScore, wordCount);

        // Feature count suggestions
        const featureCounts: Record<ProjectScope, { min: number; max: number }> = {
            mvp: { min: 3, max: 5 },
            simple: { min: 5, max: 8 },
            standard: { min: 8, max: 15 },
            full: { min: 15, max: 30 },
        };

        logger.info(`[ScopeDetection] Detected scope: ${topScope} (confidence: ${confidence.toFixed(2)})`);

        return {
            scope: topScore === 0 ? 'standard' : topScope,
            confidence,
            reasoning,
            suggestedFeatureCount: featureCounts[topScore === 0 ? 'standard' : topScope],
        };
    }

    /**
     * Generate human-readable reasoning for scope detection
     */
    private generateReasoning(
        scope: ProjectScope,
        complexityScore: number,
        wordCount: number
    ): string {
        const reasons: string[] = [];

        switch (scope) {
            case 'mvp':
                reasons.push('User indicated they want a minimal or prototype version');
                break;
            case 'simple':
                reasons.push('Project appears to be a personal or learning project');
                break;
            case 'standard':
                reasons.push('Project has typical production requirements');
                break;
            case 'full':
                reasons.push('Project has enterprise-level requirements or complex features');
                break;
        }

        if (complexityScore >= 5) {
            reasons.push(`High complexity detected (${complexityScore} complexity indicators)`);
        } else if (complexityScore <= -2) {
            reasons.push('Low complexity indicators detected');
        }

        if (wordCount < 15) {
            reasons.push('Short description suggests simpler scope');
        } else if (wordCount > 100) {
            reasons.push('Detailed description suggests more complex requirements');
        }

        return reasons.join('. ') + '.';
    }

    /**
     * Get scope constraints for prompts
     */
    getScopeConstraints(scope: ProjectScope): string {
        const constraints: Record<ProjectScope, string> = {
            mvp: `SCOPE: MVP (Minimum Viable Product)
- Generate ONLY 3-5 essential core features
- Focus on the absolute minimum needed to validate the idea
- No nice-to-haves, no future features
- Simple architecture: single app + database
- Prioritize speed to launch over completeness`,

            simple: `SCOPE: Simple Project
- Generate 5-8 focused features
- Keep it achievable for a solo developer
- Simple, proven technology stack
- Modular but monolithic architecture
- Focus on core user journey only`,

            standard: `SCOPE: Standard Production App
- Generate 8-15 features covering key functionality
- Balance between features and maintainability
- Standard industry practices
- Consider scalability but don't over-architect
- Include essential admin features`,

            full: `SCOPE: Full-Featured Enterprise
- Generate 15+ features for comprehensive coverage
- Include advanced features, integrations, analytics
- Enterprise-ready architecture
- Consider multi-tenancy, high availability
- Include complete admin console and reporting`,
        };

        return constraints[scope];
    }

    /**
     * Get feature count limits for a scope
     */
    getFeatureLimits(scope: ProjectScope): { min: number; max: number } {
        const limits: Record<ProjectScope, { min: number; max: number }> = {
            mvp: { min: 3, max: 5 },
            simple: { min: 5, max: 8 },
            standard: { min: 8, max: 15 },
            full: { min: 15, max: 30 },
        };
        return limits[scope];
    }
}

export const scopeDetectionService = new ScopeDetectionService();
