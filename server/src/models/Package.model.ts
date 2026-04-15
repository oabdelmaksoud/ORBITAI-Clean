import mongoose, { Schema, Document } from 'mongoose';

export interface IPackage extends Document {
  displayName: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  features: {
    key: string;
    label: string;
    value: string | number | boolean;
    type: 'string' | 'number' | 'boolean';
  }[];
    limits: {
      maxProjects: number;
      maxAgents: number;
      maxTasks: number;
      maxStorageGB: number;
      maxAPICalls: number;
      maxTeamMembers: number;
      maxBrainstormingAttendees?: number; // Specific limit for brainstorming room attendees
      maxMonthlyBudget: number;
      maxFileSizeMB: number;
      maxMCPServers: number;
      maxArtifactsPerProject: number;
      maxBackupVersions: number;
      maxConcurrentExecutions: number;
      internetAccessEnabled: boolean;
      codeExecutionEnabled: boolean;
      cloudDeploymentEnabled: boolean;
      // LLM-specific limits
      maxLLMCallsPerMonth?: number; // -1 for unlimited
      maxTokensPerMonth?: number; // -1 for unlimited
      allowedLLMModels?: string[]; // Array of model IDs user can access
      multiLLMEnabled?: boolean; // Can use intelligent routing
      premiumModelsEnabled?: boolean; // Access to GPT-4o, Claude, etc.
    };
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  metadata: {
    color?: string;
    icon?: string;
    highlight?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to generate slug from displayName
function generateSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const packageSchema = new Schema<IPackage>(
  {
    displayName: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    price: {
      type: Number,
      required: true,
      default: 0
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'lifetime'],
      default: 'monthly'
    },
    features: [{
      key: { type: String, required: true },
      label: { type: String, required: true },
      value: Schema.Types.Mixed,
      type: { type: String, enum: ['string', 'number', 'boolean'], required: true }
    }],
    limits: {
      maxProjects: { type: Number, default: 1 },
      maxAgents: { type: Number, default: 3 },
      maxTasks: { type: Number, default: 10 },
      maxStorageGB: { type: Number, default: 1 },
      maxAPICalls: { type: Number, default: 1000 },
      maxTeamMembers: { type: Number, default: 5 }, // Default to 5 for brainstorming attendees (Free plan)
      maxBrainstormingAttendees: { type: Number, default: 5 }, // Specific limit for brainstorming rooms
      maxMonthlyBudget: { type: Number, default: 50 },
      maxFileSizeMB: { type: Number, default: 10 },
      maxMCPServers: { type: Number, default: 3 },
      maxArtifactsPerProject: { type: Number, default: 100 },
      maxBackupVersions: { type: Number, default: 5 },
      maxConcurrentExecutions: { type: Number, default: 1 },
      internetAccessEnabled: { type: Boolean, default: false },
      codeExecutionEnabled: { type: Boolean, default: false },
      cloudDeploymentEnabled: { type: Boolean, default: false },
      // LLM-specific limits
      maxLLMCallsPerMonth: { type: Number, default: 1000 },
      maxTokensPerMonth: { type: Number, default: 100000 },
      allowedLLMModels: { type: [String], default: ['gemini-2.5-flash'] },
      multiLLMEnabled: { type: Boolean, default: false },
      premiumModelsEnabled: { type: Boolean, default: false }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    metadata: {
      color: String,
      icon: String,
      highlight: Boolean
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one default package and displayName is unique
packageSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('Package').updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }

  // Ensure displayName is unique
  if (this.isModified('displayName')) {
    const existing = await mongoose.model('Package').findOne({
      displayName: this.displayName,
      _id: { $ne: this._id }
    });
    if (existing) {
      return next(new Error('Package with this display name already exists'));
    }
  }

  next();
});

// Indexes (displayName already has unique index via unique: true)
packageSchema.index({ isActive: 1, sortOrder: 1 });

export const Package = mongoose.model<IPackage>('Package', packageSchema);
