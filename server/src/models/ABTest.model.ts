/**
 * ABTest Model
 * Persists LLM Router A/B test configurations, metrics, and results to MongoDB.
 * Replaces the previous in-memory Map storage (fixes: data lost on server restart).
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface ABTestVariant {
  id: string;
  name: string;
  config: Record<string, any>;
  trafficPercent: number;
}

export interface ABTestMetrics {
  requests: number;
  successRate: number;
  avgLatency: number;
  avgCost: number;
}

export interface IABTest extends Document {
  testId: string;
  name: string;
  description?: string;
  status: 'running' | 'completed' | 'cancelled';
  variants: ABTestVariant[];
  metrics: Record<string, ABTestMetrics>;
  winner?: string;
  startedAt: Date;
  completedAt?: Date;
  createdBy: string;
}

const ABTestVariantSchema = new Schema<ABTestVariant>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    trafficPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const ABTestMetricsSchema = new Schema<ABTestMetrics>(
  {
    requests: { type: Number, default: 0 },
    successRate: { type: Number, default: 100 },
    avgLatency: { type: Number, default: 0 },
    avgCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const ABTestSchema = new Schema<IABTest>(
  {
    testId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['running', 'completed', 'cancelled'],
      default: 'running',
      index: true,
    },
    variants: { type: [ABTestVariantSchema], required: true },
    metrics: { type: Schema.Types.Mixed, default: {} },
    winner: { type: String },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    createdBy: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'abtests',
  }
);

export const ABTest = mongoose.model<IABTest>('ABTest', ABTestSchema);
