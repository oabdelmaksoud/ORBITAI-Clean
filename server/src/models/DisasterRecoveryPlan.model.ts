/**
 * Disaster Recovery Plan Model
 * Stores disaster recovery playbooks
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IDisasterRecoveryPlan extends Document {
  projectId: string;
  planName: string;
  rto: number; // Recovery Time Objective in minutes
  rpo: number; // Recovery Point Objective in minutes
  backupStrategy: {
    frequency: 'hourly' | 'daily' | 'weekly';
    retention: number; // days
    locations: string[]; // Backup storage locations
  };
  recoveryProcedures: Array<{
    step: number;
    description: string;
    estimatedTime: number; // minutes
    dependencies?: string[];
  }>;
  failoverProcedures: Array<{
    scenario: string;
    steps: string[];
    estimatedTime: number;
  }>;
  lastTested?: Date;
  testResults?: {
    rtoAchieved: boolean;
    rpoAchieved: boolean;
    issues: string[];
  };
}

const DisasterRecoveryPlanSchema = new Schema<IDisasterRecoveryPlan>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    planName: {
      type: String,
      required: true
    },
    rto: {
      type: Number,
      required: true,
      min: 0
    },
    rpo: {
      type: Number,
      required: true,
      min: 0
    },
    backupStrategy: {
      frequency: {
        type: String,
        enum: ['hourly', 'daily', 'weekly'],
        default: 'daily'
      },
      retention: { type: Number, default: 30 },
      locations: [String]
    },
    recoveryProcedures: [{
      step: Number,
      description: String,
      estimatedTime: Number,
      dependencies: [String]
    }],
    failoverProcedures: [{
      scenario: String,
      steps: [String],
      estimatedTime: Number
    }],
    lastTested: Date,
    testResults: {
      rtoAchieved: Boolean,
      rpoAchieved: Boolean,
      issues: [String]
    }
  },
  {
    timestamps: true
  }
);

// Indexes
DisasterRecoveryPlanSchema.index({ projectId: 1 }, { unique: true });

export const DisasterRecoveryPlan = mongoose.model<IDisasterRecoveryPlan>(
  'DisasterRecoveryPlan',
  DisasterRecoveryPlanSchema
);



