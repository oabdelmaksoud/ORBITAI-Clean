import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';

/**
 * Feature coverage result for a single feature
 */
export interface FeatureCoverage {
    featureId: string;
    featureLabel: string;
    covered: boolean;
    confidence: number; // 0-1 (0 = not found, 1 = high confidence match)
    matchedKeywords: string[];
    aiReasoning?: string; // AI explanation for why it's covered/not covered
    parentId?: string | null; // For hierarchical parent-child display
}

/**
 * Overall coverage report for a prototype
 */
export interface CoverageReport {
    totalFeatures: number;
    coveredFeatures: number;
    coveragePercentage: number;
    features: FeatureCoverage[];
    generatedAt: number;
    analysisMethod?: 'ai' | 'keyword'; // Which method was used
}

/**
 * Idea/Feature structure from brainstorming
 */
export interface BrainstormedIdea {
    id: string;
    label: string;
    description?: string;
    category?: string;
    parentId?: string;
}

/**
 * AI-Powered Coverage Analyzer Service
 * 
 * Uses LLM to semantically analyze prototype HTML and determine
 * which brainstormed features are implemented.
 */
export class CoverageAnalyzerService {

    /**
     * Analyze prototype HTML for coverage using AI (primary method)
     */
    async analyzePrototypeCoverageWithAI(
        htmlContent: string,
        selectedIdeas: BrainstormedIdea[]
    ): Promise<CoverageReport> {
        // Filter out welcome-bubble and empty labels
        const validIdeas = selectedIdeas.filter(
            idea => idea.id !== 'welcome-bubble' && idea.label && idea.label.trim().length > 0
        );

        if (!htmlContent || validIdeas.length === 0) {
            return {
                totalFeatures: validIdeas.length,
                coveredFeatures: 0,
                coveragePercentage: 0,
                features: [],
                generatedAt: Date.now(),
                analysisMethod: 'ai'
            };
        }

        try {
            // Build the feature list for the prompt
            const featureList = validIdeas.map((idea, idx) =>
                `${idx + 1}. "${idea.label}"${idea.description ? ` - ${idea.description}` : ''}`
            ).join('\n');

            // Truncate HTML to avoid token limits (keep first 15000 chars which should cover main UI)
            const truncatedHtml = htmlContent.length > 15000
                ? htmlContent.substring(0, 15000) + '\n... (truncated)'
                : htmlContent;

            const prompt = `You are analyzing a prototype HTML/JavaScript code to determine which planned features are implemented.

## PLANNED FEATURES (from brainstorming session):
${featureList}

## PROTOTYPE CODE:
\`\`\`html
${truncatedHtml}
\`\`\`

## TASK:
For each planned feature above, analyze the prototype code and determine:
1. Is this feature implemented in the prototype? (covered: true/false)
2. How confident are you? (confidence: 0.0 to 1.0)
3. Brief reasoning (one sentence explaining why you think it's implemented or not)

## IMPORTANT: PARENT-CHILD FEATURE RECOGNITION
Some features may be sub-features of other features. Use semantic understanding to recognize parent-child relationships:
- If a PARENT feature is implemented, its CHILD features should also be marked as covered
- Example: If "User Authentication" is implemented, then "Login Form", "Password Reset", "Sign Up" are covered
- Example: If "Shopping Cart" is implemented, then "Add to Cart", "Remove Item", "Cart Total" are covered
- Example: If "Dashboard" is implemented, then "Analytics Widget", "Recent Activity", "Quick Actions" are covered
- Look for semantic relationships even if not explicitly stated as parent/child

## COVERAGE RULES:
Consider a feature "implemented" if:
- There's UI for it (buttons, forms, sections, etc.)
- There's JavaScript logic for it
- It's referenced in event handlers, functions, or state
- Even partial implementations count
- A parent feature covering this functionality exists

Be GENEROUS in your assessment - if there's ANY evidence the feature is represented (directly or via a parent feature), mark it as covered.

## RESPONSE FORMAT:
Return ONLY valid JSON in this exact format:
{
  "features": [
    {
      "featureLabel": "Feature Name",
      "covered": true,
      "confidence": 0.85,
      "reasoning": "Found login form with email/password inputs and submit handler"
    }
  ]
}`;

            logger.info(`[CoverageAnalyzer] Analyzing ${validIdeas.length} features with AI...`);

            const response = await llmRouter.executeWithFallback({
                prompt,
                context: {
                    agentRole: 'Code Analyzer',
                    taskType: 'analysis'
                    // No hardcoded model - let intelligent router select based on user preferences
                },
                routingContext: {},
                requestType: 'analysis',
                contextType: 'other'
            });

            // Parse the JSON response
            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.features || !Array.isArray(parsed.features)) {
                throw new Error('Invalid response structure');
            }

            // Map AI response back to our features
            const features: FeatureCoverage[] = validIdeas.map(idea => {
                // Find matching AI result (fuzzy match on label)
                const aiResult = parsed.features.find((f: any) =>
                    f.featureLabel?.toLowerCase().includes(idea.label.toLowerCase().substring(0, 20)) ||
                    idea.label.toLowerCase().includes(f.featureLabel?.toLowerCase().substring(0, 20))
                );

                if (aiResult) {
                    return {
                        featureId: idea.id,
                        featureLabel: idea.label,
                        covered: Boolean(aiResult.covered),
                        confidence: Math.min(1, Math.max(0, Number(aiResult.confidence) || 0)),
                        matchedKeywords: aiResult.reasoning ? [`AI: ${aiResult.reasoning}`] : [],
                        aiReasoning: aiResult.reasoning,
                        parentId: idea.parentId || null // Preserve parent-child relationship
                    };
                } else {
                    // AI didn't return this feature - mark as not covered
                    return {
                        featureId: idea.id,
                        featureLabel: idea.label,
                        covered: false,
                        confidence: 0,
                        matchedKeywords: ['Not analyzed by AI'],
                        aiReasoning: 'Feature not found in AI analysis',
                        parentId: idea.parentId || null // Preserve parent-child relationship
                    };
                }
            });

            const coveredCount = features.filter(f => f.covered).length;
            const coveragePercentage = Math.round((coveredCount / validIdeas.length) * 100);

            logger.info(`[CoverageAnalyzer] AI Analysis complete: ${coveredCount}/${validIdeas.length} features covered (${coveragePercentage}%)`);

            return {
                totalFeatures: validIdeas.length,
                coveredFeatures: coveredCount,
                coveragePercentage,
                features,
                generatedAt: Date.now(),
                analysisMethod: 'ai'
            };

        } catch (error: unknown) {
            logger.warn(`[CoverageAnalyzer] AI analysis failed, falling back to keyword matching:`, (error instanceof Error ? error.message : String(error)));
            // Fall back to keyword-based analysis
            return this.analyzePrototypeCoverage(htmlContent, selectedIdeas);
        }
    }

    /**
     * Fallback: Keyword-based coverage analysis (used if AI fails)
     */
    analyzePrototypeCoverage(
        htmlContent: string,
        selectedIdeas: BrainstormedIdea[]
    ): CoverageReport {
        // Filter out welcome-bubble and empty labels
        const validIdeas = selectedIdeas.filter(
            idea => idea.id !== 'welcome-bubble' && idea.label && idea.label.trim().length > 0
        );

        if (!htmlContent || validIdeas.length === 0) {
            return {
                totalFeatures: validIdeas.length,
                coveredFeatures: 0,
                coveragePercentage: 0,
                features: [],
                generatedAt: Date.now(),
                analysisMethod: 'keyword'
            };
        }

        const htmlLower = htmlContent.toLowerCase();
        const features: FeatureCoverage[] = [];
        let coveredCount = 0;

        // Common synonyms for matching
        const synonyms: Record<string, string[]> = {
            'login': ['signin', 'sign-in', 'auth', 'authentication'],
            'signup': ['register', 'sign-up', 'create-account'],
            'user': ['account', 'profile', 'member'],
            'dashboard': ['home', 'overview', 'main'],
            'settings': ['preferences', 'options', 'config'],
            'search': ['find', 'filter', 'query'],
            'cart': ['basket', 'shopping', 'checkout'],
            'notification': ['alert', 'toast', 'message']
        };

        for (const idea of validIdeas) {
            const labelLower = idea.label.toLowerCase();
            const words = labelLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
            const matchedKeywords: string[] = [];

            // Check label directly
            const simplifiedLabel = labelLower.replace(/[^a-z0-9]/g, '');
            if (simplifiedLabel.length >= 4 && htmlLower.includes(simplifiedLabel)) {
                matchedKeywords.push(`[label match]`);
            }

            // Check each word and synonyms
            for (const word of words) {
                const termsToCheck = [word, ...(synonyms[word] || [])];
                for (const term of termsToCheck) {
                    if (htmlLower.includes(term)) {
                        matchedKeywords.push(term);
                        break;
                    }
                }
            }

            // Calculate confidence
            let confidence = 0;
            if (matchedKeywords.length > 0) {
                confidence = Math.min(0.5 + (matchedKeywords.length * 0.15), 0.95);
            }

            const covered = confidence >= 0.5;
            if (covered) coveredCount++;

            features.push({
                featureId: idea.id,
                featureLabel: idea.label,
                covered,
                confidence,
                matchedKeywords,
                parentId: idea.parentId || null // Preserve parent-child relationship
            });
        }

        const coveragePercentage = Math.round((coveredCount / validIdeas.length) * 100);

        logger.info(`[CoverageAnalyzer] Keyword analysis: ${coveredCount}/${validIdeas.length} features covered (${coveragePercentage}%)`);

        return {
            totalFeatures: validIdeas.length,
            coveredFeatures: coveredCount,
            coveragePercentage,
            features,
            generatedAt: Date.now(),
            analysisMethod: 'keyword'
        };
    }

    /**
     * Get a human-readable summary of coverage
     */
    getCoverageSummary(report: CoverageReport): string {
        const methodLabel = report.analysisMethod === 'ai' ? '🤖 AI Analysis' : '🔍 Keyword Analysis';

        if (report.totalFeatures === 0) {
            return 'No features to analyze';
        }

        if (report.coveragePercentage === 100) {
            return `✅ ${methodLabel}: All ${report.totalFeatures} features detected`;
        }

        if (report.coveragePercentage >= 80) {
            return `✅ ${methodLabel}: ${report.coveredFeatures}/${report.totalFeatures} features detected (${report.coveragePercentage}%)`;
        }

        if (report.coveragePercentage >= 50) {
            return `⚠️ ${methodLabel}: ${report.coveredFeatures}/${report.totalFeatures} features detected. May need refinement.`;
        }

        return `⚠️ ${methodLabel}: Only ${report.coveredFeatures}/${report.totalFeatures} features detected. Consider regenerating.`;
    }
}

// Export singleton instance
export const coverageAnalyzer = new CoverageAnalyzerService();
