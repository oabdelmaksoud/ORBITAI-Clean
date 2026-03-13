/**
 * Quality Standard Model
 * Stores quality standards with metadata for automatic matching
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IQualityStandard extends Document {
  id: string;
  name: string;
  description: string;
  fullDescription?: string; // Extended description for better matching
  category: string[]; // e.g., ['automotive', 'medical', 'web', 'security']
  projectTypes: string[]; // e.g., ['embedded', 'web-app', 'mobile', 'api']
  industries: string[]; // e.g., ['automotive', 'healthcare', 'finance', 'e-commerce']
  keywords: string[]; // Search keywords
  complianceLevel?: 'required' | 'recommended' | 'optional';
  region?: string[]; // e.g., ['EU', 'US', 'global']
  embedding?: number[]; // Vector embedding for semantic search
  source?: string; // Source of the standard
  version?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const qualityStandardSchema = new Schema<IQualityStandard>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: true
    },
    fullDescription: {
      type: String,
      default: ''
    },
    category: {
      type: [String],
      default: [],
      index: true
    },
    projectTypes: {
      type: [String],
      default: [],
      index: true
    },
    industries: {
      type: [String],
      default: [],
      index: true
    },
    keywords: {
      type: [String],
      default: [],
      index: true
    },
    complianceLevel: {
      type: String,
      enum: ['required', 'recommended', 'optional'],
      default: 'recommended'
    },
    region: {
      type: [String],
      default: ['global']
    },
    embedding: {
      type: [Number],
      default: []
    },
    source: {
      type: String,
      default: 'ISO/IEC'
    },
    version: {
      type: String,
      default: 'latest'
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
qualityStandardSchema.index({ category: 1, isActive: 1 });
qualityStandardSchema.index({ projectTypes: 1, isActive: 1 });
qualityStandardSchema.index({ industries: 1, isActive: 1 });
qualityStandardSchema.index({ keywords: 1, isActive: 1 });

export const QualityStandard = mongoose.model<IQualityStandard>(
  'QualityStandard',
  qualityStandardSchema
);
















