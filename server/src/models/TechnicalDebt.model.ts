/**
 * Technical Debt Model
 * Tracks technical debt accumulation over time
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface ITechnicalDebt extends Document {
  projectId: string;
  category: 'code_quality' | 'missing_tests' | 'security' | 'performance' | 'architecture' | 'documentation' | 'dependencies';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string; // File path or artifact ID
  estimatedEffort: number; // Hours to fix
  debtScore: number; // 0-100, calculated based on severity and effort
  status: 'open' | 'in_progress' | 'resolved' | 'deferred';
  identifiedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  tags?: string[];
  relatedArtifacts?: string[]; // Artifact IDs
}

const TechnicalDebtSchema = new Schema<ITechnicalDebt>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      enum: ['code_quality', 'missing_tests', 'security', 'performance', 'architecture', 'documentation', 'dependencies'],
      index: true
    },
    severity: {
      type: String,
      required: true,
      enum: ['critical', 'high', 'medium', 'low'],
      index: true
    },
    description: {
      type: String,
      required: true
    },
    location: String,
    estimatedEffort: {
      type: Number,
      required: true,
      min: 0
    },
    debtScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'deferred'],
      default: 'open',
      index: true
    },
    identifiedAt: {
      type: Date,
      default: Date.now
    },
    resolvedAt: Date,
    resolvedBy: String,
    tags: [String],
    relatedArtifacts: [String]
  },
  {
    timestamps: true
  }
);

// Indexes
TechnicalDebtSchema.index({ projectId: 1, status: 1 });
TechnicalDebtSchema.index({ projectId: 1, category: 1 });
TechnicalDebtSchema.index({ projectId: 1, severity: 1 });
TechnicalDebtSchema.index({ projectId: 1, identifiedAt: -1 });

export const TechnicalDebt = mongoose.model<ITechnicalDebt>('TechnicalDebt', TechnicalDebtSchema);



