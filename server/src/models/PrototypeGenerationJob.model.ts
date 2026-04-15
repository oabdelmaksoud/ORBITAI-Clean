/**
 * Prototype Generation Job Model
 * Tracks background prototype generation tasks
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IPrototypeGenerationJob extends Document {
  conversationId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStage?: string; // e.g., 'extracting-requirements', 'generating-architecture', etc.
  userGoal: string;
  conversationHistory: any[];
  useInternet: boolean;
  useEnhanced: boolean;
  isRegeneration: boolean;
  brainstormingContext?: any;
  generationSessionId?: string;
  result?: {
    summary?: string;
    techStack?: string[];
    wireframeCode?: string;
    architectureDiagram?: string;
    risks?: string[];
    recommendedMethodology?: string;
    recommendedStandards?: string[];
    estimatedSprints?: number;
    projectName?: string;
    mobileCode?: any;
    featureCoverage?: {
      totalFeatures: number;
      coveredFeatures: number;
      coveragePercentage: number;
      features: Array<{
        featureId: string;
        featureLabel: string;
        covered: boolean;
        confidence: number;
        matchedKeywords: string[];
      }>;
      generatedAt: number;
    };
  };
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

const prototypeGenerationJobSchema = new Schema<IPrototypeGenerationJob>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStage: {
      type: String,
    },
    userGoal: {
      type: String,
      required: true,
    },
    conversationHistory: {
      type: [Schema.Types.Mixed] as any,
      default: [],
    },
    useInternet: {
      type: Boolean,
      default: false,
    },
    useEnhanced: {
      type: Boolean,
      default: true,
    },
    isRegeneration: {
      type: Boolean,
      default: false,
    },
    brainstormingContext: {
      type: Schema.Types.Mixed,
    },
    generationSessionId: {
      type: String,
      index: true,
    },
    result: {
      type: Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
prototypeGenerationJobSchema.index({ conversationId: 1, status: 1 });
prototypeGenerationJobSchema.index({ userId: 1, status: 1 });
prototypeGenerationJobSchema.index({ status: 1, startedAt: -1 });

export const PrototypeGenerationJob = mongoose.model<IPrototypeGenerationJob>(
  'PrototypeGenerationJob',
  prototypeGenerationJobSchema
);
