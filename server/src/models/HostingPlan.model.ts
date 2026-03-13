/**
 * Hosting Plan Model
 * Defines pricing for hosting/deployment services
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IHostingPlan extends Document {
  name: string;
  description: string;
  platform: 'vercel' | 'railway' | 'render' | 'aws' | 'gcp' | 'azure' | 'netlify' | 'all';
  projectType: 'web' | 'mobile' | 'api' | 'desktop' | 'all';
  price: {
    monthly: number;
    yearly?: number;
    setup?: number; // One-time setup fee
  };
  resources: {
    compute?: string; // e.g., "512MB RAM, 1 vCPU"
    storage?: string; // e.g., "10GB"
    bandwidth?: string; // e.g., "100GB/month"
    buildMinutes?: number; // Build time per month
  };
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const hostingPlanSchema = new Schema<IHostingPlan>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    platform: {
      type: String,
      enum: ['vercel', 'railway', 'render', 'aws', 'gcp', 'azure', 'netlify', 'all'],
      required: true
    },
    projectType: {
      type: String,
      enum: ['web', 'mobile', 'api', 'desktop', 'all'],
      default: 'all'
    },
    price: {
      monthly: { type: Number, required: true },
      yearly: { type: Number },
      setup: { type: Number, default: 0 }
    },
    resources: {
      compute: { type: String },
      storage: { type: String },
      bandwidth: { type: String },
      buildMinutes: { type: Number }
    },
    features: [{
      type: String
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const HostingPlan = mongoose.model<IHostingPlan>('HostingPlan', hostingPlanSchema);




