import mongoose, { Schema, Document } from 'mongoose';

/**
 * Prototype Learning Model
 * Stores learnings from CUA test failures/fixes, scoped by project type and genre
 * to prevent cross-contamination between unrelated project types.
 */

export interface IPrototypeLearning extends Document {
    // Isolation fields - CRITICAL for preventing cross-contamination
    projectType: 'game' | 'webapp' | 'dashboard' | 'mobile' | 'api' | 'other';
    genre?: string; // Sub-category: 'chess', 'platformer', 'ecommerce', 'social', etc.

    // Learning content
    issuePattern: string; // Semantic description: "button click handler missing"
    issueCategory: 'ui' | 'logic' | 'state' | 'rendering' | 'interaction' | 'performance' | 'other';
    fix: string; // The solution: "Add onclick handler to all buttons"

    // Confidence and frequency
    confidence: number; // 0-1, increases with occurrences
    occurrences: number; // How many times this pattern was seen
    successRate: number; // 0-1, how often the fix worked

    // Source tracking
    source: 'cua-autofix' | 'manual' | 'ai-analysis';
    projectIds: string[]; // Projects that contributed to this learning

    // Metadata
    tags: string[]; // Additional context tags
    createdAt: Date;
    updatedAt: Date;
}

const prototypeLearningSchema = new Schema<IPrototypeLearning>(
    {
        projectType: {
            type: String,
            required: true,
            enum: ['game', 'webapp', 'dashboard', 'mobile', 'api', 'other'],
            index: true
        },
        genre: {
            type: String,
            index: true,
            sparse: true
        },
        issuePattern: {
            type: String,
            required: true
        },
        issueCategory: {
            type: String,
            required: true,
            enum: ['ui', 'logic', 'state', 'rendering', 'interaction', 'performance', 'other'],
            default: 'other'
        },
        fix: {
            type: String,
            required: true
        },
        confidence: {
            type: Number,
            required: true,
            min: 0,
            max: 1,
            default: 0.5
        },
        occurrences: {
            type: Number,
            required: true,
            default: 1
        },
        successRate: {
            type: Number,
            min: 0,
            max: 1,
            default: 1
        },
        source: {
            type: String,
            required: true,
            enum: ['cua-autofix', 'manual', 'ai-analysis'],
            default: 'cua-autofix'
        },
        projectIds: [{
            type: String
        }],
        tags: [{
            type: String
        }]
    },
    {
        timestamps: true
    }
);

// Compound indexes for efficient queries
prototypeLearningSchema.index({ projectType: 1, genre: 1, confidence: -1 });
prototypeLearningSchema.index({ projectType: 1, issueCategory: 1 });
prototypeLearningSchema.index({ issuePattern: 'text' }); // Text search on issue pattern

export const PrototypeLearning = mongoose.model<IPrototypeLearning>('PrototypeLearning', prototypeLearningSchema);
