import mongoose, { Schema, Document } from 'mongoose';

export interface IABTestVariant {
  id: string;
  name: string;
  config: Record<string, any>;
  trafficPercent: number;
}

export interface IABTestMetrics {
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
  variants: IABTestVariant[];
  metrics: Record<string, IABTestMetrics>;
  winner?: string;
  startedAt: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const abTestVariantSchema = new Schema<IABTestVariant>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    trafficPercent: { type: Number, required: true }
  },
  { _id: false }
);

const abTestSchema = new Schema<IABTest>(
  {
    testId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    status: {
      type: String,
      required: true,
      enum: ['running', 'completed', 'cancelled'],
      default: 'running',
      index: true
    },
    variants: {
      type: [abTestVariantSchema],
      required: true,
      default: []
    },
    metrics: {
      type: Schema.Types.Mixed,
      default: {}
    },
    winner: {
      type: String
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    completedAt: {
      type: Date
    },
    createdBy: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

abTestSchema.index({ createdBy: 1, status: 1 });
abTestSchema.index({ startedAt: -1 });

export const ABTest = mongoose.model<IABTest>('ABTest', abTestSchema);
