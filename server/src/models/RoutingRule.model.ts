/**
 * RoutingRule Model
 * 
 * IMPORTANT: This model is for END USER ROUTER rules only.
 * - Rules are scoped by routerType field ('end-user' | 'internal')
 * - End User Router uses routerType='end-user'
 * - Internal Router uses InternalRoutingConfig with taskTypeOverrides/contextOverrides (NOT this model)
 * - These two routers are completely independent and do NOT share rules
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IFallbackStep {
  modelId: string;
  provider?: string;
  maxRetries: number;
  timeoutMs: number;
  circuitBreakerThreshold?: number; // Error rate % to trip circuit breaker
}

export interface ISchedule {
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  startHour: number; // 0-23
  endHour: number; // 0-23
  timezone: string; // e.g., 'America/New_York'
}

export interface IRoutingRule extends Document {
  name: string;
  priority: number;
  routerType: 'end-user' | 'internal'; // Scope rules per router type
  conditions: {
    agentRoles?: string[];
    taskTypes?: string[];
    complexity?: ('simple' | 'moderate' | 'complex')[];
    requestTypes?: string[];
    minTokens?: number;
    maxTokens?: number;
    projectPhases?: string[];
    customConditions?: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in';
      value: any;
    }>;
  };
  actions: {
    preferredModel?: string;
    blockedModels?: string[];
    preferredProvider?: string;
    blockedProviders?: string[];
    costLimit?: number;
    maxLatency?: number;
    forceProvider?: string;
    costPreference?: 'low' | 'balanced' | 'quality';
  };
  // Smart Fallback Chain
  fallbackChain?: IFallbackStep[];
  // Time-based scheduling
  schedule?: ISchedule;
  enabled: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoutingRuleSchema = new Schema<IRoutingRule>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    priority: {
      type: Number,
      required: true,
      default: 0,
      index: true
    },
    routerType: {
      type: String,
      enum: ['end-user', 'internal'],
      required: true,
      default: 'end-user',
      index: true
    },
    conditions: {
      agentRoles: [String],
      taskTypes: [String],
      complexity: {
        type: [String],
        enum: ['simple', 'moderate', 'complex']
      },
      requestTypes: [String],
      minTokens: Number,
      maxTokens: Number,
      projectPhases: [String],
      customConditions: [{
        field: String,
        operator: {
          type: String,
          enum: ['equals', 'contains', 'greaterThan', 'lessThan', 'in']
        },
        value: Schema.Types.Mixed
      }]
    },
    actions: {
      preferredModel: String,
      blockedModels: [String],
      preferredProvider: String,
      blockedProviders: [String],
      costLimit: Number,
      maxLatency: Number,
      forceProvider: String,
      costPreference: {
        type: String,
        enum: ['low', 'balanced', 'quality']
      }
    },
    // Smart Fallback Chain
    fallbackChain: [{
      modelId: { type: String, required: true },
      provider: String,
      maxRetries: { type: Number, default: 1 },
      timeoutMs: { type: Number, default: 30000 },
      circuitBreakerThreshold: { type: Number, default: 50 } // 50% error rate
    }],
    // Time-based scheduling
    schedule: {
      daysOfWeek: [{ type: Number, min: 0, max: 6 }],
      startHour: { type: Number, min: 0, max: 23 },
      endHour: { type: Number, min: 0, max: 23 },
      timezone: { type: String, default: 'UTC' }
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient rule matching
RoutingRuleSchema.index({ routerType: 1, priority: -1, enabled: 1 });
RoutingRuleSchema.index({ priority: -1, enabled: 1 });
RoutingRuleSchema.index({ 'conditions.agentRoles': 1 });
RoutingRuleSchema.index({ 'conditions.taskTypes': 1 });

export const RoutingRule = mongoose.model<IRoutingRule>('RoutingRule', RoutingRuleSchema);


