/**
 * Flaky Test Model
 * Tracks flaky tests (non-deterministic failures)
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IFlakyTest extends Document {
  projectId: string;
  testName: string;
  testFile: string;
  flakinessRate: number; // 0-100, percentage of runs that fail
  failurePattern: 'intermittent' | 'time_dependent' | 'race_condition' | 'external_dependency' | 'shared_state' | 'unknown';
  causes: string[];
  fixes: Array<{
    type: 'mocking' | 'isolation' | 'time_control' | 'retry' | 'refactor';
    description: string;
    implementation: string;
  }>;
  status: 'detected' | 'fixing' | 'fixed' | 'ignored';
  firstDetected: Date;
  lastOccurred: Date;
  occurrenceCount: number;
}

const FlakyTestSchema = new Schema<IFlakyTest>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    testName: {
      type: String,
      required: true
    },
    testFile: {
      type: String,
      required: true
    },
    flakinessRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    failurePattern: {
      type: String,
      enum: ['intermittent', 'time_dependent', 'race_condition', 'external_dependency', 'shared_state', 'unknown'],
      default: 'unknown'
    },
    causes: [String],
    fixes: [{
      type: { type: String, enum: ['mocking', 'isolation', 'time_control', 'retry', 'refactor'] },
      description: String,
      implementation: String
    }],
    status: {
      type: String,
      enum: ['detected', 'fixing', 'fixed', 'ignored'],
      default: 'detected',
      index: true
    },
    firstDetected: {
      type: Date,
      default: Date.now
    },
    lastOccurred: {
      type: Date,
      default: Date.now
    },
    occurrenceCount: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

// Indexes
FlakyTestSchema.index({ projectId: 1, status: 1 });
FlakyTestSchema.index({ projectId: 1, flakinessRate: -1 });

export const FlakyTest = mongoose.model<IFlakyTest>('FlakyTest', FlakyTestSchema);



