import mongoose, { Schema, Document } from 'mongoose';

export interface IFeatureFlag extends Document {
  featureKey: string; // Unique identifier for the feature (e.g., 'project_creation', 'ai_chat', 'export_data')
  featureName: string; // Human-readable name
  description: string; // Description of what this feature does
  category: string; // Category grouping (e.g., 'projects', 'ai', 'export', 'admin')
  enabledRoles: string[]; // Array of roles that have access: ['public', 'guest', 'user', 'admin', 'superadmin', 'editor']
  enabledEnvironments?: string[]; // Array of environments where feature is active: ['development', 'staging', 'production'] - if empty/null, active in all environments
  isActive: boolean; // Whether this feature flag is active/being used
  metadata?: {
    icon?: string;
    color?: string;
    requiresPlan?: string[]; // Optional plan requirements
    dependsOn?: string[]; // Features this depends on
  };
  createdAt: Date;
  updatedAt: Date;
}

const featureFlagSchema = new Schema<IFeatureFlag>(
  {
    featureKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    featureName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    enabledRoles: {
      type: [String],
      required: true,
      default: ['user'],
      enum: ['public', 'guest', 'user', 'admin', 'superadmin', 'editor']
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    enabledEnvironments: {
      type: [String],
      default: [], // Empty array means active in all environments
      enum: ['development', 'staging', 'production', 'test']
    },
    metadata: {
      icon: String,
      color: String,
      requiresPlan: [String],
      dependsOn: [String]
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast queries
featureFlagSchema.index({ featureKey: 1, isActive: 1 });
featureFlagSchema.index({ category: 1, isActive: 1 });
featureFlagSchema.index({ enabledRoles: 1 });

export const FeatureFlag = mongoose.model<IFeatureFlag>('FeatureFlag', featureFlagSchema);
