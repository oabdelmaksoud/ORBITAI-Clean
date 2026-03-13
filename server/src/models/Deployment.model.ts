import mongoose, { Schema, Document } from 'mongoose';

export interface IDeployment extends Document {
  projectId: string;
  userId: string;
  projectName: string;
  platform: 'aws' | 'azure' | 'gcp' | 'vercel' | 'heroku';
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'stopped';
  environment: 'development' | 'staging' | 'production';
  url?: string;
  logs: string[];
  config?: {
    region?: string;
    instanceType?: string;
    buildCommand?: string;
    startCommand?: string;
    envVars?: Record<string, string>;
  };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeploymentSchema = new Schema<IDeployment>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    projectName: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['aws', 'azure', 'gcp', 'vercel', 'heroku'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'deploying', 'success', 'failed', 'stopped'],
      default: 'pending',
      index: true,
    },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      required: true,
    },
    url: {
      type: String,
    },
    logs: {
      type: [String],
      default: [],
    },
    config: {
      region: String,
      instanceType: String,
      buildCommand: String,
      startCommand: String,
      envVars: Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
DeploymentSchema.index({ projectId: 1, status: 1 });
DeploymentSchema.index({ userId: 1, createdAt: -1 });
DeploymentSchema.index({ platform: 1, environment: 1 });

export const Deployment = mongoose.model<IDeployment>('Deployment', DeploymentSchema);




