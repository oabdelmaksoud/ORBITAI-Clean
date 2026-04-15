/**
 * Prototype Learning Service
 * Records and retrieves learnings from CUA test failures/fixes,
 * scoped by project type and genre to prevent cross-contamination.
 */

import { PrototypeLearning, IPrototypeLearning } from '../models/PrototypeLearning.model.js';
import { logger } from '../utils/logger.js';

interface RecordLearningInput {
    projectType: string;
    genre?: string;
    issuePattern: string;
    issueCategory?: string;
    fix: string;
    source?: 'cua-autofix' | 'manual' | 'ai-analysis';
    projectId?: string;
    tags?: string[];
}

interface RetrievedLearning {
    issuePattern: string;
    fix: string;
    confidence: number;
    occurrences: number;
}

class PrototypeLearningService {
    /**
     * Record a new learning or increment occurrence of existing one
     */
    async recordLearning(input: RecordLearningInput): Promise<IPrototypeLearning> {
        const {
            projectType,
            genre,
            issuePattern,
            // @ts-ignore TS6133
            _issueCategory = 'other',
            fix,
            source = 'cua-autofix',
            projectId,
            tags = []
        } = input;

        // Normalize project type
        const normalizedType = this.normalizeProjectType(projectType);

        try {
            // Check if similar learning already exists
            const existing = await PrototypeLearning.findOne({
                projectType: normalizedType,
                genre: genre || null,
                issuePattern: { $regex: this.createPatternRegex(issuePattern), $options: 'i' }
            });

            if (existing) {
                // Update existing learning
                existing.occurrences += 1;
                existing.confidence = Math.min(1, existing.confidence + 0.1); // Increase confidence

                if (projectId && !existing.projectIds.includes(projectId)) {
                    existing.projectIds.push(projectId);
                }

                if (tags.length > 0) {
                    existing.tags = [...new Set([...existing.tags, ...tags])];
                }

                await existing.save();
                logger.info(`[PrototypeLearning] Updated existing learning (occurrences: ${existing.occurrences})`, {
                    projectType: normalizedType,
                    genre,
                    issuePattern: issuePattern.substring(0, 50)
                });
                return existing;
            }

            // Create new learning
            const learning = await PrototypeLearning.create({
                projectType: normalizedType,
                genre: genre || undefined,
                issuePattern,
                issueCategory: this.categorizeIssue(issuePattern),
                fix,
                confidence: 0.5, // Start at 50% confidence
                occurrences: 1,
                successRate: 1,
                source,
                projectIds: projectId ? [projectId] : [],
                tags
            });

            logger.info(`[PrototypeLearning] Recorded new learning`, {
                projectType: normalizedType,
                genre,
                issuePattern: issuePattern.substring(0, 50)
            });

            return learning;
        } catch (error: unknown) {
            logger.error(`[PrototypeLearning] Failed to record learning:`, (error instanceof Error ? error.message : String(error)));
            throw error;
        }
    }

    /**
     * Get relevant learnings for a project type and optional genre
     * Only returns learnings with confidence above threshold
     */
    async getRelevantLearnings(
        projectType: string,
        genre?: string,
        limit: number = 5,
        minConfidence: number = 0.5
    ): Promise<RetrievedLearning[]> {
        const normalizedType = this.normalizeProjectType(projectType);

        try {
            // Build query with strict isolation
            const query: any = {
                projectType: normalizedType,
                confidence: { $gte: minConfidence }
            };

            // If genre is specified, match it; otherwise only get general learnings
            if (genre) {
                query.$or = [
                    { genre: genre },
                    { genre: { $exists: false } },
                    { genre: null }
                ];
            } else {
                // No genre specified - only get general learnings for this project type
                query.$or = [
                    { genre: { $exists: false } },
                    { genre: null }
                ];
            }

            const learnings = await PrototypeLearning.find(query)
                .sort({ confidence: -1, occurrences: -1 })
                .limit(limit)
                .select('issuePattern fix confidence occurrences')
                .lean();

            logger.info(`[PrototypeLearning] Retrieved ${learnings.length} learnings for ${normalizedType}/${genre || 'general'}`);

            return learnings.map(l => ({
                issuePattern: l.issuePattern,
                fix: l.fix,
                confidence: l.confidence,
                occurrences: l.occurrences
            }));
        } catch (error: unknown) {
            logger.error(`[PrototypeLearning] Failed to retrieve learnings:`, (error instanceof Error ? error.message : String(error)));
            return [];
        }
    }

    /**
     * Mark a learning's fix as successful or failed
     */
    async updateSuccessRate(learningId: string, success: boolean): Promise<void> {
        try {
            const learning = await PrototypeLearning.findById(learningId);
            if (!learning) return;

            // Weighted average update
            const totalAttempts = learning.occurrences;
            const currentSuccesses = learning.successRate * totalAttempts;
            const newSuccesses = success ? currentSuccesses + 1 : currentSuccesses;
            learning.successRate = newSuccesses / (totalAttempts + 1);

            // Adjust confidence based on success rate
            if (learning.successRate < 0.5) {
                learning.confidence = Math.max(0, learning.confidence - 0.1);
            }

            await learning.save();
        } catch (error: unknown) {
            logger.warn(`[PrototypeLearning] Failed to update success rate:`, (error instanceof Error ? error.message : String(error)));
        }
    }

    /**
     * Normalize project type to valid enum value
     */
    private normalizeProjectType(projectType: string): string {
        const typeMap: Record<string, string> = {
            'game': 'game',
            'webapp': 'webapp',
            'web-app': 'webapp',
            'web': 'webapp',
            'dashboard': 'dashboard',
            'admin': 'dashboard',
            'mobile': 'mobile',
            'mobile-app': 'mobile',
            'api': 'api',
            'backend': 'api'
        };

        return typeMap[projectType?.toLowerCase()] || 'other';
    }

    /**
     * Categorize issue based on keywords
     */
    private categorizeIssue(issuePattern: string): string {
        const lower = issuePattern.toLowerCase();

        if (lower.includes('click') || lower.includes('button') || lower.includes('input')) {
            return 'interaction';
        }
        if (lower.includes('render') || lower.includes('display') || lower.includes('show')) {
            return 'rendering';
        }
        if (lower.includes('state') || lower.includes('data') || lower.includes('value')) {
            return 'state';
        }
        if (lower.includes('style') || lower.includes('layout') || lower.includes('css')) {
            return 'ui';
        }
        if (lower.includes('logic') || lower.includes('function') || lower.includes('error')) {
            return 'logic';
        }
        if (lower.includes('slow') || lower.includes('timeout') || lower.includes('performance')) {
            return 'performance';
        }

        return 'other';
    }

    /**
     * Create a flexible regex pattern for matching similar issues
     */
    private createPatternRegex(issuePattern: string): string {
        // Extract key words and create a pattern
        const keywords = issuePattern
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3)
            .slice(0, 5);

        return keywords.map(k => `(?=.*${k})`).join('');
    }
}

export const prototypeLearningService = new PrototypeLearningService();
