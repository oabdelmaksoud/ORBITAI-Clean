import mongoose, { Schema, Document } from 'mongoose';

export interface ICostControls {
  globalBudget?: {
    monthlyLimit?: number;
    dailyLimit?: number;
    perRequestLimit?: number;
  };
  userBudgets?: {
    [userId: string]: {
      monthlyLimit?: number;
      dailyLimit?: number;
    };
  };
  costPreference: 'low' | 'balanced' | 'quality';
  alertThresholds?: {
    budgetUsedPercent?: number;
    costPerRequest?: number;
  };
}

export interface IModelPriorities {
  providerRankings?: {
    [provider: string]: number; // Lower = higher priority
  };
  modelRankings?: {
    [modelId: string]: number;
  };
  taskTypePreferences?: {
    [taskType: string]: string[]; // Preferred models for task type
  };
  agentRolePreferences?: {
    [agentRole: string]: string[]; // Preferred models for agent role
  };
}

export interface IPerformanceTuning {
  latencyWeight: number; // 0-1, how much to prioritize latency
  costWeight: number; // 0-1, how much to prioritize cost
  qualityWeight: number; // 0-1, how much to prioritize quality
  maxLatencyMs?: number;
  preferredLatencyMs?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
}

export interface ILLMRouterSettings extends Document {
  scope: 'global' | 'user';
  userId?: mongoose.Types.ObjectId; // Required if scope is 'user'
  
  // Routing configuration
  routingRules?: mongoose.Types.ObjectId[]; // References to RoutingRule documents
  
  // Cost controls
  costControls?: ICostControls;
  
  // Model priorities
  modelPriorities?: IModelPriorities;
  
  // Performance tuning
  performanceTuning?: IPerformanceTuning;
  
  // Default preferences
  defaultCostPreference?: 'low' | 'balanced' | 'quality';
  defaultPreferredModels?: string[];
  defaultBlockedModels?: string[];
  
  // Feature flags
  enabled: boolean;
  enableIntelligentRouting: boolean;
  enableCostOptimization: boolean;
  enablePerformanceOptimization: boolean;
  
  // Metadata
  metadata?: {
    description?: string;
    tags?: string[];
    [key: string]: any;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const CostControlsSchema = new Schema<ICostControls>({
  globalBudget: {
    monthlyLimit: Number,
    dailyLimit: Number,
    perRequestLimit: Number
  },
  userBudgets: {
    type: Map,
    of: {
      monthlyLimit: Number,
      dailyLimit: Number
    }
  },
  costPreference: {
    type: String,
    enum: ['low', 'balanced', 'quality'],
    default: 'balanced'
  },
  alertThresholds: {
    budgetUsedPercent: Number,
    costPerRequest: Number
  }
}, { _id: false });

const ModelPrioritiesSchema = new Schema<IModelPriorities>({
  providerRankings: {
    type: Map,
    of: Number
  },
  modelRankings: {
    type: Map,
    of: Number
  },
  taskTypePreferences: {
    type: Map,
    of: [String]
  },
  agentRolePreferences: {
    type: Map,
    of: [String]
  }
}, { _id: false });

const PerformanceTuningSchema = new Schema<IPerformanceTuning>({
  latencyWeight: {
    type: Number,
    default: 0.33,
    min: 0,
    max: 1
  },
  costWeight: {
    type: Number,
    default: 0.33,
    min: 0,
    max: 1
  },
  qualityWeight: {
    type: Number,
    default: 0.34,
    min: 0,
    max: 1
  },
  maxLatencyMs: Number,
  preferredLatencyMs: Number,
  enableCaching: {
    type: Boolean,
    default: true
  },
  cacheTTL: Number
}, { _id: false });

const LLMRouterSettingsSchema = new Schema<ILLMRouterSettings>(
  {
    scope: {
      type: String,
      enum: ['global', 'user'],
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true // Only required when scope is 'user'
    },
    routingRules: [{
      type: Schema.Types.ObjectId,
      ref: 'RoutingRule'
    }],
    costControls: CostControlsSchema,
    modelPriorities: ModelPrioritiesSchema,
    performanceTuning: PerformanceTuningSchema,
    defaultCostPreference: {
      type: String,
      enum: ['low', 'balanced', 'quality']
    },
    defaultPreferredModels: [String],
    defaultBlockedModels: [String],
    enabled: {
      type: Boolean,
      default: true,
      index: true
    },
    enableIntelligentRouting: {
      type: Boolean,
      default: true
    },
    enableCostOptimization: {
      type: Boolean,
      default: true
    },
    enablePerformanceOptimization: {
      type: Boolean,
      default: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Unique index: only one global settings, one per user
LLMRouterSettingsSchema.index({ scope: 1, userId: 1 }, { unique: true, sparse: true });
LLMRouterSettingsSchema.index({ scope: 1 }, { unique: true, partialFilterExpression: { scope: 'global' } });

export const LLMRouterSettings = mongoose.model<ILLMRouterSettings>('LLMRouterSettings', LLMRouterSettingsSchema);




