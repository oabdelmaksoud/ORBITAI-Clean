/**
 * Internal Routing Configuration Model
 * Stores configuration for AI-powered internal task routing
 */

/**
 * InternalRoutingConfig Model
 * 
 * IMPORTANT: This model is for INTERNAL ROUTER only.
 * - Uses taskTypeOverrides and contextOverrides (NOT RoutingRule model)
 * - Completely independent from End User Router
 * - End User Router uses RoutingRule model with routerType='end-user'
 * - These two routers are completely independent and do NOT share rules or configuration
 */

import mongoose, { Schema, Document } from 'mongoose';

export type ModelTier = 'economy' | 'standard' | 'premium';

export interface ITierConfig {
  name: ModelTier;
  models: string[];
  maxComplexity: 'simple' | 'moderate' | 'complex';
  maxTokens: number;
  capabilities: string[];
  costMultiplier: number;
}

export interface IBudgetLimits {
  dailyLimit: number;
  monthlyLimit: number;
  perTaskLimit: number;
}

export interface IEscalationRules {
  autoEscalateOnFailure: boolean;
  maxEscalationLevel: ModelTier;
  cooldownMinutes: number;
}

export interface IInternalRoutingConfig extends Document {
  enabled: boolean;
  defaultTier: ModelTier;
  tiers: ITierConfig[];
  budgetLimits: IBudgetLimits;
  escalationRules: IEscalationRules;
  
  // Advanced settings
  preferLocalModels: boolean;
  enableLearning: boolean;
  minConfidenceThreshold: number;
  
  // Context-specific overrides
  contextOverrides?: {
    context: string;
    preferredTier: ModelTier;
    preferredModels?: string[];
  }[];
  
  // Task type overrides
  taskTypeOverrides?: {
    taskType: string;
    preferredTier: ModelTier;
    preferredModels?: string[];
    requiredCapabilities?: string[];
  }[];
  
  // Metadata for UI state and AI configurator settings
  metadata?: {
    aiRuleConfigurator?: {
      parameters?: Record<string, any>;
      scoringMode?: 'high-performance' | 'low-cost' | 'balance' | 'custom';
      generatedRules?: any[];
      lastUpdated?: string;
      lastModelAnalysis?: {
        totalModels?: number;
        enabledModels?: number;
        analyzedAt?: string;
      };
    };
    [key: string]: any; // Allow other metadata fields
  };
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tierConfigSchema = new Schema<ITierConfig>({
  name: {
    type: String,
    enum: ['economy', 'standard', 'premium'],
    required: true
  },
  models: [{
    type: String,
    required: true
  }],
  maxComplexity: {
    type: String,
    enum: ['simple', 'moderate', 'complex'],
    required: true
  },
  maxTokens: {
    type: Number,
    required: true,
    default: 4000
  },
  capabilities: [{
    type: String
  }],
  costMultiplier: {
    type: Number,
    required: true,
    default: 1.0
  }
}, { _id: false });

const budgetLimitsSchema = new Schema<IBudgetLimits>({
  dailyLimit: {
    type: Number,
    required: true,
    default: 10
  },
  monthlyLimit: {
    type: Number,
    required: true,
    default: 200
  },
  perTaskLimit: {
    type: Number,
    required: true,
    default: 0.5
  }
}, { _id: false });

const escalationRulesSchema = new Schema<IEscalationRules>({
  autoEscalateOnFailure: {
    type: Boolean,
    default: true
  },
  maxEscalationLevel: {
    type: String,
    enum: ['economy', 'standard', 'premium'],
    default: 'premium'
  },
  cooldownMinutes: {
    type: Number,
    default: 30
  }
}, { _id: false });

const contextOverrideSchema = new Schema({
  context: {
    type: String,
    required: true
  },
  preferredTier: {
    type: String,
    enum: ['economy', 'standard', 'premium'],
    required: true
  },
  preferredModels: [{
    type: String
  }]
}, { _id: false });

const taskTypeOverrideSchema = new Schema({
  taskType: {
    type: String,
    required: true
  },
  preferredTier: {
    type: String,
    enum: ['economy', 'standard', 'premium'],
    required: true
  },
  preferredModels: [{
    type: String
  }],
  requiredCapabilities: [{
    type: String
  }]
}, { _id: false });

const internalRoutingConfigSchema = new Schema<IInternalRoutingConfig>(
  {
    enabled: {
      type: Boolean,
      default: true
    },
    defaultTier: {
      type: String,
      enum: ['economy', 'standard', 'premium'],
      default: 'economy'
    },
    tiers: {
      type: [tierConfigSchema],
      default: []
    },
    budgetLimits: {
      type: budgetLimitsSchema,
      default: () => ({
        dailyLimit: 10,
        monthlyLimit: 200,
        perTaskLimit: 0.5
      })
    },
    escalationRules: {
      type: escalationRulesSchema,
      default: () => ({
        autoEscalateOnFailure: true,
        maxEscalationLevel: 'premium',
        cooldownMinutes: 30
      })
    },
    preferLocalModels: {
      type: Boolean,
      default: false
    },
    enableLearning: {
      type: Boolean,
      default: true
    },
    minConfidenceThreshold: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1
    },
    contextOverrides: {
      type: [contextOverrideSchema],
      default: []
    },
    taskTypeOverrides: {
      type: [taskTypeOverrideSchema],
      default: []
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one active config
internalRoutingConfigSchema.pre('save', async function(next) {
  if (this.isActive) {
    await InternalRoutingConfig.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { $set: { isActive: false } }
    );
  }
  next();
});

export const InternalRoutingConfig = mongoose.model<IInternalRoutingConfig>(
  'InternalRoutingConfig',
  internalRoutingConfigSchema
);

export default InternalRoutingConfig;




