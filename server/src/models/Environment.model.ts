/**
 * Environment Model
 * Manages dev/staging/production environments
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IEnvironment extends Document {
  projectId: string;
  name: string; // 'development' | 'staging' | 'production'
  platform: string;
  url?: string;
  configuration: {
    envVars: Record<string, string>;
    resourceSizing: {
      cpu?: string;
      memory?: string;
      instances?: number;
    };
    featureFlags: Record<string, boolean>;
  };
  secrets: Array<{
    key: string;
    source: 'environment' | 'secrets_manager' | 'vault';
    encrypted: boolean;
  }>;
  status: 'active' | 'inactive' | 'deploying' | 'failed';
  lastDeployed?: Date;
  deployedBy?: string;
}

const EnvironmentSchema = new Schema<IEnvironment>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      enum: ['development', 'staging', 'production'],
      index: true
    },
    platform: {
      type: String,
      required: true
    },
    url: String,
    configuration: {
      envVars: { type: Schema.Types.Mixed, default: {} },
      resourceSizing: {
        cpu: String,
        memory: String,
        instances: { type: Number, default: 1 }
      },
      featureFlags: { type: Schema.Types.Mixed, default: {} }
    },
    secrets: [{
      key: String,
      source: {
        type: String,
        enum: ['environment', 'secrets_manager', 'vault']
      },
      encrypted: { type: Boolean, default: true }
    }],
    status: {
      type: String,
      enum: ['active', 'inactive', 'deploying', 'failed'],
      default: 'inactive',
      index: true
    },
    lastDeployed: Date,
    deployedBy: String
  },
  {
    timestamps: true
  }
);

// Indexes
EnvironmentSchema.index({ projectId: 1, name: 1 }, { unique: true });
EnvironmentSchema.index({ projectId: 1, status: 1 });

export const Environment = mongoose.model<IEnvironment>('Environment', EnvironmentSchema);



