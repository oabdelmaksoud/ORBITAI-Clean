/**
 * Code Evolution Model
 * Tracks code changes between versions and identifies regression patterns
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface ICodeEvolution extends Document {
  projectId: string;
  artifactId: string;
  version: string;
  snapshot: {
    content: string;
    qualityScore: number;
    complexity: number;
    lineCount: number;
    functionCount: number;
    testCount: number;
  };
  changes: {
    type: 'added' | 'modified' | 'deleted';
    location: string;
    description: string;
  }[];
  qualityTrend: 'improving' | 'stable' | 'degrading';
  regressionPatterns: string[];
  timestamp: Date;
}

const CodeEvolutionSchema = new Schema<ICodeEvolution>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    artifactId: {
      type: String,
      required: true,
      index: true
    },
    version: {
      type: String,
      required: true
    },
    snapshot: {
      content: String,
      qualityScore: { type: Number, min: 0, max: 100 },
      complexity: Number,
      lineCount: Number,
      functionCount: Number,
      testCount: Number
    },
    changes: [{
      type: { type: String, enum: ['added', 'modified', 'deleted'] },
      location: String,
      description: String
    }],
    qualityTrend: {
      type: String,
      enum: ['improving', 'stable', 'degrading'],
      default: 'stable'
    },
    regressionPatterns: [String],
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
CodeEvolutionSchema.index({ projectId: 1, artifactId: 1, version: 1 }, { unique: true });
CodeEvolutionSchema.index({ projectId: 1, timestamp: -1 });

export const CodeEvolution = mongoose.model<ICodeEvolution>('CodeEvolution', CodeEvolutionSchema);



