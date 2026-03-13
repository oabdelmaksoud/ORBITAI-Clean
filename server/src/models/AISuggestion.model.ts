import mongoose, { Schema, Document } from 'mongoose';

export interface IAISuggestion extends Document {
  projectId: string;
  userId: string;
  type: 'optimization' | 'improvement' | 'best-practice' | 'security' | 'performance';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  category: string;
  actionable: boolean;
  applied: boolean;
  appliedAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
  appliedCount?: number; // Track how many times this suggestion was applied
  effectiveness?: 'high' | 'medium' | 'low' | 'unknown'; // User feedback on effectiveness
  metadata?: {
    relatedArtifacts?: string[];
    relatedTasks?: string[];
    confidence?: number;
    reasoning?: string;
    similarSuggestions?: string[]; // IDs of similar suggestions
    learnedPatterns?: string[]; // Patterns learned from this suggestion
  };
  createdAt: Date;
  updatedAt: Date;
}

const AISuggestionSchema = new Schema<IAISuggestion>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['optimization', 'improvement', 'best-practice', 'security', 'performance'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    impact: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    effort: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    actionable: {
      type: Boolean,
      default: true,
    },
    applied: {
      type: Boolean,
      default: false,
    },
    appliedAt: {
      type: Date,
    },
    dismissed: {
      type: Boolean,
      default: false,
    },
    dismissedAt: {
      type: Date,
    },
    metadata: {
      relatedArtifacts: [String],
      relatedTasks: [String],
      confidence: Number,
      reasoning: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
AISuggestionSchema.index({ projectId: 1, dismissed: 1 });
AISuggestionSchema.index({ userId: 1, applied: 1 });
AISuggestionSchema.index({ createdAt: -1 });

export const AISuggestion = mongoose.model<IAISuggestion>('AISuggestion', AISuggestionSchema);

