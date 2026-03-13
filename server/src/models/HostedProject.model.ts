/**
 * Hosted Project Model
 * Tracks projects that are hosted/deployed through the platform
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IHostedProject extends Document {
  userId: string;
  projectId: string;
  projectName: string;
  platform: string;
  environment: 'development' | 'staging' | 'production';
  url?: string;
  status: 'active' | 'suspended' | 'terminated';
  hostingPlanId?: string;
  deploymentId?: string;
  resourceUsage: {
    compute?: number; // CPU hours
    storage?: number; // GB
    bandwidth?: number; // GB
    buildMinutes?: number;
  };
  billing: {
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    amount: number;
    currency: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const hostedProjectSchema = new Schema<IHostedProject>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    projectId: {
      type: String,
      required: true,
      index: true
    },
    projectName: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      required: true
    },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'production'
    },
    url: {
      type: String
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'terminated'],
      default: 'active'
    },
    hostingPlanId: {
      type: String
    },
    deploymentId: {
      type: String
    },
    resourceUsage: {
      compute: { type: Number, default: 0 },
      storage: { type: Number, default: 0 },
      bandwidth: { type: Number, default: 0 },
      buildMinutes: { type: Number, default: 0 }
    },
    billing: {
      currentPeriodStart: { type: Date, required: true },
      currentPeriodEnd: { type: Date, required: true },
      amount: { type: Number, required: true },
      currency: { type: String, default: 'USD' }
    }
  },
  {
    timestamps: true
  }
);

hostedProjectSchema.index({ userId: 1, status: 1 });
hostedProjectSchema.index({ projectId: 1 });

export const HostedProject = mongoose.model<IHostedProject>('HostedProject', hostedProjectSchema);




