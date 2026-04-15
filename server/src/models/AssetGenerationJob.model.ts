/**
 * Asset Generation Job Model
 * Tracks bulk game asset generation jobs with progress and status
 */

import mongoose, { Schema } from 'mongoose';

export interface IAssetGenerationJob {
  projectId: string;
  userId: string;
  gameType: '2D' | '3D';
  genre: string;
  theme: string;
  assetList: Array<{
    type: '2D' | '3D';
    category: 'character' | 'prop' | 'environment' | 'ui';
    description: string;
    priority?: number;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  results: string[]; // Asset IDs that were generated
  errors: Array<{
    asset: string;
    error: string;
    timestamp: Date;
  }>;
  startedAt?: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number; // seconds
  options?: {
    artStyle?: string;
    qualityLevel?: 'draft' | 'standard' | 'high';
    autoRetry?: boolean;
    maxRetries?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const assetGenerationJobSchema = new Schema<IAssetGenerationJob>(
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
    gameType: {
      type: String,
      enum: ['2D', '3D'],
      required: true,
    },
    genre: {
      type: String,
      required: true,
    },
    theme: {
      type: String,
      required: true,
    },
    assetList: [
      {
        type: {
          type: String,
          enum: ['2D', '3D'],
          required: true,
        },
        category: {
          type: String,
          enum: ['character', 'prop', 'environment', 'ui'],
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        priority: {
          type: Number,
          default: 1,
        },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalAssets: {
      type: Number,
      required: true,
    },
    completedAssets: {
      type: Number,
      default: 0,
    },
    failedAssets: {
      type: Number,
      default: 0,
    },
    results: [
      {
        type: String, // Asset IDs
      },
    ],
    errors: [
      {
        asset: { type: String },
        error: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    estimatedTimeRemaining: {
      type: Number, // seconds
    },
    options: {
      artStyle: { type: String },
      qualityLevel: {
        type: String,
        enum: ['draft', 'standard', 'high'],
        default: 'standard',
      },
      autoRetry: {
        type: Boolean,
        default: true,
      },
      maxRetries: {
        type: Number,
        default: 3,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
assetGenerationJobSchema.index({ projectId: 1, status: 1 });
assetGenerationJobSchema.index({ userId: 1, createdAt: -1 });
assetGenerationJobSchema.index({ status: 1, createdAt: -1 });

// Virtual for calculating percentage complete
assetGenerationJobSchema.virtual('percentComplete').get(function () {
  if (this.totalAssets === 0) return 0;
  return Math.round((this.completedAssets / this.totalAssets) * 100);
});

export const AssetGenerationJob = mongoose.model<IAssetGenerationJob>(
  'AssetGenerationJob',
  assetGenerationJobSchema
);
